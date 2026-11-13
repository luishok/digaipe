import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { and, count, eq, ne, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { admissions, mod_admission } from '$lib/server/db/schema';
import { auditContextFromEvent, auditedTransaction, writeAuditLog } from '$lib/server/audit';
import { can } from '$lib/permissions';

type ModalityFields = { code: string; name: string };

// Same normalization the admissions upload applies to Moda_Ingre before looking it up.
function normalizeCode(value: string) {
	return value.toUpperCase().replace(/^\.+/, '').replace(/\s+/g, '');
}

/** The modality fields from a create/update form, or an error message for the user. */
function parseModalityForm(data: FormData): ModalityFields | string {
	const code = normalizeCode(String(data.get('code') ?? ''));
	const name = String(data.get('name') ?? '')
		.trim()
		.replace(/\s+/g, ' ');

	if (!/^[A-Z0-9]{1,4}$/.test(code)) return 'El código debe tener de 1 a 4 letras o números.';
	if (!name) return 'El nombre es obligatorio.';
	if (name.length > 128) return 'El nombre no puede pasar de 128 caracteres.';
	return { code, name };
}

export const load: PageServerLoad = async () => {
	const [all_admission_modalities, usage] = await Promise.all([
		db.select().from(mod_admission),
		db
			.select({ modalityId: admissions.modalityId, total: count() })
			.from(admissions)
			.groupBy(admissions.modalityId)
	]);
	const admissionsByModality = new Map(usage.map((row) => [row.modalityId, row.total]));
	return {
		all_admission_modalities: all_admission_modalities.map((modality) => ({
			...modality,
			admissionCount: admissionsByModality.get(modality.id) ?? 0
		}))
	};
};

export const actions: Actions = {
	// Add a single modality, as an alternative to the CSV seed script.
	create: async (event) => {
		const auditContext = auditContextFromEvent(event);
		if (!auditContext) {
			return fail(401, { action: 'create', error: true, message: 'Debe iniciar sesion.' });
		}
		if (!can(event.locals.user, 'catalogs.import')) {
			return fail(403, {
				action: 'create',
				error: true,
				message: 'No tiene permiso para agregar modalidades.'
			});
		}

		const fields = parseModalityForm(await event.request.formData());
		if (typeof fields === 'string') {
			return fail(400, { action: 'create', error: true, message: fields });
		}

		const outcome = await auditedTransaction(auditContext, async (tx) => {
			// Friendly message for the common case; the UNIQUE indexes still guard races.
			const [conflict] = await tx
				.select({ code: mod_admission.code, name: mod_admission.name })
				.from(mod_admission)
				.where(or(eq(mod_admission.code, fields.code), eq(mod_admission.name, fields.name)))
				.limit(1);
			if (conflict) return { status: 'conflict', conflict } as const;

			const [result] = await tx.insert(mod_admission).values(fields);
			await writeAuditLog(tx, auditContext, {
				action: 'admission_modality.created',
				entityType: 'admission_modality',
				entityId: result.insertId,
				before: null,
				after: { id: result.insertId, ...fields }
			});
			return { status: 'created' } as const;
		}).catch((error) => {
			if (isDuplicateKey(error)) return { status: 'duplicate' } as const;
			throw error;
		});

		if (outcome.status === 'conflict') {
			return fail(409, {
				action: 'create',
				error: true,
				message: `Ya existe la modalidad ${outcome.conflict.code} (${outcome.conflict.name}).`
			});
		}
		if (outcome.status === 'duplicate') {
			return fail(409, {
				action: 'create',
				error: true,
				message: 'El código o el nombre ya existe.'
			});
		}
		return { action: 'create', error: false, message: `Modalidad ${fields.code} agregada.` };
	},

	// Correct a single modality. Its code is locked once any admission uses it: uploads find the
	// modality by Moda_Ingre, so a new code would break the next upload that still sends the old one.
	update: async (event) => {
		const auditContext = auditContextFromEvent(event);
		if (!auditContext) {
			return fail(401, { action: 'update', error: true, message: 'Debe iniciar sesion.' });
		}
		if (!can(event.locals.user, 'catalogs.import')) {
			return fail(403, {
				action: 'update',
				error: true,
				message: 'No tiene permiso para modificar modalidades.'
			});
		}

		const data = await event.request.formData();
		const id = Number(data.get('id'));
		if (!Number.isInteger(id) || id <= 0) {
			return fail(400, { action: 'update', error: true, message: 'Modalidad inválida.' });
		}
		const fields = parseModalityForm(data);
		if (typeof fields === 'string') {
			return fail(400, { action: 'update', error: true, message: fields });
		}

		const outcome = await auditedTransaction(auditContext, async (tx) => {
			const [current] = await tx
				.select()
				.from(mod_admission)
				.where(eq(mod_admission.id, id))
				.for('update');
			if (!current) return { status: 'not_found' } as const;
			if (current.code === fields.code && current.name === fields.name) {
				return { status: 'unchanged' } as const;
			}

			if (current.code !== fields.code) {
				const [usage] = await tx
					.select({ total: count() })
					.from(admissions)
					.where(eq(admissions.modalityId, id));
				if (usage.total > 0) return { status: 'in_use', total: usage.total } as const;
			}

			const [conflict] = await tx
				.select({ code: mod_admission.code, name: mod_admission.name })
				.from(mod_admission)
				.where(
					and(
						ne(mod_admission.id, id),
						or(eq(mod_admission.code, fields.code), eq(mod_admission.name, fields.name))
					)
				)
				.limit(1);
			if (conflict) return { status: 'conflict', conflict } as const;

			await tx.update(mod_admission).set(fields).where(eq(mod_admission.id, id));
			await writeAuditLog(tx, auditContext, {
				action: 'admission_modality.updated',
				entityType: 'admission_modality',
				entityId: id,
				before: { id, code: current.code, name: current.name },
				after: { id, ...fields }
			});
			return { status: 'updated' } as const;
		}).catch((error) => {
			if (isDuplicateKey(error)) return { status: 'duplicate' } as const;
			throw error;
		});

		switch (outcome.status) {
			case 'not_found':
				return fail(404, { action: 'update', error: true, message: 'La modalidad ya no existe.' });
			case 'in_use':
				return fail(409, {
					action: 'update',
					error: true,
					message: `No se puede cambiar el código: ${outcome.total} admisión(es) usan esta modalidad.`
				});
			case 'conflict':
				return fail(409, {
					action: 'update',
					error: true,
					message: `Ya existe la modalidad ${outcome.conflict.code} (${outcome.conflict.name}).`
				});
			case 'duplicate':
				return fail(409, {
					action: 'update',
					error: true,
					message: 'El código o el nombre ya existe.'
				});
			case 'unchanged':
				return { action: 'update', error: false, message: 'No había cambios que guardar.' };
			default:
				return { action: 'update', error: false, message: `Modalidad ${fields.code} actualizada.` };
		}
	}
};

function isDuplicateKey(error: unknown): boolean {
	const seen = new Set<unknown>();
	let current: unknown = error;
	while (current && typeof current === 'object' && !seen.has(current)) {
		seen.add(current);
		if ((current as { code?: unknown }).code === 'ER_DUP_ENTRY') return true;
		current = (current as { cause?: unknown }).cause;
	}
	return false;
}
