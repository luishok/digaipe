import { auditContextFromEvent, setAuditDatabaseContext, writeAuditLog } from '$lib/server/audit';
import {
	caracasDateKey,
	dateValue,
	processIsActiveOnDate,
	type ProcessingStatus
} from '$lib/server/admisiones/processing';
import { db } from '$lib/server/db';
import {
	admissionProcessings,
	admissions,
	careers,
	proceso_admission,
	students
} from '$lib/server/db/schema';
import { and, asc, eq, gte, inArray, like, lte, or, type SQL } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const statuses = new Set<ProcessingStatus>(['pendiente', 'matriculado', 'devuelto']);

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

export const load: PageServerLoad = async ({ locals, url }) => {
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
	if (statuses.has(status as ProcessingStatus))
		conditions.push(eq(admissionProcessings.status, status));
	if (process) conditions.push(eq(proceso_admission.code, process));
	if (search) {
		const pattern = `%${search}%`;
		conditions.push(
			or(
				like(students.cedula, pattern),
				like(students.apellidos_nombres, pattern),
				like(careers.programa_academico, pattern)
			)!
		);
	}
	const [rows, processes] = await Promise.all([
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
				processCode: proceso_admission.code
			})
			.from(admissionProcessings)
			.innerJoin(admissions, eq(admissionProcessings.admissionId, admissions.id))
			.innerJoin(students, eq(admissions.studentId, students.id))
			.innerJoin(careers, eq(admissions.careerId, careers.id))
			.innerJoin(proceso_admission, eq(admissions.procesoId, proceso_admission.id))
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
	return {
		filters: { dateFrom, dateTo, status, process, search },
		rows,
		processes,
		isAdmin: locals.user.role === 'admin'
	};
};

export const actions: Actions = {
	review: async (event) => {
		if (!event.locals.user) return fail(401, { message: 'Debe iniciar sesión.' });
		const form = await event.request.formData();
		const ids = [
			...new Set(
				form
					.getAll('processingId')
					.map((value) => Number(value))
					.filter((id) => Number.isInteger(id) && id > 0)
			)
		];
		const status = clean(form.get('status')) as ProcessingStatus;
		const reason = clean(form.get('reason'));
		if (!ids.length) return fail(400, { message: 'Seleccione al menos una admisión.' });
		if (status !== 'matriculado' && status !== 'devuelto')
			return fail(400, { message: 'Seleccione un estado final válido.' });
		if (status === 'devuelto' && !reason)
			return fail(400, { message: 'Debe indicar el motivo de devolución.' });
		const auditContext = auditContextFromEvent(event);
		if (!auditContext) return fail(401, { message: 'Debe iniciar sesión.' });

		const selected = await db
			.select({
				id: admissionProcessings.id,
				admissionId: admissions.id,
				status: admissionProcessings.status,
				processingDate: admissionProcessings.processingDate,
				processId: proceso_admission.id
			})
			.from(admissionProcessings)
			.innerJoin(admissions, eq(admissionProcessings.admissionId, admissions.id))
			.innerJoin(proceso_admission, eq(admissions.procesoId, proceso_admission.id))
			.where(inArray(admissionProcessings.id, ids));
		if (selected.length !== ids.length)
			return fail(404, { message: 'Una admisión seleccionada ya no existe.' });
		const today = caracasDateKey();
		for (const row of selected) {
			if (row.status === 'pendiente') continue;
			const processingDate = row.processingDate.toISOString().slice(0, 10);
			if (
				row.status === 'devuelto' &&
				status === 'matriculado' &&
				processingDate === today &&
				(await processIsActiveOnDate(row.processId, today))
			)
				continue;
			return fail(409, {
				message:
					'Solo se pueden revisar pendientes. Un Devuelto puede matricularse el mismo día mientras el proceso esté activo; los demás cambios requieren desbloqueo administrativo.'
			});
		}

		await db.transaction(async (tx) => {
			await setAuditDatabaseContext(tx, auditContext);
			for (const row of selected) {
				await tx
					.update(admissionProcessings)
					.set({
						status,
						reviewedAt: new Date(),
						reviewedByUserId: event.locals.user!.id,
						returnReason: status === 'devuelto' ? reason : null
					})
					.where(eq(admissionProcessings.id, row.id));
				await writeAuditLog(tx, auditContext, {
					action: 'admission_document.reviewed',
					entityType: 'admission_processing',
					entityId: row.id,
					before: { status: row.status },
					after: { status },
					metadata: { admissionId: row.admissionId, reason: status === 'devuelto' ? reason : null }
				});
			}
		});
		return { message: `${selected.length} admisión(es) actualizada(s).` };
	},
	unlock: async (event) => {
		if (!event.locals.user || event.locals.user.role !== 'admin')
			return fail(403, { message: 'Solo un administrador puede desbloquear una admisión.' });
		const form = await event.request.formData();
		const id = Number(form.get('unlockProcessingId'));
		const reason = clean(form.get(`unlockReason_${id}`));
		if (!Number.isInteger(id) || id <= 0 || !reason)
			return fail(400, { message: 'Seleccione una admisión e indique el motivo del desbloqueo.' });
		const auditContext = auditContextFromEvent(event);
		if (!auditContext) return fail(401, { message: 'Debe iniciar sesión.' });
		await db
			.transaction(async (tx) => {
				await setAuditDatabaseContext(tx, auditContext);
				const [row] = await tx
					.select({
						id: admissionProcessings.id,
						admissionId: admissionProcessings.admissionId,
						status: admissionProcessings.status
					})
					.from(admissionProcessings)
					.where(eq(admissionProcessings.id, id))
					.limit(1);
				if (!row) throw new Error('NOT_FOUND');
				if (row.status === 'pendiente') throw new Error('ALREADY_PENDING');
				await tx
					.update(admissionProcessings)
					.set({
						status: 'pendiente',
						reviewedAt: null,
						reviewedByUserId: null,
						unlockedAt: new Date(),
						unlockedByUserId: event.locals.user!.id,
						unlockReason: reason
					})
					.where(eq(admissionProcessings.id, id));
				await writeAuditLog(tx, auditContext, {
					action: 'admission_document.unlocked',
					entityType: 'admission_processing',
					entityId: id,
					before: { status: row.status },
					after: { status: 'pendiente' },
					metadata: { admissionId: row.admissionId, reason }
				});
			})
			.catch((cause) => {
				if (
					cause instanceof Error &&
					(cause.message === 'NOT_FOUND' || cause.message === 'ALREADY_PENDING')
				)
					throw cause;
				throw cause;
			});
		return { message: 'Admisión desbloqueada y devuelta a Pendiente.' };
	}
};
