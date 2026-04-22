import { auth } from '$lib/server/auth';
import { fail, redirect } from '@sveltejs/kit';
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
    setRole: async ({ request, locals }) => {
        if (!locals.user || locals.user.role !== 'admin') {
            return fail(403, { message: 'Forbidden' });
        }

        const data = await request.formData();
        const userId = data.get('userId') as string;
        const role = data.get('role') as string;

        if (!userId || !['user', 'admin'].includes(role)) {
            return fail(400, { message: 'Invalid input' });
        }

        if (userId === locals.user.id) {
            return fail(400, { message: "You can't change your own role" });
        }

        await auth.api.setRole({
            headers: request.headers,
            body: { userId, role },
        });

        return { success: true };
    },
};