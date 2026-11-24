import { error } from '@sveltejs/kit';
import { AdmissionConflict, getClosure } from '$lib/server/admisiones/enrollment';
import { auditContextFromEvent, auditStudentDataView, writeAuditLog } from '$lib/server/audit';
import { db } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const id = Number(event.params.closureId);
	if (!Number.isInteger(id) || id <= 0) error(404, 'Informe no encontrado.');
	let closure;
	try { closure = await getClosure(id); }
	catch (cause) { if (cause instanceof AdmissionConflict) error(409, cause.message); throw cause; }
	if (!closure) error(404, 'Informe no encontrado.');
	await auditStudentDataView(event, { page: '/digaipe/estadisticas/cierres/[closureId]', recordType: 'admission',
		recordIds: closure.report.rows.flatMap((row) => row.offerIds), filters: { closureId: id } });
	const context = auditContextFromEvent(event);
	if (context) await writeAuditLog(db, context, { action: 'admission_process.closure_viewed', entityType: 'admission_process_closure',
		entityId: id, metadata: { sha256: closure.sha256, version: closure.version } });
	return { closure: { ...closure, report: { ...closure.report, rows: closure.report.rows.slice(0, 500) } } };
};
