import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { auditContextFromEvent, writeAuditLog } from '$lib/server/audit';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}
	return { user: event.locals.user };
};

export const actions: Actions = {
	signOut: async (event) => {
		const auditContext = auditContextFromEvent(event);
		if (auditContext) {
			await writeAuditLog(db, auditContext, {
				action: 'auth.sign_out',
				entityType: 'session',
				entityId: event.locals.session?.id ?? event.locals.user?.id ?? 'unknown'
			});
		}
		await auth.api.signOut({
			headers: event.request.headers
		});
		return redirect(302, '/');
	}
};
