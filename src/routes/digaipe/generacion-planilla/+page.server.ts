import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getTodayDateKey, searchActiveAdmissionsForPlanilla } from '$lib/server/admisiones/planilla';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(302, '/login');

	const search = url.searchParams.get('search')?.trim() ?? '';
	const today = getTodayDateKey();
	const admissions = await searchActiveAdmissionsForPlanilla(search, today);

	return {
		today,
		search,
		admissions
	};
};
