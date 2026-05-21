import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { admissionImportBatches } from '$lib/server/db/schema';
import { createDraftBatch, saveAdmissionBatch } from '$lib/server/admisiones/import';
import { desc, eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');

	const recentBatches = await db
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
			savedAt: admissionImportBatches.savedAt
		})
		.from(admissionImportBatches)
		.where(eq(admissionImportBatches.uploadedByUserId, locals.user.id))
		.orderBy(desc(admissionImportBatches.createdAt))
		.limit(10);

	return { recentBatches };
};

export const actions: Actions = {
	preview: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Debe iniciar sesion.' });

		try {
			const formData = await request.formData();
			const result = await createDraftBatch(formData, locals.user.id);
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

	save: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Debe iniciar sesion.' });

		const formData = await request.formData();
		const batchId = Number(formData.get('batchId'));
		if (!Number.isInteger(batchId) || batchId <= 0) {
			return fail(400, { step: 'save', message: 'Lote invalido.' });
		}

		try {
			const result = await saveAdmissionBatch(batchId);
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
	}
};
