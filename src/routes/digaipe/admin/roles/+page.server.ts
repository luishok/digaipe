import { randomUUID } from 'node:crypto';
import { auth } from '$lib/server/auth';
import {
	auditContextFromEvent,
	auditedTransaction,
	writeAuditLog
} from '$lib/server/audit';
import { db } from '$lib/server/db';
import { account, session, user } from '$lib/server/db/schema';
import { fail, redirect, type ActionFailure } from '@sveltejs/kit';
import { and, count, desc, eq, like, sql } from 'drizzle-orm';
import { can, formatRoles, parseRoles, ROLES, type Role } from '$lib/permissions';
import type { Actions, PageServerLoad } from './$types';

const pageSize = 25;
type UserActionData = {
	message?: string;
	success?: string;
	values?: { name: string; email: string; roles: Role[] };
};
type UserActionResult = Promise<UserActionData | ActionFailure<UserActionData>>;
const isRole = (value: string): value is Role => (ROLES as readonly string[]).includes(value);
// Checked boxes named "roles"; unknown values are dropped. Stored comma-separated.
const submittedRoles = (data: FormData) => parseRoles(formatRoles(data.getAll('roles').map(String)));
const field = (data: FormData, key: string) => {
	const value = data.get(key);
	return typeof value === 'string' ? value : '';
};

function databaseErrorCode(error: unknown): string | undefined {
	if (!error || typeof error !== 'object') return;
	if ('code' in error && typeof error.code === 'string') return error.code;
	if ('cause' in error) return databaseErrorCode(error.cause);
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(302, '/login');
	if (!can(locals.user, 'users.manage')) redirect(302, '/digaipe');
	const search = (url.searchParams.get('search') ?? '').trim().slice(0, 255);
	const role = url.searchParams.get('role') ?? '';
	const where = and(
		search ? like(user.email, `%${search}%`) : undefined,
		isRole(role) ? sql`FIND_IN_SET(${role}, ${user.role}) > 0` : undefined
	);
	const [result] = await db.select({ total: count() }).from(user).where(where);
	const totalPages = Math.max(1, Math.ceil(result.total / pageSize));
	const requestedPage = Number(url.searchParams.get('page') ?? 1);
	const page = Number.isSafeInteger(requestedPage)
		? Math.min(totalPages, Math.max(1, requestedPage))
		: 1;
	const users = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			createdAt: user.createdAt
		})
		.from(user)
		.where(where)
		.orderBy(desc(user.createdAt), user.id)
		.limit(pageSize)
		.offset((page - 1) * pageSize);
	return {
		users,
		currentUserId: locals.user.id,
		total: result.total,
		page,
		totalPages,
		search,
		role: isRole(role) ? role : ''
	};
};

