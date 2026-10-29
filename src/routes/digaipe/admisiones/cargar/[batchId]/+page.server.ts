import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { admissionImportBatches } from '$lib/server/db/schema';
import {
	BatchIntegrityError,
	previewAdmissionFile,
	readVerifiedBatchSource,
	saveAdmissionBatch
} from '$lib/server/admisiones/import';
import { auditContextFromEvent, auditedTransaction } from '$lib/server/audit';
import { and, eq } from 'drizzle-orm';

function parseBatchId(value: string) {
	const batchId = Number(value);
	if (!Number.isInteger(batchId) || batchId <= 0) {
		error(404, 'Lote invalido.');
	}
	return batchId;
}

export const load: PageServerLoad = async (event) => {
	const { locals, params } = event;
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
	const auditContext = auditContextFromEvent(event);
	if (!auditContext) redirect(302, '/login');

	try {
		const preview = await previewAdmissionFile(await readVerifiedBatchSource(batch, auditContext));

		const countsChanged =
			batch.rowCount !== preview.rows.length ||
			batch.warningCount !== preview.warnings.length ||
			batch.errorCount !== preview.errors.length;
		// Only write when the counts moved: the table is trigger-audited, so an unconditional
		// update would add a ledger row on every page view.
		if (batch.status === 'draft' && countsChanged) {
			await auditedTransaction(auditContext, (tx) =>
				tx
					.update(admissionImportBatches)
					.set({
						rowCount: preview.rows.length,
						warningCount: preview.warnings.length,
						errorCount: preview.errors.length
					})
					.where(eq(admissionImportBatches.id, batch.id))
			);
		}

		// Server-side file paths stay on the server.
		const {
			sourceFilePath: _source,
			estadisticaFilePath: _estadistica,
			manifestFilePath: _manifest,
			...visibleBatch
		} = batch;
		return { batch: visibleBatch, preview };
	} catch (loadError) {
		if (loadError instanceof BatchIntegrityError) error(409, loadError.message);
		error(
			500,
			loadError instanceof Error ? loadError.message : 'No se pudo previsualizar el lote.'
		);
	}
};

export const actions: Actions = {
	save: async (event) => {
		const { request, locals, params } = event;
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
			const auditContext = auditContextFromEvent(event);
			if (!auditContext) return fail(401, { message: 'Debe iniciar sesion.' });

			const result = await saveAdmissionBatch(batchId, auditContext);
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
