import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	admissionProcessings,
	admissionSelections,
	admissions,
	APActiveDates,
	proceso_admission
} from '$lib/server/db/schema';
import { auditedTransaction, writeAuditLog, type AuditContext } from '$lib/server/audit';
import { assignmentKey } from '$lib/admission-outcomes';
import { AdmissionConflict, lockOpenProcesses, selectionScope } from './enrollment';
import { caracasDateKey, dateValue } from './processing';

async function processIdsFor(ids: number[]) {
	return db
		.select({ processId: admissions.procesoId })
		.from(admissionProcessings)
		.innerJoin(admissions, eq(admissions.id, admissionProcessings.admissionId))
		.where(inArray(admissionProcessings.id, ids));
}

export async function reviewAdmissions(
	ids: number[],
	status: 'matriculado' | 'devuelto',
	reason: string,
	context: AuditContext
) {
	const processes = await processIdsFor(ids);
	return auditedTransaction(context, async (tx) => {
		await lockOpenProcesses(
			tx,
			processes.map((row) => row.processId)
		);
		const selected = await tx
			.select({
				id: admissionProcessings.id,
				admissionId: admissions.id,
				status: admissionProcessings.status,
				processingDate: admissionProcessings.processingDate,
				studentId: admissions.studentId,
				careerId: admissions.careerId,
				processId: admissions.procesoId,
				enabled: proceso_admission.isEnabled,
				selectedAdmissionId: admissionSelections.admissionId
			})
			.from(admissionProcessings)
			.innerJoin(admissions, eq(admissions.id, admissionProcessings.admissionId))
			.innerJoin(proceso_admission, eq(proceso_admission.id, admissions.procesoId))
			.leftJoin(admissionSelections, selectionScope())
			.where(inArray(admissionProcessings.id, ids))
			.orderBy(asc(admissionProcessings.id))
			.for('update');
		if (selected.length !== ids.length)
			throw new AdmissionConflict('Una admisión seleccionada ya no existe.');
		const today = caracasDateKey();
		const groups = new Set<string>();
		for (const row of selected) {
			if (!row.enabled) throw new AdmissionConflict('El proceso está deshabilitado.');
			if (row.selectedAdmissionId !== null)
				throw new AdmissionConflict(
					'Ya existe una matrícula para este estudiante, carrera y proceso. Desbloquee la matrícula elegida antes de cambiarla.'
				);
			if (status === 'matriculado') {
				const key = assignmentKey(row);
				if (groups.has(key))
					throw new AdmissionConflict(
						'Seleccione solo una modalidad por estudiante, carrera y proceso.'
					);
				groups.add(key);
			}
			if (row.status === 'pendiente') continue;
			const [active] = await tx
				.select({ id: APActiveDates.codeId })
				.from(APActiveDates)
				.where(
					and(
						eq(APActiveDates.codeId, row.processId),
						eq(APActiveDates.activeDate, dateValue(today))
					)
				);
			if (
				!(
					row.status === 'devuelto' &&
					status === 'matriculado' &&
					row.processingDate.toISOString().slice(0, 10) === today &&
					active
				)
			)
				throw new AdmissionConflict(
					'Solo se pueden revisar pendientes. Un Devuelto puede matricularse el mismo día mientras el proceso esté activo; los demás cambios requieren desbloqueo.'
				);
		}
		const reviewedAt = new Date();
		for (const row of selected) {
			if (status === 'matriculado')
				await tx.insert(admissionSelections).values({
					studentId: row.studentId,
					careerId: row.careerId,
					procesoId: row.processId,
					admissionId: row.admissionId,
					selectedAt: reviewedAt,
					selectedByUserId: context.actorUserId
				});
			await tx
				.update(admissionProcessings)
				.set({
					status,
					reviewedAt,
					reviewedByUserId: context.actorUserId,
					returnReason: status === 'devuelto' ? reason : null
				})
				.where(eq(admissionProcessings.id, row.id));
			await writeAuditLog(tx, context, {
				action: 'admission_document.reviewed',
				entityType: 'admission_processing',
				entityId: row.id,
				before: { status: row.status },
				after: { status },
				metadata: { admissionId: row.admissionId, reason: status === 'devuelto' ? reason : null }
			});
		}
		return selected.length;
	});
}

export async function unlockAdmission(id: number, reason: string, context: AuditContext) {
	const processes = await processIdsFor([id]);
	return auditedTransaction(context, async (tx) => {
		await lockOpenProcesses(
			tx,
			processes.map((row) => row.processId)
		);
		const [row] = await tx
			.select({
				id: admissionProcessings.id,
				admissionId: admissions.id,
				status: admissionProcessings.status,
				selectedAdmissionId: admissionSelections.admissionId
			})
			.from(admissionProcessings)
			.innerJoin(admissions, eq(admissions.id, admissionProcessings.admissionId))
			.leftJoin(admissionSelections, selectionScope())
			.where(eq(admissionProcessings.id, id))
			.for('update');
		if (!row) throw new AdmissionConflict('La admisión no existe.');
		if (row.selectedAdmissionId !== null && row.selectedAdmissionId !== row.admissionId)
			throw new AdmissionConflict('Desbloquee primero la matrícula de la modalidad seleccionada.');
		if (row.status === 'pendiente') throw new AdmissionConflict('La admisión ya está pendiente.');
		if (row.selectedAdmissionId === row.admissionId)
			await tx
				.delete(admissionSelections)
				.where(eq(admissionSelections.admissionId, row.admissionId));
		await tx
			.update(admissionProcessings)
			.set({
				status: 'pendiente',
				reviewedAt: null,
				reviewedByUserId: null,
				unlockedAt: new Date(),
				unlockedByUserId: context.actorUserId,
				unlockReason: reason
			})
			.where(eq(admissionProcessings.id, id));
		await writeAuditLog(tx, context, {
			action: 'admission_document.unlocked',
			entityType: 'admission_processing',
			entityId: id,
			before: { status: row.status },
			after: { status: 'pendiente' },
			metadata: {
				admissionId: row.admissionId,
				reason,
				enrollmentCancelled: row.selectedAdmissionId === row.admissionId
			}
		});
	});
}
