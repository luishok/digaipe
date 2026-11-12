import {
	BREAKDOWN_TITLES,
	buildStatisticsReport,
	loadStatisticsOptions,
	parseStatisticsSpec
} from '$lib/server/admisiones/statistics';
import { filtersSummary, GENERAL_COLUMNS } from '$lib/server/admisiones/statistics-export';
import type { PageServerLoad } from './$types';
import { auditStudentDataView } from '$lib/server/audit';

/**
 * The on-screen preview renders every row twice (two tables); past a few hundred rows the
 * page payload and DOM get slow. The CSV/PDF exports always contain the full report.
 */
const PREVIEW_ROW_LIMIT = 500;

export const load: PageServerLoad = async (event) => {
	const { url } = event;
	const { spec, errors } = parseStatisticsSpec(url);
	const [options, fullReport] = await Promise.all([
		loadStatisticsOptions(),
		spec ? buildStatisticsReport(spec) : Promise.resolve(null)
	]);
	if (fullReport) {
		const { search, ...filters } = fullReport.spec.filters;
		await auditStudentDataView(event, {
			page: '/digaipe/estadisticas',
			recordType: 'admission',
			recordIds: fullReport.rows.map((row) => row.admissionId),
			filters: {
				...filters,
				reportMode: fullReport.spec.reportMode,
				dateFrom: fullReport.spec.dateFrom,
				dateTo: fullReport.spec.dateTo
			},
			search
		});
	}
	// Send each view only what it renders: general → rows, consolidado → pivot,
	// estadísticas → breakdowns. Unused parts were ~1 MB per 1-year report (perf test).
	const mode = fullReport?.spec.reportMode;
	const report = fullReport && {
		...fullReport,
		rows: mode === 'general' ? fullReport.rows.slice(0, PREVIEW_ROW_LIMIT) : [],
		pivot: mode === 'consolidado' ? fullReport.pivot : [],
		// The headline indicators always need the status counts, even if "Estado" is unchecked.
		statusCounts: fullReport.breakdowns['Estado'] ?? [],
		// Honor the "dimensions" checkboxes on screen, as the exports already do.
		breakdowns:
			mode === 'estadisticas'
				? Object.fromEntries(
						Object.entries(fullReport.breakdowns).filter(
							([title]) => !fullReport.spec.dimensions || fullReport.spec.dimensions.includes(title)
						)
					)
				: {}
	};
	const filters = spec?.filters;
	return {
		options,
		spec,
		errors,
		report,
		previewRowLimit: PREVIEW_ROW_LIMIT,
		/** Human-readable list of applied filters, same wording as the PDF header. */
		appliedFilters: spec ? filtersSummary(spec) : '',
		/** Keeps "Filtros avanzados" expanded when any of them is in effect. */
		hasAdvancedFilters: Boolean(
			filters &&
			(filters.search ||
				filters.process.length ||
				filters.period.length ||
				filters.modality.length ||
				filters.status.length ||
				filters.career.length ||
				filters.faculty.length)
		),
		exportQuery: url.searchParams.toString(),
		generalColumns: GENERAL_COLUMNS,
		breakdownTitles: [...BREAKDOWN_TITLES]
	};
};
