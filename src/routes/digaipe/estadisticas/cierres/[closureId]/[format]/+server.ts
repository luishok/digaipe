import { error } from '@sveltejs/kit';
import { AdmissionConflict, getClosure } from '$lib/server/admisiones/enrollment';
import { buildEnrollmentCsv, buildEnrollmentPdf } from '$lib/server/admisiones/enrollment-export';
import { auditContextFromEvent, writeAuditLog } from '$lib/server/audit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const id = Number(event.params.closureId);
	const format = event.params.format;
	if (!Number.isInteger(id) || id <= 0 || !['csv', 'pdf'].includes(format)) error(404, 'Informe no encontrado.');
	let closure;
	try { closure = await getClosure(id); }
	catch (cause) { if (cause instanceof AdmissionConflict) error(409, cause.message); throw cause; }
	if (!closure) error(404, 'Informe no encontrado.');
	const context = auditContextFromEvent(event);
	if (!context) error(401, 'Debe iniciar sesión.');
	const meta = { title: `Informe oficial de cierre · versión ${closure.version}`, sha256: closure.sha256,
		folio: `CIERRE-${id}-V${closure.version}`, generatedBy: event.locals.user?.name };
	await writeAuditLog(db, context, { action: 'admission_statistics.exported', entityType: 'admission_process_closure',
		entityId: id, metadata: { format, version: closure.version, sha256: closure.sha256 } });
	const content = format === 'csv' ? buildEnrollmentCsv(closure.report, true, meta) : await buildEnrollmentPdf(closure.report, true, meta);
	const body = typeof content === 'string' ? content : content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
	return new Response(body, { headers: {
		'content-type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/pdf',
		'content-disposition': `attachment; filename="digaipe_cierre_${id}_v${closure.version}.${format}"`,
		'cache-control': 'no-store'
	} });
};
