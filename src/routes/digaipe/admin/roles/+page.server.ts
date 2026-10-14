import { randomUUID } from 'node:crypto';
import { auth } from '$lib/server/auth';
import {
	auditContextFromEvent,
	setAuditDatabaseContext,
	writeAuditLog,
	type AuditContext
} from '$lib/server/audit';
import { db } from '$lib/server/db';
import { account, session, user } from '$lib/server/db/schema';
import { fail, redirect, type ActionFailure } from '@sveltejs/kit';
import { and, count, desc, eq, like, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const pageSize = 25;
type UserActionData = {
	message?: string;
	success?: string;
	values?: { name: string; email: string; role: string };
};
type UserActionResult = Promise<UserActionData | ActionFailure<UserActionData>>;
const isRole = (value: string): value is 'user' | 'admin' => value === 'user' || value === 'admin';
const field = (data: FormData, key: string) => {
	const value = data.get(key);
	return typeof value === 'string' ? value : '';
};

function databaseErrorCode(error: unknown): string | undefined {
	if (!error || typeof error !== 'object') return;
	if ('code' in error && typeof error.code === 'string') return error.code;
	if ('cause' in error) return databaseErrorCode(error.cause);
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function userTransaction<T>(
	context: AuditContext,
	operation: (tx: Transaction) => Promise<T>
) {
	return db.transaction(async (tx) => {
		await setAuditDatabaseContext(tx, context);
		try {
			return await operation(tx);
		} finally {
			// MySQL session variables survive rollback and pooled connection reuse.
			await tx.execute(sql`SET @digaipe_audit_actor_user_id = NULL,
				@digaipe_audit_actor_name = NULL, @digaipe_audit_actor_email = NULL,
				@digaipe_audit_correlation_id = NULL`);
		}
	});
}

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(302, '/login');
	if (locals.user.role !== 'admin') redirect(302, '/digaipe');
	const search = (url.searchParams.get('search') ?? '').trim().slice(0, 255);
	const role = url.searchParams.get('role') ?? '';
	const where = and(
		search ? like(user.email, `%${search}%`) : undefined,
		isRole(role) ? eq(user.role, role) : undefined
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
		if (!event.locals.user || event.locals.user.role !== 'admin')
			return fail(403, { message: 'No tiene permisos para administrar usuarios.' });
		const context = auditContextFromEvent(event);
		if (!context) return fail(401, { message: 'Debe iniciar sesión.' });
		const data = await event.request.formData();
		const name = field(data, 'name').trim();
		const email = field(data, 'email').trim().toLowerCase();
		const password = field(data, 'password');
		const role = field(data, 'role');
		const values = { name, email, role };
		if (
			!name ||
			name.length > 255 ||
			email.length > 255 ||
			!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
			!isRole(role)
		) {
			return fail(400, { message: 'Ingrese un nombre, correo electrónico y rol válidos.', values });
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
			await userTransaction(context, async (tx) => {
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
		if (!event.locals.user || event.locals.user.role !== 'admin')
			return fail(403, { message: 'No tiene permisos para administrar usuarios.' });
		const context = auditContextFromEvent(event);
		if (!context) return fail(401, { message: 'Debe iniciar sesión.' });
		const data = await event.request.formData();
		const userId = field(data, 'userId');
		const role = field(data, 'role');
		if (!userId || !isRole(role))
			return fail(400, { message: 'Seleccione un usuario y un rol válidos.' });
		if (userId === event.locals.user.id)
			return fail(400, { message: 'No puede cambiar su propio rol.' });
		try {
			return await userTransaction(context, async (tx) => {
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
					before: { role: target.role ?? 'user' },
					after: { role }
				});
				return { success: 'Rol actualizado. El usuario deberá iniciar sesión nuevamente.' };
			});
		} catch {
			return fail(500, { message: 'No se pudo actualizar el rol. Intente nuevamente.' });
		}
	},
	delete: async (event): UserActionResult => {
		if (!event.locals.user || event.locals.user.role !== 'admin')
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
			return await userTransaction(context, async (tx) => {
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
