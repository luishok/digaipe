import { error, redirect } from '@sveltejs/kit';
import { can } from '$lib/permissions';
import { auditContextFromEvent, writeAuditLog } from '$lib/server/audit';
import { db } from '$lib/server/db';
import {
	BATCH_FILE_INFO,
	findVisibleBatch,
	parseBatchId
} from '$lib/server/admisiones/batch-documents';
import {
	BATCH_FILE_ROLES,
	BatchIntegrityError,
	readSheetForDisplay,
	readVerifiedBatchFile
} from '$lib/server/admisiones/import';
import type { PageServerLoad } from './$types';

// Enough for any real listing (batches so far are a few hundred rows) without sending
// megabytes of HTML; the full file is always one click away.
const MAX_ROWS = 2000;

export const load: PageServerLoad = async (event) => {
	const { locals, params } = event;
	if (!locals.user) redirect(302, '/login');
	if (!can(locals.user, 'admissions.view')) redirect(302, '/digaipe');
	const batchId = parseBatchId(params.batchId);
	if (!batchId) error(404, 'Lote inválido.');
	const batch = await findVisibleBatch(batchId, locals.user.id);
	if (!batch) error(404, 'No existe el lote o no tiene acceso a él.');
	const auditContext = auditContextFromEvent(event);
	if (!auditContext) redirect(302, '/login');

	let sheet: ReturnType<typeof readSheetForDisplay> | null = null;
	let integrityError: string | null = null;
	try {
		sheet = readSheetForDisplay(await readVerifiedBatchFile(batch, 'source', auditContext), MAX_ROWS);
	} catch (err) {
		if (!(err instanceof BatchIntegrityError)) throw err;
		integrityError = err.message;
	}

	// The listing holds student data: record who looked at which batch, before returning it.
	await writeAuditLog(db, auditContext, {
		action: 'admission_import_batch.documents_viewed',
		entityType: 'admission_import_batch',
		entityId: batch.id,
		metadata: { rowsShown: sheet?.rows.length ?? 0, totalRows: sheet?.totalRows ?? 0 }
	});

	const hashes = {
		source: batch.sourceFileSha256,
		estadistica: batch.estadisticaFileSha256,
		manifest: batch.manifestFileSha256
	};
	const names = {
		source: batch.sourceFileName,
		estadistica: batch.estadisticaFileName,
		manifest: batch.manifestFileName
	};
	return {
		batch: {
			id: batch.id,
			status: batch.status,
			rowCount: batch.rowCount,
			createdAt: batch.createdAt,
			savedAt: batch.savedAt,
			uploadedByName: batch.uploadedByName
		},
		files: BATCH_FILE_ROLES.map((role) => ({
			role,
			label: BATCH_FILE_INFO[role].label,
			viewable: BATCH_FILE_INFO[role].viewable,
			fileName: names[role],
			sha256: hashes[role]
		})),
		sheet,
		maxRows: MAX_ROWS,
		integrityError
	};
};
