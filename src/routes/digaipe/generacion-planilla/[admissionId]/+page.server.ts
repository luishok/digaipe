import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auditContextFromEvent, writeAuditLog } from '$lib/server/audit';
import {
	buildLegacyPlanillaFields,
	cleanNullableFormValue,
	getActiveAdmissionForPlanilla
} from '$lib/server/admisiones/planilla';
import { db } from '$lib/server/db';
import { students } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

function parseAdmissionId(value: string) {
	const admissionId = Number(value);
	if (!Number.isInteger(admissionId) || admissionId <= 0) error(404, 'Admision no encontrada.');
	return admissionId;
}

function cleanRequiredFormValue(value: FormDataEntryValue | null, maxLength: number) {
	return String(value ?? '').trim().slice(0, maxLength);
}

function validEmail(value: string | null) {
	if (!value) return true;
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) redirect(302, '/login');

	const admissionId = parseAdmissionId(params.admissionId);
	const admission = await getActiveAdmissionForPlanilla(admissionId);
	if (!admission) error(404, 'Admision no disponible para generar planilla hoy.');

	return { admission, planillaFields: buildLegacyPlanillaFields(admission) };
};

export const actions: Actions = {
	updateStudent: async (event) => {
		if (!event.locals.user) return fail(401, { message: 'Debe iniciar sesion.' });

		const admissionId = parseAdmissionId(event.params.admissionId);
		const admission = await getActiveAdmissionForPlanilla(admissionId);
		if (!admission) return fail(404, { message: 'Admision no disponible para generar planilla hoy.' });

		const formData = await event.request.formData();
		const apellidosNombres = cleanRequiredFormValue(formData.get('apellidosNombres'), 255);
		const telefono = cleanNullableFormValue(formData.get('telefono'), 60);
		const correo = cleanNullableFormValue(formData.get('correo'), 255);
		const genero = cleanNullableFormValue(formData.get('genero'), 20);
		const auditContext = auditContextFromEvent(event);

		if (!apellidosNombres) return fail(400, { message: 'El nombre del estudiante es requerido.' });
		if (!validEmail(correo)) return fail(400, { message: 'El correo no tiene un formato valido.' });
		if (!auditContext) return fail(401, { message: 'Debe iniciar sesion.' });

		await db.transaction(async (tx) => {
			await tx
				.update(students)
				.set({
					apellidos_nombres: apellidosNombres,
					telefono,
					correo,
					genero
				})
				.where(eq(students.id, admission.studentId));

			await writeAuditLog(tx, auditContext, {
				action: 'admission_planilla.student_updated',
				entityType: 'student',
				entityId: admission.studentId,
				before: {
					apellidosNombres: admission.apellidosNombres,
					telefono: admission.telefono,
					correo: admission.correo,
					genero: admission.genero
				},
				after: {
					apellidosNombres,
					telefono,
					correo,
					genero
				},
				metadata: { admissionId }
			});
		});

		return { message: 'Datos del estudiante actualizados.' };
	}
};
