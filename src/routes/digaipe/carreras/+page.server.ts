import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/index';
import { careers } from '$lib/server/db/schema';
import { auditContextFromEvent, setAuditDatabaseContext, writeAuditLog } from '$lib/server/audit';
import { parse } from 'csv-parse/sync';

type NewCareer = typeof careers.$inferInsert;
type CsvRow = {
	'Programa Académico': string;
	OPSU: number | null;
	OFAE: string | null;
	OCRE: number | null;
	'Facultad o Núcleo': string;
	Nucleo: string;
	Clave: string;
};

function normalizeCode(value: string | null | undefined) {
	return String(value ?? '')
		.toUpperCase()
		.replace(/^\.+/, '')
		.replace(/\s+/g, '');
}

// Mirrors the generated `clave` column: concat(nucleo, ofae). Empty when either part is missing.
function careerKey(career: { nucleo: string | null | undefined; ofae: string | null | undefined }) {
	const nucleo = normalizeCode(career.nucleo);
	const ofae = normalizeCode(career.ofae);
	return nucleo && ofae ? `${nucleo}${ofae}` : '';
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
	return value instanceof File && value.size > 0;
}

export const load: PageServerLoad = async () => {
	const list_all_careers = await db.select().from(careers);
	return {
		all_careers: list_all_careers
	};
};

//IMPORT CSV

export const actions = {
	default: async (event) => {
		if (!event.locals.user) {
			return { error: true, message: 'Debe iniciar sesion.' };
		}

		const { request } = event;
		const formData = await request.formData();
		const file = formData.get('csvFile');
		const auditContext = auditContextFromEvent(event);

		if (!isUploadedFile(file)) {
			return { error: true, message: 'No se seleccionó ningún archivo.' };
		}
		if (!auditContext) {
			return { error: true, message: 'Debe iniciar sesion.' };
		}

		try {
			// 1. Leer el contenido del archivo como texto
			const text = await file.text();

			// 2. Parsear el CSV a objetos (asumiendo que tiene cabeceras)
			const records = parse(text, {
				columns: true,
				delimiter: ';',
				skip_empty_lines: true
			}) as CsvRow[];

			// const values = records.map((row)=>({
			//     programa_academico: row['Programa Académico'],
			//     codigo: row['OPSU'] || null,
			//     ofae: row['OFAE'] || null,
			//     ocre: row['OCRE'] || null,
			//     facultad: row['Facultad o Núcleo'],
			//     nucleo: row['Nucleo']

			// }))

			const values: NewCareer[] = records.map((row) => ({
				programa_academico: String(row['Programa Académico'] ?? ''),
				codigo: row['OPSU'] ? Number(row['OPSU']) : null,
				ofae: String(row['OFAE'] ?? ''),
				ocre: row['OCRE'] ? Number(row['OCRE']) : null,
				facultad: String(row['Facultad o Núcleo'] ?? ''),
				nucleo: String(row['Nucleo'] ?? ''),
				clave: String(row['Clave'] ?? '')
			}));
			// 3. Insertar solo las carreras nuevas, identificadas por su clave (núcleo + OFAE)
			let inserted = 0;
			let skippedExisting = 0;
			let skippedNoClave = 0;

			await db.transaction(async (tx) => {
				await setAuditDatabaseContext(tx, auditContext);
				const existing = await tx
					.select({ nucleo: careers.nucleo, ofae: careers.ofae })
					.from(careers);
				const seen = new Set(existing.map((row) => careerKey(row)));
				const newValues: NewCareer[] = [];
				for (const value of values) {
					const key = careerKey(value);
					if (!key) {
						skippedNoClave++;
						continue;
					}
					if (seen.has(key)) {
						skippedExisting++;
						continue;
					}
					seen.add(key);
					newValues.push(value);
				}
				inserted = newValues.length;
				if (newValues.length) await tx.insert(careers).values(newValues);
				await writeAuditLog(tx, auditContext, {
					action: 'career.imported',
					entityType: 'career',
					entityId: 'csv_import',
					before: null,
					after: { rowCount: values.length, inserted, skippedExisting, skippedNoClave },
					metadata: { fileName: file.name }
				});
			});
			// await db.insert(careers).values({
			//     programa_academico: 'Ingeniería Geológica',
			//     codigo: 10593,
			//     ofae: 'TIG',
			//     ocre: 23,
			//     facultad: 'Núcleo Rafael Rangel',
			//     nucleo: 'T',
			//     clave: '12345'
			// });
			console.log('Datos Cargados');
			const skipped = [
				skippedExisting && `${skippedExisting} omitida(s) por ya existir`,
				skippedNoClave && `${skippedNoClave} omitida(s) sin clave (núcleo u OFAE vacío)`
			].filter(Boolean);
			return {
				error: false,
				message: `${inserted} carrera(s) agregada(s)${skipped.length ? `; ${skipped.join(', ')}` : ''}.`
			};
		} catch (err) {
			console.error(err);
			return { error: true, message: 'Error al procesar el archivo o la base de datos.' };
		}
	}
};
