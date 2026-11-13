import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { count, eq } from 'drizzle-orm';
import { db } from '$lib/server/db/index';
import { admissions, careers } from '$lib/server/db/schema';
import { auditContextFromEvent, auditedTransaction, writeAuditLog } from '$lib/server/audit';
import { parse } from 'csv-parse/sync';
import { can } from '$lib/permissions';

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

const MAX_INT = 2147483647;

type CareerFields = {
	programa_academico: string;
	codigo: number | null;
	ofae: string;
	ocre: number | null;
	facultad: string;
	nucleo: string;
};

type Tx = Parameters<Parameters<typeof auditedTransaction>[1]>[0];

/** A blank field is null; otherwise it must be a non-negative integer that fits an INT column. */
function optionalInt(value: FormDataEntryValue | null, label: string): number | null | string {
	const text = String(value ?? '').trim();
	if (!text) return null;
	if (!/^\d+$/.test(text) || Number(text) > MAX_INT) {
		return `${label} debe ser un número entero positivo.`;
	}
	return Number(text);
}

/** The career fields from a create/update form, or an error message for the user. */
function parseCareerForm(data: FormData): CareerFields | string {
	const programa_academico = String(data.get('programa_academico') ?? '').trim();
	const facultad = String(data.get('facultad') ?? '').trim();
	const nucleo = normalizeCode(String(data.get('nucleo') ?? ''));
	const ofae = normalizeCode(String(data.get('ofae') ?? ''));
	const codigo = optionalInt(data.get('codigo'), 'El código OPSU');
	const ocre = optionalInt(data.get('ocre'), 'El código OCRE');

	if (!programa_academico) return 'El programa académico es obligatorio.';
	if (programa_academico.length > 255) return 'El programa académico es demasiado largo.';
	if (!facultad) return 'La facultad es obligatoria.';
	if (facultad.length > 255) return 'La facultad es demasiado larga.';
	if (!/^[A-Z]$/.test(nucleo)) return 'El núcleo debe ser una sola letra.';
	if (!/^[A-Z0-9]{1,4}$/.test(ofae)) return 'El código OFAE debe tener de 1 a 4 letras o números.';
	if (typeof codigo === 'string') return codigo;
	if (typeof ocre === 'string') return ocre;

	return { programa_academico, codigo, ofae, ocre, facultad, nucleo };
}

/**
 * Another career (not `exceptId`) already using this clave. Reads the whole (small) table
 * FOR UPDATE so two people adding the same clave at once cannot both succeed.
 */
async function findClaveConflict(tx: Tx, key: string, exceptId: number | null) {
	const rows = await tx
		.select({
			id: careers.id,
			nucleo: careers.nucleo,
			ofae: careers.ofae,
			programa: careers.programa_academico
		})
		.from(careers)
		.for('update');
	return rows.find((row) => row.id !== exceptId && careerKey(row) === key) ?? null;
}

export const load: PageServerLoad = async () => {
	const [list_all_careers, usage] = await Promise.all([
		db.select().from(careers),
		db
			.select({ careerId: admissions.careerId, total: count() })
			.from(admissions)
			.groupBy(admissions.careerId)
	]);
	const admissionsByCareer = new Map(usage.map((row) => [row.careerId, row.total]));
	return {
		all_careers: list_all_careers.map((career) => ({
			...career,
			admissionCount: admissionsByCareer.get(career.id) ?? 0
		}))
	};
};

