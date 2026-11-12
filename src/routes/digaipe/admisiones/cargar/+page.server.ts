import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { admissionImportBatches } from '$lib/server/db/schema';
import {
	createDraftBatch,
	deleteDraftBatch,
	DraftBatchDeleteError,
	saveAdmissionBatch
} from '$lib/server/admisiones/import';
import { auditContextFromEvent } from '$lib/server/audit';
import { can } from '$lib/permissions';
import { desc, eq, or } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');

	// Admins also see everyone's drafts, so they can discard one uploaded by mistake.
	const canDeleteDraft = can(locals.user, 'admissions.deleteDraft');
	const ownBatches = eq(admissionImportBatches.uploadedByUserId, locals.user.id);

	const rows = await db
		.select({
			id: admissionImportBatches.id,
			status: admissionImportBatches.status,
			sourceFileName: admissionImportBatches.sourceFileName,
			estadisticaFileName: admissionImportBatches.estadisticaFileName,
			manifestFileName: admissionImportBatches.manifestFileName,
			rowCount: admissionImportBatches.rowCount,
			warningCount: admissionImportBatches.warningCount,
			errorCount: admissionImportBatches.errorCount,
			createdAt: admissionImportBatches.createdAt,
			savedAt: admissionImportBatches.savedAt,
			uploadedByUserId: admissionImportBatches.uploadedByUserId
		})
		.from(admissionImportBatches)
		.where(
			canDeleteDraft ? or(ownBatches, eq(admissionImportBatches.status, 'draft')) : ownBatches
		)
		.orderBy(desc(admissionImportBatches.createdAt))
		.limit(canDeleteDraft ? 50 : 10);

	// Only the uploader can open (and save) a draft; others' drafts are listed, not linked.
	const recentBatches = rows.map(({ uploadedByUserId, ...batch }) => ({
		...batch,
		isOwn: uploadedByUserId === locals.user?.id
	}));

	return { recentBatches, canDeleteDraft };
};

export const actions: Actions = {
	preview: async (event) => {
		const { request, locals } = event;
		if (!locals.user) return fail(401, { message: 'Debe iniciar sesion.' });

		try {
			const formData = await request.formData();
			const auditContext = auditContextFromEvent(event);
			if (!auditContext) return fail(401, { message: 'Debe iniciar sesion.' });

			const result = await createDraftBatch(formData, locals.user.id, auditContext);
			return {
				step: 'preview',
				message:
					result.preview.errors.length > 0
						? 'Revise los errores antes de guardar.'
						: 'Vista previa lista. Puede guardar el lote.',
				...result
			};
		} catch (error) {
			return fail(400, {
				step: 'preview',
				message: error instanceof Error ? error.message : 'No se pudo procesar el lote.'
			});
		}
	},

	save: async (event) => {
		const { request, locals } = event;
		if (!locals.user) return fail(401, { message: 'Debe iniciar sesion.' });

		const formData = await request.formData();
		const batchId = Number(formData.get('batchId'));
		if (!Number.isInteger(batchId) || batchId <= 0) {
			return fail(400, { step: 'save', message: 'Lote invalido.' });
		}

		try {
			const auditContext = auditContextFromEvent(event);
			if (!auditContext) return fail(401, { message: 'Debe iniciar sesion.' });

			const result = await saveAdmissionBatch(batchId, auditContext);
			return {
				step: 'save',
				message: `Se guardaron ${result.rowCount} admisiones.`,
				...result
			};
		} catch (error) {
			return fail(400, {
				step: 'save',
				message: error instanceof Error ? error.message : 'No se pudo guardar el lote.'
			});
		}
	},

	deleteDraft: async (event) => {
		const { request, locals } = event;
		if (!locals.user) return fail(401, { message: 'Debe iniciar sesion.' });
		// hooks.server.ts already requires this; checked again so the action is safe on its own.
		if (!can(locals.user, 'admissions.deleteDraft')) {
			return fail(403, { step: 'delete', message: 'Solo un administrador puede eliminar lotes.' });
		}

		const formData = await request.formData();
		const batchId = Number(formData.get('batchId'));
		const reason = String(formData.get('reason') ?? '').trim();
		if (!Number.isInteger(batchId) || batchId <= 0) {
			return fail(400, { step: 'delete', message: 'Lote invalido.' });
		}
		if (!reason) {
			return fail(400, { step: 'delete', message: 'Indique el motivo de la eliminacion.' });
		}
		if (reason.length > 500) {
			return fail(400, { step: 'delete', message: 'El motivo es demasiado largo.' });
		}

		const auditContext = auditContextFromEvent(event);
		if (!auditContext) return fail(401, { message: 'Debe iniciar sesion.' });

		try {
			await deleteDraftBatch(batchId, reason, auditContext);
		} catch (error) {
			if (error instanceof DraftBatchDeleteError) {
				return fail(409, { step: 'delete', message: error.message });
			}
			throw error;
		}
		return { step: 'delete', message: `Lote #${batchId} eliminado.` };
	}
};
