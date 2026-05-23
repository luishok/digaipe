import { auth } from '$lib/server/auth';
import { auditContextFromEvent, writeAuditLog } from '$lib/server/audit';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, request }) => {
    if (!locals.user) redirect(302, '/login');
    if (locals.user.role !== 'admin') redirect(302, '/digiape');

    const { users } = await auth.api.listUsers({
        headers: request.headers,
        query: { limit: 100 },
    });

    return {
        users: users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role ?? 'user',
            createdAt: u.createdAt,
        })),
        currentUserId: locals.user.id,
    };
};

export const actions: Actions = {
    setRole: async (event) => {
        const { request, locals } = event;
        if (!locals.user || locals.user.role !== 'admin') {
            return fail(403, { message: 'Forbidden' });
        }
        const auditContext = auditContextFromEvent(event);
        if (!auditContext) return fail(401, { message: 'Debe iniciar sesion.' });

        const data = await request.formData();
        const userId = data.get('userId') as string;
        const role = data.get('role') as string;

        if (!userId || (role !== 'user' && role !== 'admin')) {
            return fail(400, { message: 'Invalid input' });
        }

        if (userId === locals.user.id) {
            return fail(400, { message: "You can't change your own role" });
        }

        const [targetUser] = await db
            .select({ id: user.id, role: user.role })
            .from(user)
            .where(eq(user.id, userId))
            .limit(1);
        if (!targetUser) return fail(404, { message: 'User not found' });

        await auth.api.setRole({
            headers: request.headers,
            body: { userId, role },
        });

        await writeAuditLog(db, auditContext, {
            action: 'user_role.changed',
            entityType: 'user',
            entityId: userId,
            before: { role: targetUser.role ?? 'user' },
            after: { role },
            metadata: { targetUserId: userId }
        });

        return { success: true };
    },
};