export const actions: Actions = {
	// Add a single career, as an alternative to the CSV import.
	create: async (event) => {
		const auditContext = auditContextFromEvent(event);
		if (!auditContext) {
			return fail(401, { action: 'create', error: true, message: 'Debe iniciar sesion.' });
		}
		if (!can(event.locals.user, 'catalogs.import')) {
			return fail(403, {
				action: 'create',
				error: true,
				message: 'No tiene permiso para agregar carreras.'
			});
		}

		const fields = parseCareerForm(await event.request.formData());
		if (typeof fields === 'string') {
			return fail(400, { action: 'create', error: true, message: fields });
		}
		const key = careerKey(fields);

		const outcome = await auditedTransaction(auditContext, async (tx) => {
			const conflict = await findClaveConflict(tx, key, null);
			if (conflict) return { status: 'conflict', conflict } as const;

			const [result] = await tx.insert(careers).values(fields);
			await writeAuditLog(tx, auditContext, {
				action: 'career.created',
				entityType: 'career',
				entityId: result.insertId,
				before: null,
				after: { id: result.insertId, ...fields, clave: key }
			});
			return { status: 'created' } as const;
		});

		if (outcome.status === 'conflict') {
			return fail(409, {
				action: 'create',
				error: true,
				message: `La clave ${key} ya pertenece a "${outcome.conflict.programa}".`
			});
		}
		return { action: 'create', error: false, message: `Carrera ${key} agregada.` };
	},

	// Correct a single career. Its núcleo and OFAE (which make up the clave) are locked once any
	// admission uses it: uploads find careers by those codes, so changing them would silently
	// re-route or break the next upload for that career.
	update: async (event) => {
		const auditContext = auditContextFromEvent(event);
		if (!auditContext) {
			return fail(401, { action: 'update', error: true, message: 'Debe iniciar sesion.' });
		}
		if (!can(event.locals.user, 'catalogs.import')) {
			return fail(403, {
				action: 'update',
				error: true,
				message: 'No tiene permiso para modificar carreras.'
			});
		}

		const data = await event.request.formData();
		const id = Number(data.get('id'));
		if (!Number.isInteger(id) || id <= 0) {
			return fail(400, { action: 'update', error: true, message: 'Carrera inválida.' });
		}
		const fields = parseCareerForm(data);
		if (typeof fields === 'string') {
			return fail(400, { action: 'update', error: true, message: fields });
		}
		const key = careerKey(fields);

		const outcome = await auditedTransaction(auditContext, async (tx) => {
			const [current] = await tx.select().from(careers).where(eq(careers.id, id)).for('update');
			if (!current) return { status: 'not_found' } as const;

			if (careerKey(current) !== key) {
				const [usage] = await tx
					.select({ total: count() })
					.from(admissions)
					.where(eq(admissions.careerId, id));
				if (usage.total > 0) return { status: 'in_use', total: usage.total } as const;
				const conflict = await findClaveConflict(tx, key, id);
				if (conflict) return { status: 'conflict', conflict } as const;
			}

			const before: CareerFields = {
				programa_academico: current.programa_academico,
				codigo: current.codigo,
				ofae: current.ofae,
				ocre: current.ocre,
				facultad: current.facultad,
				nucleo: current.nucleo
			};
			const changedFields = (Object.keys(fields) as (keyof CareerFields)[]).filter(
				(field) => before[field] !== fields[field]
			);
			if (changedFields.length === 0) return { status: 'unchanged' } as const;

			await tx.update(careers).set(fields).where(eq(careers.id, id));
			await writeAuditLog(tx, auditContext, {
				action: 'career.updated',
				entityType: 'career',
				entityId: id,
				before: { id, ...before, clave: current.clave },
				after: { id, ...fields, clave: key },
				metadata: { changedFields }
			});
			return { status: 'updated' } as const;
		});

		switch (outcome.status) {
			case 'not_found':
				return fail(404, { action: 'update', error: true, message: 'La carrera ya no existe.' });
			case 'in_use':
				return fail(409, {
					action: 'update',
					error: true,
					message: `No se puede cambiar el núcleo ni el OFAE: ${outcome.total} admisión(es) usan esta carrera.`
				});
			case 'conflict':
				return fail(409, {
					action: 'update',
					error: true,
					message: `La clave ${key} ya pertenece a "${outcome.conflict.programa}".`
				});
			case 'unchanged':
				return { action: 'update', error: false, message: 'No había cambios que guardar.' };
			default:
				return { action: 'update', error: false, message: `Carrera ${key} actualizada.` };
		}
	},

	// IMPORT CSV
	import: async (event) => {
		if (!can(event.locals.user, 'catalogs.import')) {
			return { action: 'import', error: true, message: 'No tiene permiso para importar carreras.' };
		}
		if (!event.locals.user) {
			return { action: 'import', error: true, message: 'Debe iniciar sesion.' };
		}

		const { request } = event;
		const formData = await request.formData();
		const file = formData.get('csvFile');
		const auditContext = auditContextFromEvent(event);

		if (!isUploadedFile(file)) {
			return { action: 'import', error: true, message: 'No se seleccionó ningún archivo.' };
		}
		if (!auditContext) {
			return { action: 'import', error: true, message: 'Debe iniciar sesion.' };
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

			await auditedTransaction(auditContext, async (tx) => {
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
				action: 'import',
				error: false,
				message: `${inserted} carrera(s) agregada(s)${skipped.length ? `; ${skipped.join(', ')}` : ''}.`
			};
		} catch (err) {
			console.error(err);
			return {
				action: 'import',
				error: true,
				message: 'Error al procesar el archivo o la base de datos.'
			};
		}
	}
};
