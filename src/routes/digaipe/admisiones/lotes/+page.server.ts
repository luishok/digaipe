import { redirect } from '@sveltejs/kit';
import { can } from '$lib/permissions';
import { countVisibleBatches, listVisibleBatches } from '$lib/server/admisiones/batch-documents';
import type { PageServerLoad } from './$types';

const pageSize = 25;

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(302, '/login');
	if (!can(locals.user, 'admissions.view')) redirect(302, '/digaipe');
	const total = await countVisibleBatches(locals.user.id);
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const requested = Number(url.searchParams.get('page') ?? 1);
	const page = Number.isSafeInteger(requested) ? Math.min(totalPages, Math.max(1, requested)) : 1;
	const batches = await listVisibleBatches(locals.user.id, {
		limit: pageSize,
		offset: (page - 1) * pageSize
	});
	return { batches, total, page, totalPages };
};
