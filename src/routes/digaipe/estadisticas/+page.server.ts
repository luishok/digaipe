import {
	BREAKDOWN_TITLES,
	buildStatisticsReport,
	loadStatisticsOptions,
	parseStatisticsSpec
} from '$lib/server/admisiones/statistics';
import { GENERAL_COLUMNS } from '$lib/server/admisiones/statistics-export';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const { spec, errors } = parseStatisticsSpec(url);
	const [options, report] = await Promise.all([
		loadStatisticsOptions(),
		spec ? buildStatisticsReport(spec) : Promise.resolve(null)
	]);
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
