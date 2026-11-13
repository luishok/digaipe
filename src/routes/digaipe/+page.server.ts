import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import type { PageServerLoad } from './$types';
import { desc, eq, isNotNull } from 'drizzle-orm';
import { can } from '$lib/permissions';
import { auth } from '$lib/server/auth';
import { auditStudentDataView } from '$lib/server/audit';
import { db } from '$lib/server/db';
import { admissions, careers, students } from '$lib/server/db/schema';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}
	const user = event.locals.user;

	// "Últimos aspirantes registrados": the most recently saved admissions, only for users who
	// may see admissions. Names and cédulas are student data, so the view is audited.
	let ultimosAspirantes: {
		id: number;
		nombre: string;
		cedula: string;
		carrera: string | null;
		fechaAsignacion: Date;
	}[] = [];
	if (can(user, 'admissions.view')) {
		ultimosAspirantes = await db
			.select({
				id: admissions.id,
				nombre: students.apellidos_nombres,
				cedula: students.cedula,
				carrera: careers.todo,
				fechaAsignacion: admissions.fechaAsignacion
			})
			.from(admissions)
			.innerJoin(students, eq(admissions.studentId, students.id))
			.innerJoin(careers, eq(admissions.careerId, careers.id))
			.where(isNotNull(admissions.importBatchId))
			.orderBy(desc(admissions.id))
			.limit(3);
		if (ultimosAspirantes.length) {
			await auditStudentDataView(event, {
				page: '/digaipe',
				recordType: 'admission',
				recordIds: ultimosAspirantes.map((row) => row.id)
			});
		}
	}

	return { user, ultimosAspirantes };
};

export const actions: Actions = {
	signOut: async (event) => {
		await auth.api.signOut({
			headers: event.request.headers
		});
		return redirect(302, '/');
	}
};
