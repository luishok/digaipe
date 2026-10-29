import {
	BREAKDOWN_TITLES,
	buildStatisticsReport,
	loadStatisticsOptions,
	parseStatisticsSpec
} from '$lib/server/admisiones/statistics';
import { GENERAL_COLUMNS } from '$lib/server/admisiones/statistics-export';
import type { PageServerLoad } from './$types';
import { auditStudentDataView } from '$lib/server/audit';

export const load: PageServerLoad = async (event) => {
	const { url } = event;
	const { spec, errors } = parseStatisticsSpec(url);
	const [options, report] = await Promise.all([
		loadStatisticsOptions(),
		spec ? buildStatisticsReport(spec) : Promise.resolve(null)
	]);
	if (report) {
		const { search, ...filters } = report.spec.filters;
		await auditStudentDataView(event, {
			page: '/digaipe/estadisticas',
			recordType: 'admission',
			recordIds: report.rows.map((row) => row.admissionId),
			filters: { ...filters, reportMode: report.spec.reportMode, dateFrom: report.spec.dateFrom, dateTo: report.spec.dateTo },
			search
		});
	}
	return {
		options,
		spec,
		errors,
		report,
		exportQuery: url.searchParams.toString(),
		generalColumns: GENERAL_COLUMNS,
		breakdownTitles: [...BREAKDOWN_TITLES]
	};
};
