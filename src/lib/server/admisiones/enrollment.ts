import { createHash } from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	admissionProcessClosures,
	admissionProcessings,
	admissionSelections,
	admissions,
	APActiveDates,
	careers,
	mod_admission,
	proceso_admission,
	students
} from '$lib/server/db/schema';
import { buildEnrollmentReport, type EnrollmentReport } from '$lib/admission-outcomes';
import { auditedTransaction, writeAuditLog, type AuditContext } from '$lib/server/audit';
import { caracasDateKey, dateValue } from '$lib/dates';

export type AdmissionTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = Pick<typeof db, 'select'>;

export class AdmissionConflict extends Error {}

export const selectionScope = () =>
	and(
		eq(admissionSelections.studentId, admissions.studentId),
		eq(admissionSelections.careerId, admissions.careerId),
		eq(admissionSelections.procesoId, admissions.procesoId)
	);

export const admissionOutcomeSql = () => sql<'matriculado' | 'no_matriculado' | 'pendiente'>`CASE
	WHEN ${admissionSelections.admissionId} = ${admissions.id} THEN 'matriculado'
	WHEN ${admissionSelections.admissionId} IS NOT NULL OR ${proceso_admission.closedAt} IS NOT NULL THEN 'no_matriculado'
	ELSE 'pendiente' END`;

export const alternativeCountSql =
	() => sql<number>`(SELECT COUNT(*) FROM admissions AS alternatives
	WHERE alternatives.student_id = ${admissions.studentId} AND alternatives.career_id = ${admissions.careerId}
	AND alternatives.proceso_id = ${admissions.procesoId})`;

export async function lockOpenProcesses(tx: AdmissionTransaction, ids: number[]) {
	const uniqueIds = [...new Set(ids)].sort((a, b) => a - b);
	if (!uniqueIds.length) return;
	const processes = await tx
		.select()
		.from(proceso_admission)
		.where(inArray(proceso_admission.id, uniqueIds))
		.orderBy(asc(proceso_admission.id))
		.for('update');
	if (processes.length !== uniqueIds.length)
		throw new AdmissionConflict('Un proceso ya no existe.');
	for (const process of processes)
		if (process.closedAt)
			throw new AdmissionConflict(
				`El proceso ${process.code} está cerrado. Debe reabrirlo antes de modificarlo.`
			);
}

export async function assertAdmissionUsable(
	tx: AdmissionTransaction,
	admissionId: number,
	today = caracasDateKey()
) {
	const [admission] = await tx.select().from(admissions).where(eq(admissions.id, admissionId));
	if (!admission) throw new AdmissionConflict('La admisión no existe.');
	await lockOpenProcesses(tx, [admission.procesoId]);
	const [eligible] = await tx
		.select({ enabled: proceso_admission.isEnabled, selectedId: admissionSelections.admissionId })
		.from(admissions)
		.innerJoin(proceso_admission, eq(proceso_admission.id, admissions.procesoId))
		.innerJoin(APActiveDates, eq(APActiveDates.codeId, admissions.procesoId))
		.leftJoin(admissionSelections, selectionScope())
		.where(and(eq(admissions.id, admissionId), eq(APActiveDates.activeDate, dateValue(today))));
	if (!eligible?.enabled || today !== caracasDateKey())
		throw new AdmissionConflict('El proceso no está activo hoy.');
	if (eligible.selectedId !== null && eligible.selectedId !== admissionId)
		throw new AdmissionConflict('No matriculado: otra modalidad seleccionada.');
}

export async function getEnrollmentReport(reader: Reader = db, processCodes?: string[]) {
	const source = await reader
		.select({
			admissionId: admissions.id,
			studentId: admissions.studentId,
			careerId: admissions.careerId,
			processId: admissions.procesoId,
			selectedAdmissionId: admissionSelections.admissionId,
			closedAt: proceso_admission.closedAt,
			processingStatus: admissionProcessings.status,
			cedula: students.cedula,
			student: students.apellidos_nombres,
			career: careers.programa_academico,
			faculty: careers.facultad,
			process: proceso_admission.code,
			modality: mod_admission.code,
			modalityName: mod_admission.name,
			period: admissions.periodoIngreso
		})
		.from(admissions)
		.innerJoin(students, eq(students.id, admissions.studentId))
		.innerJoin(careers, eq(careers.id, admissions.careerId))
		.innerJoin(proceso_admission, eq(proceso_admission.id, admissions.procesoId))
		.innerJoin(mod_admission, eq(mod_admission.id, admissions.modalityId))
		.leftJoin(admissionSelections, selectionScope())
		.leftJoin(admissionProcessings, eq(admissionProcessings.admissionId, admissions.id))
		.where(processCodes?.length ? inArray(proceso_admission.code, processCodes) : undefined);
	return buildEnrollmentReport(
		source.map((row) => ({ ...row, career: row.career ?? 'Sin carrera' }))
	);
}

