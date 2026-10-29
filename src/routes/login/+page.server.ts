import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';
import {
	anonymousAuditContextFromEvent,
	hashAuditIdentifier,
	writeAuditLog
} from '$lib/server/audit';
import { db } from '$lib/server/db';
import {
	clearSignInFailures,
	recordSignInFailure,
	signInRetryAfter
} from '$lib/server/login-throttle';

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		return redirect(302, '/digaipe');
	}
	return {};
};

export const actions: Actions = {
	signInEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const identifierHash = hashAuditIdentifier(email);
		const throttleKeys = { account: identifierHash, ip: event.getClientAddress() };

		const retryAfterMs = signInRetryAfter(throttleKeys);
		if (retryAfterMs > 0) {
			await writeAuditLog(db, anonymousAuditContextFromEvent(event), {
				action: 'auth.sign_in_blocked',
				entityType: 'authentication',
				entityId: identifierHash,
				metadata: { identifierHash, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) },
				outcome: 'denied'
			});
			return fail(429, {
				message: `Demasiados intentos fallidos. Intente nuevamente en ${Math.ceil(retryAfterMs / 60000)} minuto(s).`
			});
		}

		try {
			await auth.api.signInEmail({
				body: {
					email,
					password,
					callbackURL: '/auth/verification-success'
				}
			});
		} catch (error) {
			recordSignInFailure(throttleKeys);
			await writeAuditLog(db, anonymousAuditContextFromEvent(event), {
				action: 'auth.sign_in_failed',
				entityType: 'authentication',
				entityId: identifierHash,
				metadata: { identifierHash },
				outcome: 'failure'
			});
			if (error instanceof APIError) {
				return fail(400, {
					message:
						error.body?.code === 'INVALID_EMAIL_OR_PASSWORD'
							? 'Correo o contraseña incorrectos.'
							: 'No se pudo iniciar sesión.'
				});
			}
			return fail(500, { message: 'Error inesperado.' });
		}

		clearSignInFailures(throttleKeys);
		await writeAuditLog(db, anonymousAuditContextFromEvent(event), {
			action: 'auth.sign_in_succeeded',
			entityType: 'authentication',
			entityId: identifierHash,
			metadata: { identifierHash }
		});

		return redirect(302, '/digaipe');
	}
};
