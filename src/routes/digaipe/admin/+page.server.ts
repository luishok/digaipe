import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { can } from '$lib/permissions';

export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	const canManageUsers = can(locals.user, 'users.manage');
	const canViewAudit = can(locals.user, 'audit.view');
	if (!canManageUsers && !canViewAudit) redirect(302, '/digaipe');
	return { canManageUsers, canViewAudit };
};