export const actions: Actions = {
	create: async (event): UserActionResult => {
		if (!can(event.locals.user, 'users.manage'))
			return fail(403, { message: 'No tiene permisos para administrar usuarios.' });
		const context = auditContextFromEvent(event);
		if (!context) return fail(401, { message: 'Debe iniciar sesión.' });
		const data = await event.request.formData();
		const name = field(data, 'name').trim();
		const email = field(data, 'email').trim().toLowerCase();
		const password = field(data, 'password');
		const roles = submittedRoles(data);
		const role = formatRoles(roles);
		const values = { name, email, roles };
		if (
			!name ||
			name.length > 255 ||
			email.length > 255 ||
			!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
			!roles.length
		) {
			return fail(400, {
				message: 'Ingrese un nombre, un correo electrónico válido y al menos un rol.',
				values
			});
		}
		const authContext = await auth.$context;
		const { minPasswordLength, maxPasswordLength } = authContext.password.config;
		if (password.length < minPasswordLength || password.length > maxPasswordLength) {
			return fail(400, {
				message: `La contraseña debe tener entre ${minPasswordLength} y ${maxPasswordLength} caracteres.`,
				values
			});
		}
		// Keep credentials and the audit event atomic, using Better Auth's configured hasher.
		const hashedPassword = await authContext.password.hash(password);
		const userId = randomUUID();
		try {
			await auditedTransaction(context, async (tx) => {
				await tx.insert(user).values({ id: userId, name, email, role });
				await tx.insert(account).values({
					id: randomUUID(),
					userId,
					accountId: userId,
					providerId: 'credential',
					password: hashedPassword
				});
				await writeAuditLog(tx, context, {
					action: 'user.created',
					entityType: 'user',
					entityId: userId,
					after: { name, email, role }
				});
			});
		} catch (error) {
			return fail(databaseErrorCode(error) === 'ER_DUP_ENTRY' ? 409 : 500, {
				message:
					databaseErrorCode(error) === 'ER_DUP_ENTRY'
						? 'Ya existe un usuario con ese correo electrónico.'
						: 'No se pudo crear el usuario. Intente nuevamente.',
				values
			});
		}
		return { success: 'Usuario creado correctamente.' };
	},
	setRole: async (event): UserActionResult => {
		if (!event.locals.user || !can(event.locals.user, 'users.manage'))
			return fail(403, { message: 'No tiene permisos para administrar usuarios.' });
		const context = auditContextFromEvent(event);
		if (!context) return fail(401, { message: 'Debe iniciar sesión.' });
		const data = await event.request.formData();
		const userId = field(data, 'userId');
		const role = formatRoles(submittedRoles(data));
		if (!userId || !role)
			return fail(400, { message: 'Seleccione un usuario y al menos un rol.' });
		if (userId === event.locals.user.id)
			return fail(400, { message: 'No puede cambiar sus propios roles.' });
		try {
			return await auditedTransaction(context, async (tx) => {
				const [target] = await tx
					.select({ role: user.role })
					.from(user)
					.where(eq(user.id, userId))
					.for('update');
				if (!target) return fail(404, { message: 'Usuario no encontrado.' });
				await tx.update(user).set({ role }).where(eq(user.id, userId));
				await tx.delete(session).where(eq(session.userId, userId));
				await writeAuditLog(tx, context, {
					action: 'user_role.changed',
					entityType: 'user',
					entityId: userId,
					before: { role: target.role ?? null },
					after: { role }
				});
				return { success: 'Roles actualizados. El usuario deberá iniciar sesión nuevamente.' };
			});
		} catch {
			return fail(500, { message: 'No se pudo actualizar el rol. Intente nuevamente.' });
		}
	},
	delete: async (event): UserActionResult => {
		if (!event.locals.user || !can(event.locals.user, 'users.manage'))
			return fail(403, { message: 'No tiene permisos para administrar usuarios.' });
		const context = auditContextFromEvent(event);
		if (!context) return fail(401, { message: 'Debe iniciar sesión.' });
		const data = await event.request.formData();
		const userId = field(data, 'userId');
		if (!userId || field(data, 'confirm') !== userId)
			return fail(400, { message: 'Confirme la eliminación del usuario.' });
		if (userId === event.locals.user.id)
			return fail(400, { message: 'No puede eliminar su propia cuenta.' });
		try {
			return await auditedTransaction(context, async (tx) => {
				const [target] = await tx
					.select({ name: user.name, email: user.email, role: user.role })
					.from(user)
					.where(eq(user.id, userId))
					.for('update');
				if (!target) return fail(404, { message: 'Usuario no encontrado.' });
				// Foreign keys preserve admission history; credential accounts and sessions cascade.
				await tx.delete(user).where(eq(user.id, userId));
				await writeAuditLog(tx, context, {
					action: 'user.deleted',
					entityType: 'user',
					entityId: userId,
					before: target
				});
				return { success: 'Usuario eliminado correctamente.' };
			});
		} catch (error) {
			if (databaseErrorCode(error) === 'ER_ROW_IS_REFERENCED_2')
				return fail(409, {
					message:
						'No se puede eliminar este usuario porque tiene registros de admisiones o auditoría asociados.'
				});
			return fail(500, { message: 'No se pudo eliminar el usuario. Intente nuevamente.' });
		}
	}
};
