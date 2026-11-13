import { error } from '@sveltejs/kit';
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
	readVerifiedBatchFile,
	type BatchFileRole
} from '$lib/server/admisiones/import';
import type { RequestHandler } from './$types';

const isRole = (value: string): value is BatchFileRole =>
	(BATCH_FILE_ROLES as readonly string[]).includes(value);

/** Content-Disposition with the original name, safe for any characters it may contain. */
function disposition(type: 'inline' | 'attachment', fileName: string) {
	const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
	return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export const GET: RequestHandler = async (event) => {
	const { locals, params, url } = event;
	if (!locals.user) error(401, 'Debe iniciar sesión.');
	if (!can(locals.user, 'admissions.view')) error(403, 'No tiene permiso para ver estos documentos.');
	const batchId = parseBatchId(params.batchId);
	if (!batchId || !isRole(params.role)) error(404, 'Documento no encontrado.');
	const batch = await findVisibleBatch(batchId, locals.user.id);
	if (!batch) error(404, 'No existe el lote o no tiene acceso a él.');
	const auditContext = auditContextFromEvent(event);
	if (!auditContext) error(401, 'Debe iniciar sesión.');

	const info = BATCH_FILE_INFO[params.role];
	const download = url.searchParams.has('descargar') || !info.viewable;
	let bytes: Buffer;
	try {
		bytes = await readVerifiedBatchFile(batch, params.role, auditContext);
	} catch (err) {
		if (err instanceof BatchIntegrityError) error(409, err.message);
		throw err;
	}

	await writeAuditLog(db, auditContext, {
		action: 'admission_import_batch.file_opened',
		entityType: 'admission_import_batch',
		entityId: batch.id,
		metadata: { file: params.role, mode: download ? 'download' : 'view' }
	});

	const fileName =
		params.role === 'source'
			? batch.sourceFileName
			: params.role === 'estadistica'
				? batch.estadisticaFileName
				: batch.manifestFileName;
	return new Response(new Uint8Array(bytes), {
		headers: {
			'content-type': info.contentType,
			'content-length': String(bytes.length),
			'content-disposition': disposition(download ? 'attachment' : 'inline', fileName),
			// Student data: never kept in a shared PC's cache. (No CSP `sandbox` here: Chrome
			// refuses to render PDFs in a sandboxed document. nosniff is set globally.)
			'cache-control': 'no-store'
		}
	});
};
