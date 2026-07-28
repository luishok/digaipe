import { buildStatisticsCsv, makeFolio } from '$lib/server/admisiones/statistics-export';
import {
	buildStatisticsReport,
	exportFileStem,
	parseStatisticsSpec
} from '$lib/server/admisiones/statistics';
import { auditContextFromEvent, writeAuditLog } from '$lib/server/audit';
import { db } from '$lib/server/db';
import { error, type RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Debe iniciar sesión.');
	const { spec, errors } = parseStatisticsSpec(event.url);
	if (!spec) error(400, errors.join(' '));
	const report = await buildStatisticsReport(spec);
	const auditContext = auditContextFromEvent(event);
	if (!auditContext) error(401, 'Debe iniciar sesión.');
	const folio = makeFolio();
	await writeAuditLog(db, auditContext, {
		action: 'admission_statistics.exported',
		entityType: 'admission_statistics',
		entityId: 'csv',
		metadata: {
			format: 'csv',
			folio,
			reportMode: spec.reportMode,
			dateBasis: spec.dateBasis,
			dateFrom: spec.dateFrom,
			dateTo: spec.dateTo,
			filters: spec.filters,
			includeStudentData: spec.includeStudentData,
			admissionCount: report.totalAdmissions,
			uniqueStudentCount: report.totalUniqueStudents
		}
	});
	return new Response(buildStatisticsCsv(report, { folio }), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': `attachment; filename="${exportFileStem(report)}.csv"`,
			'cache-control': 'no-store'
		}
	});
};
