import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { auditStudentDataView } from '$lib/server/audit';
import {
	buildLegacyPlanillaFields,
	getTodayDateKey,
	searchActiveAdmissionsForPlanilla
} from '$lib/server/admisiones/planilla';

export const load: PageServerLoad = async (event) => {
	const { locals, url } = event;
	if (!locals.user) redirect(302, '/login');

	const search = url.searchParams.get('search')?.trim() ?? '';
	const today = getTodayDateKey();
	const admissions = await searchActiveAdmissionsForPlanilla(search, today);

	await auditStudentDataView(event, {
		page: '/digaipe/generacion-planilla',
		recordType: 'admission',
		recordIds: admissions.map((admission) => admission.id),
		filters: { today },
		search
	});

	return {
		today,
		search,
		// The same fields the detail page shows, for the "Generar planilla" check-and-generate modal.
		admissions: admissions.map((admission) => ({
			...admission,
			planilla: buildLegacyPlanillaFields(admission)
		}))
	};
};