// MySQL JSON normalizes object key ordering. Hash a canonical representation for round trips.
export function canonicalReport(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalReport).join(',')}]`;
	if (value !== null && typeof value === 'object')
		return `{${Object.entries(value)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
			.map(([key, v]) => `${JSON.stringify(key)}:${canonicalReport(v)}`)
			.join(',')}}`;
	return JSON.stringify(value);
}
export const reportHash = (report: EnrollmentReport) =>
	createHash('sha256').update(canonicalReport(report)).digest('hex');

export async function closeAdmissionProcess(
	processId: number,
	reason: string,
	context: AuditContext
) {
	return auditedTransaction(context, async (tx) => {
		await lockOpenProcesses(tx, [processId]);
		const [process] = await tx
			.select()
			.from(proceso_admission)
			.where(eq(proceso_admission.id, processId));
		const dates = await tx
			.select({ date: APActiveDates.activeDate })
			.from(APActiveDates)
			.where(eq(APActiveDates.codeId, processId));
		const today = caracasDateKey();
		if (!dates.length || dates.some(({ date }) => date.toISOString().slice(0, 10) >= today))
			throw new AdmissionConflict(
				'Solo se puede cerrar un proceso después de su última fecha activa.'
			);
		const closedAt = new Date();
		await tx
			.update(proceso_admission)
			.set({ closedAt, closedByUserId: context.actorUserId, closureReason: reason })
			.where(eq(proceso_admission.id, processId));
		const report = await getEnrollmentReport(tx, [process.code]);
		const [last] = await tx
			.select({ version: admissionProcessClosures.version })
			.from(admissionProcessClosures)
			.where(eq(admissionProcessClosures.procesoId, processId))
			.orderBy(desc(admissionProcessClosures.version))
			.limit(1);
		const version = (last?.version ?? 0) + 1;
		const sha256 = reportHash(report);
		const [insert] = await tx
			.insert(admissionProcessClosures)
			.values({
				procesoId: processId,
				version,
				closedAt,
				closedByUserId: context.actorUserId!,
				reason,
				report,
				sha256
			});
		await writeAuditLog(tx, context, {
			action: 'admission_process.closed',
			entityType: 'admission_process',
			entityId: processId,
			after: { closedAt, version, totals: report.totals },
			metadata: { reason, sha256, closureId: insert.insertId }
		});
		return { closureId: Number(insert.insertId), version };
	});
}

export async function getClosure(closureId: number) {
	const [closure] = await db
		.select()
		.from(admissionProcessClosures)
		.where(eq(admissionProcessClosures.id, closureId));
	if (closure && reportHash(closure.report) !== closure.sha256)
		throw new AdmissionConflict('El informe de cierre no coincide con su huella de integridad.');
	return closure ?? null;
}

export async function reopenAdmissionProcess(
	processId: number,
	reason: string,
	context: AuditContext
) {
	return auditedTransaction(context, async (tx) => {
		const [process] = await tx
			.select()
			.from(proceso_admission)
			.where(eq(proceso_admission.id, processId))
			.for('update');
		if (!process?.closedAt) throw new AdmissionConflict('El proceso no existe o ya está abierto.');
		await tx
			.update(proceso_admission)
			.set({ closedAt: null, closedByUserId: null, closureReason: null })
			.where(eq(proceso_admission.id, processId));
		await writeAuditLog(tx, context, {
			action: 'admission_process.reopened',
			entityType: 'admission_process',
			entityId: processId,
			before: { closedAt: process.closedAt },
			after: { closedAt: null },
			metadata: { reason }
		});
	});
}
