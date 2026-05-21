import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { admissionImportBatches } from '$lib/server/db/schema';
import { previewAdmissionFile, saveAdmissionBatch } from '$lib/server/admisiones/import';
import { and, eq } from 'drizzle-orm';

function parseBatchId(value: string) {
	const batchId = Number(value);
	if (!Number.isInteger(batchId) || batchId <= 0) {
		error(404, 'Lote invalido.');
	}
	return batchId;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) redirect(302, '/login');

	const batchId = parseBatchId(params.batchId);
	const [batch] = await db
		.select()
		.from(admissionImportBatches)
		.where(
			and(
				eq(admissionImportBatches.id, batchId),
				eq(admissionImportBatches.uploadedByUserId, locals.user.id)
			)
		)
		.limit(1);

	if (!batch) error(404, 'No existe el lote de admisiones.');

	try {
		const preview = await previewAdmissionFile(batch.sourceFilePath);

		if (batch.status === 'draft') {
			await db
				.update(admissionImportBatches)
				.set({
					rowCount: preview.rows.length,
					warningCount: preview.warnings.length,
					errorCount: preview.errors.length
				})
				.where(eq(admissionImportBatches.id, batch.id));
		}

		return { batch, preview };
	} catch (loadError) {
		error(500, loadError instanceof Error ? loadError.message : 'No se pudo previsualizar el lote.');
	}
};

export const actions: Actions = {
	save: async ({ request, locals, params }) => {
		if (!locals.user) return fail(401, { message: 'Debe iniciar sesion.' });

		const batchId = parseBatchId(params.batchId);
		const formData = await request.formData();
		const submittedBatchId = Number(formData.get('batchId'));
		if (submittedBatchId !== batchId) {
			return fail(400, { message: 'Lote invalido.' });
		}

		const [batch] = await db
			.select({ id: admissionImportBatches.id })
			.from(admissionImportBatches)
			.where(
				and(
					eq(admissionImportBatches.id, batchId),
					eq(admissionImportBatches.uploadedByUserId, locals.user.id)
				)
			)
			.limit(1);

		if (!batch) return fail(404, { message: 'No existe el lote de admisiones.' });

		try {
			const result = await saveAdmissionBatch(batchId);
			return {
				message: `Se guardaron ${result.rowCount} admisiones.`,
				...result
			};
		} catch (saveError) {
			return fail(400, {
				message: saveError instanceof Error ? saveError.message : 'No se pudo guardar el lote.'
			});
		}
	}
};
