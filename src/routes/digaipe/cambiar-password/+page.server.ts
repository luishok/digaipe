import { fail, redirect } from '@sveltejs/kit';
import { and, eq, ne } from 'drizzle-orm';
import { auth } from '$lib/server/auth';
import {
	auditContextFromEvent,
	auditedTransaction,
	hashAuditIdentifier,
	writeAuditLog
} from '$lib/server/audit';
import { db } from '$lib/server/db';
import { account, session } from '$lib/server/db/schema';
import {
	recordSignInFailure,
	signInRetryAfter
} from '$lib/server/login-throttle';
import { clearPasswordChange, mustChangePassword } from '$lib/server/password-change';
import type { Actions, PageServerLoad } from './$types';

const field = (data: FormData, key: string) => {
	const value = data.get(key);
	return typeof value === 'string' ? value : '';
};

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	const authContext = await auth.$context;
	return {
		required: await mustChangePassword(locals.user.id),
		minPasswordLength: authContext.password.config.minPasswordLength,
		maxPasswordLength: authContext.password.config.maxPasswordLength
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { user: currentUser, session: currentSession } = event.locals;
		const context = auditContextFromEvent(event);
		if (!currentUser || !currentSession || !context)
			return fail(401, { message: 'Debe iniciar sesión.' });

		// Same counters as /login, so this form cannot be used to guess the current password
		// around the sign-in throttle.
		const throttleKeys = {
			account: hashAuditIdentifier(currentUser.email),
			ip: event.getClientAddress()
		};
		const retryAfterMs = signInRetryAfter(throttleKeys);
		if (retryAfterMs > 0)
			return fail(429, {
				message: `Demasiados intentos fallidos. Intente nuevamente en ${Math.ceil(retryAfterMs / 60000)} minuto(s).`
			});

		const data = await event.request.formData();
		const currentPassword = field(data, 'currentPassword');
		const newPassword = field(data, 'newPassword');
		const confirmPassword = field(data, 'confirmPassword');

		const authContext = await auth.$context;
		const { minPasswordLength, maxPasswordLength } = authContext.password.config;
		if (newPassword.length < minPasswordLength || newPassword.length > maxPasswordLength)
			return fail(400, {
				message: `La nueva contraseña debe tener entre ${minPasswordLength} y ${maxPasswordLength} caracteres.`
			});
		if (newPassword !== confirmPassword)
			return fail(400, { message: 'La confirmación no coincide con la nueva contraseña.' });
		if (newPassword === currentPassword)
			return fail(400, { message: 'La nueva contraseña debe ser distinta de la actual.' });

		const credential = and(
			eq(account.userId, currentUser.id),
			eq(account.providerId, 'credential')
		);
		const newHash = await authContext.password.hash(newPassword);

		const wasRequired = await mustChangePassword(currentUser.id);
		let outcome: 'changed' | 'wrong-password' | 'no-account';
		try {
			outcome = await auditedTransaction(context, async (tx) => {
				const [row] = await tx
					.select({ password: account.password })
					.from(account)
					.where(credential)
					.for('update');
				if (!row?.password) return 'no-account';
				const valid = await authContext.password.verify({
					hash: row.password,
					password: currentPassword
				});
				if (!valid) return 'wrong-password';

				await tx.update(account).set({ password: newHash }).where(credential);
				await clearPasswordChange(tx, currentUser.id);
				// Keep this browser signed in; end every other session of this user.
				await tx
					.delete(session)
					.where(and(eq(session.userId, currentUser.id), ne(session.id, currentSession.id)));
				await writeAuditLog(tx, context, {
					action: 'user.password_changed',
					entityType: 'user',
					entityId: currentUser.id,
					metadata: { forced: wasRequired, otherSessionsRevoked: true }
				});
				return 'changed';
			});
		} catch {
			return fail(500, { message: 'No se pudo cambiar la contraseña. Intente nuevamente.' });
		}

		if (outcome === 'no-account')
			return fail(400, { message: 'Esta cuenta no tiene contraseña configurada.' });
		if (outcome === 'wrong-password') {
			recordSignInFailure(throttleKeys);
			await writeAuditLog(db, context, {
				action: 'user.password_change_failed',
				entityType: 'user',
				entityId: currentUser.id,
				metadata: { reason: 'wrong_current_password' },
				outcome: 'failure'
			});
			return fail(400, { message: 'La contraseña actual es incorrecta.' });
		}

		if (wasRequired) redirect(303, '/digaipe');
		return { success: 'Contraseña actualizada.' };
	}
};
