import 'dotenv/config';
import mysql from 'mysql2/promise';
import { normalizeStudentIdentity } from '../src/lib/student-identity';

// Read-only preflight. Never merge people or expose raw cédulas in migration logs.
const connection = await mysql.createConnection(process.env.DATABASE_URL!);
try {
	const [tables] = await connection.query<mysql.RowDataPacket[]>(
		"SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='students'"
	);
	if (tables.length) {
		const [students] = await connection.query<mysql.RowDataPacket[]>(
			'SELECT id, cedula FROM students'
		);
		const groups = new Map<string, number[]>();
		const invalid: number[] = [];
		for (const student of students) {
			const key = normalizeStudentIdentity(student.cedula);
			if (!key) {
				invalid.push(Number(student.id));
				continue;
			}
			const ids = groups.get(key) ?? [];
			ids.push(Number(student.id));
			groups.set(key, ids);
		}
		const collisions = [...groups.values()].filter((ids) => ids.length > 1);
		if (invalid.length || collisions.length) {
			if (invalid.length) console.error(`Cédulas inválidas: IDs ${invalid.join(', ')}.`);
			if (collisions.length)
				console.error(
					`Identidades repetidas: grupos de IDs ${collisions.map((ids) => ids.join('/')).join(', ')}.`
				);
			throw new Error(
				'Migración detenida. Revise estas identidades y sus admisiones antes de continuar; no se fusionó ni modificó ningún estudiante.'
			);
		}
		console.log(`Identidades verificadas: ${students.length} estudiantes, sin colisiones.`);
	} else console.log('Instalación nueva: no hay identidades que verificar.');
} finally {
	await connection.end();
}
