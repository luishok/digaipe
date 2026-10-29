import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { auditContextFromEvent, writeAuditLog } from '$lib/server/audit';
import { db } from '$lib/server/db';

export const load: PageServerLoad = async (event) => {
	// Si el usuario YA está logueado en la raíz, lo mandamos a /digaipe
	if (event.locals.user) {
		throw redirect(302, '/digaipe');
	}
	
	// Si NO está logueado, dejamos que cargue la landing page normalmente
	return {};
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