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

export const load: PageServerLoad = async (event) => {
	if (event.locals.user) {
		return redirect(302, '/demo/better-auth');
	}
	return {};
};

export const actions: Actions = {
	signInEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		try {
			await auth.api.signInEmail({
				body: {
					email,
					password,
					callbackURL: '/auth/verification-success'
				}
			});
		} catch (error) {
			await writeAuditLog(db, anonymousAuditContextFromEvent(event), {
				action: 'auth.sign_in_failed',
				entityType: 'authentication',
				entityId: hashAuditIdentifier(email),
				metadata: { identifierHash: hashAuditIdentifier(email) },
				outcome: 'failure'
			});
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Signin failed' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		await writeAuditLog(db, anonymousAuditContextFromEvent(event), {
			action: 'auth.sign_in_succeeded',
			entityType: 'authentication',
			entityId: hashAuditIdentifier(email),
			metadata: { identifierHash: hashAuditIdentifier(email) }
		});

		return redirect(302, '/demo/better-auth');
	},
	signUpEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const name = formData.get('name')?.toString() ?? '';

		try {
			await auth.api.signUpEmail({
				body: {
					email,
					password,
					name,
					callbackURL: '/auth/verification-success'
				}
			});
		} catch (error) {
			await writeAuditLog(db, anonymousAuditContextFromEvent(event), {
				action: 'auth.sign_up_failed',
				entityType: 'authentication',
				entityId: hashAuditIdentifier(email),
				metadata: { identifierHash: hashAuditIdentifier(email) },
				outcome: 'failure'
			});
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Registration failed' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		await writeAuditLog(db, anonymousAuditContextFromEvent(event), {
			action: 'auth.sign_up_succeeded',
			entityType: 'authentication',
			entityId: hashAuditIdentifier(email),
			metadata: { identifierHash: hashAuditIdentifier(email) }
		});

		return redirect(302, '/demo/better-auth');
	}
};
