import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { admissionProcessings, APActiveDates, proceso_admission } from '$lib/server/db/schema';
import type { AuditContext } from '$lib/server/audit';
import { setAuditDatabaseContext, writeAuditLog } from '$lib/server/audit';

export const processingStatuses = ['pendiente', 'matriculado', 'devuelto'] as const;
export type ProcessingStatus = (typeof processingStatuses)[number];

export function caracasDateKey(date = new Date()) {
	const values = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Caracas',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(date);
	const value = (type: string) => values.find((part) => part.type === type)?.value ?? '';
	return `${value('year')}-${value('month')}-${value('day')}`;
}

export function dateValue(dateKey: string) {
	return new Date(`${dateKey}T00:00:00`);
}

export async function processIsActiveOnDate(processId: number, dateKey: string) {
	const [row] = await db
		.select({ id: proceso_admission.id })
		.from(proceso_admission)
		.innerJoin(APActiveDates, eq(proceso_admission.id, APActiveDates.codeId))
		.where(
			and(
				eq(proceso_admission.id, processId),
				eq(proceso_admission.isEnabled, true),
				eq(APActiveDates.activeDate, dateValue(dateKey))
			)
		)
		.limit(1);
	return Boolean(row);
}

export async function ensureAdmissionProcessing(
	admissionId: number,
	generatedByUserId: string,
	processingDate: string,
	auditContext: AuditContext
) {
	return db.transaction(async (tx) => {
		await setAuditDatabaseContext(tx, auditContext);
		const [existing] = await tx
			.select()
			.from(admissionProcessings)
			.where(eq(admissionProcessings.admissionId, admissionId))
			.limit(1);
		if (existing) return { processing: existing, created: false };

		const [insert] = await tx.insert(admissionProcessings).values({
			admissionId,
			processingDate: dateValue(processingDate),
			generatedByUserId,
			status: 'pendiente'
		});
		await writeAuditLog(tx, auditContext, {
			action: 'admission_planilla.generated',
			entityType: 'admission_processing',
			entityId: insert.insertId,
			after: { admissionId, processingDate, status: 'pendiente' }
		});
		const [processing] = await tx
			.select()
			.from(admissionProcessings)
			.where(eq(admissionProcessings.id, Number(insert.insertId)))
			.limit(1);
		if (!processing) throw new Error('No se pudo registrar la generación de la planilla.');
		return { processing, created: true };
	});
}
