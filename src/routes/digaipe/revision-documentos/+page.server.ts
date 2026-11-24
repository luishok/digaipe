import { auditContextFromEvent, auditStudentDataView } from '$lib/server/audit';
import { caracasDateKey, dateValue } from '$lib/server/admisiones/processing';
import { AdmissionConflict, selectionScope } from '$lib/server/admisiones/enrollment';
import { reviewAdmissions, unlockAdmission } from '$lib/server/admisiones/review';
import { admissionOutcome } from '$lib/admission-outcomes';
import { db } from '$lib/server/db';
import { searchCondition } from '$lib/server/admisiones/search';
import {
	admissionProcessings,
	admissionSelections,
	admissions,
	careers,
	mod_admission,
	proceso_admission,
	students
} from '$lib/server/db/schema';
import { and, asc, eq, gte, lte, type SQL } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import { can } from '$lib/permissions';
import type { Actions, PageServerLoad } from './$types';

function clean(value: FormDataEntryValue | null, limit = 500) {
	return String(value ?? '')
		.trim()
		.slice(0, limit);
}
function validDate(value: string) {
	return (
		/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
	);
}

export const load: PageServerLoad = async (event) => {
	const { locals, url } = event;
	if (!locals.user) redirect(302, '/login');
	const dateFrom = url.searchParams.get('dateFrom')?.trim() || caracasDateKey();
	const dateTo = url.searchParams.get('dateTo')?.trim() || dateFrom;
	const status = url.searchParams.get('status')?.trim() || '';
	const process = url.searchParams.get('process')?.trim() || '';
	const search = url.searchParams.get('search')?.trim() || '';
	const conditions: SQL[] = [];
	if (validDate(dateFrom))
		conditions.push(gte(admissionProcessings.processingDate, dateValue(dateFrom)));
	if (validDate(dateTo))
		conditions.push(lte(admissionProcessings.processingDate, dateValue(dateTo)));
	if (process) conditions.push(eq(proceso_admission.code, process));
	const searchFilter = searchCondition(search, {
		cedula: students.identityKey,
		text: [students.apellidos_nombres, careers.programa_academico]
	});
	if (searchFilter) conditions.push(searchFilter);
	const [source, processes] = await Promise.all([
		db
			.select({
				id: admissionProcessings.id,
				admissionId: admissions.id,
				processingDate: admissionProcessings.processingDate,
				status: admissionProcessings.status,
				returnReason: admissionProcessings.returnReason,
				cedula: students.cedula,
				student: students.apellidos_nombres,
				career: careers.todo,
				processId: proceso_admission.id,
				processCode: proceso_admission.code,
				closedAt: proceso_admission.closedAt,
				selectedAdmissionId: admissionSelections.admissionId,
				modality: mod_admission.name
			})
			.from(admissionProcessings)
			.innerJoin(admissions, eq(admissionProcessings.admissionId, admissions.id))
			.innerJoin(students, eq(admissions.studentId, students.id))
			.innerJoin(careers, eq(admissions.careerId, careers.id))
			.innerJoin(mod_admission, eq(admissions.modalityId, mod_admission.id))
			.innerJoin(proceso_admission, eq(admissions.procesoId, proceso_admission.id))
			.leftJoin(admissionSelections, selectionScope())
			.where(conditions.length ? and(...conditions) : undefined)
			.orderBy(
				asc(admissionProcessings.processingDate),
				asc(careers.programa_academico),
				asc(students.apellidos_nombres)
			),
		db
			.select({ code: proceso_admission.code })
			.from(proceso_admission)
			.orderBy(asc(proceso_admission.code))
	]);
	const rows = source
		.map((row) => {
			const effective = admissionOutcome({ ...row, processingStatus: row.status });
			return {
				...row,
				...effective,
				canAct: !row.closedAt && row.selectedAdmissionId === null,
				canUnlockRow:
					!row.closedAt &&
					row.status !== 'pendiente' &&
					(row.selectedAdmissionId === null || row.selectedAdmissionId === row.admissionId)
			};
		})
		.filter(
			(row) =>
				!status ||
				(status === 'no_matriculado'
					? row.outcome === status
					: row.outcome !== 'no_matriculado' && row.status === status)
		);
	await auditStudentDataView(event, {
		page: '/digaipe/revision-documentos',
		recordType: 'admission_processing',
		recordIds: rows.map((row) => row.id),
		filters: { dateFrom, dateTo, status, process },
		search
	});
	return {
		filters: { dateFrom, dateTo, status, process, search },
		rows,
		processes,
		canReview: can(locals.user, 'documents.review'),
		canUnlock: can(locals.user, 'documents.unlock')
	};
};

export const actions: Actions = {
	review: async (event) => {
		if (!can(event.locals.user, 'documents.review'))
			return fail(403, { message: 'No tiene permiso para revisar documentos.' });
		const form = await event.request.formData();
		const ids = [
			...new Set(
				form
					.getAll('processingId')
					.map(Number)
					.filter((id) => Number.isInteger(id) && id > 0)
			)
		];
		const status = clean(form.get('status'));
		const reason = clean(form.get('reason'));
		if (!ids.length) return fail(400, { message: 'Seleccione al menos una admisión.' });
		if (status !== 'matriculado' && status !== 'devuelto')
			return fail(400, { message: 'Seleccione un estado final válido.' });
		if (status === 'devuelto' && !reason)
			return fail(400, { message: 'Debe indicar el motivo de devolución.' });
		const context = auditContextFromEvent(event);
		if (!context) return fail(401, { message: 'Debe iniciar sesión.' });
		try {
			const count = await reviewAdmissions(ids, status, reason, context);
			return { message: `${count} admisión(es) actualizada(s).` };
		} catch (cause) {
			if (cause instanceof AdmissionConflict) return fail(409, { message: cause.message });
			throw cause;
		}
	},
	unlock: async (event) => {
		if (!can(event.locals.user, 'documents.unlock'))
			return fail(403, { message: 'No tiene permiso para desbloquear admisiones.' });
		const form = await event.request.formData();
		const id = Number(form.get('unlockProcessingId'));
		const reason = clean(form.get(`unlockReason_${id}`));
		if (!Number.isInteger(id) || id <= 0 || !reason)
			return fail(400, { message: 'Seleccione una admisión e indique el motivo del desbloqueo.' });
		const context = auditContextFromEvent(event);
		if (!context) return fail(401, { message: 'Debe iniciar sesión.' });
		try {
			await unlockAdmission(id, reason, context);
		} catch (cause) {
			if (cause instanceof AdmissionConflict) return fail(409, { message: cause.message });
			throw cause;
		}
		return {
			message:
				'Admisión desbloqueada y devuelta a Pendiente. Si tenía matrícula, se anuló la selección de modalidad.'
		};
	}
};
