import { caracasDateKey } from '$lib/server/admisiones/processing';
import { auditContextFromEvent, auditedTransaction, writeAuditLog } from '$lib/server/audit';
import { db } from '$lib/server/db';
import { APActiveDates, proceso_admission } from '$lib/server/db/schema';
import { can } from '$lib/permissions';
import { fail, type Actions } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

function toDateKey(value: Date | string): string {
	if (typeof value === 'string') return value.slice(0, 10);
	return value.toISOString().slice(0, 10);
}

// A process is only usable (planillas, document review) on one of its dates, in Caracas time —
// see processIsActiveOnDate / searchActiveAdmissionsForPlanilla. The status is derived from the
// dates on every load instead of stored, so it can never go stale.
type ProcessStatus = 'active' | 'scheduled' | 'finished' | 'no_dates' | 'disabled';

function processStatus(isEnabled: boolean, dates: string[], today: string): ProcessStatus {
	// An admin shutdown overrides the dates.
	if (!isEnabled) return 'disabled';
	if (dates.length === 0) return 'no_dates';
	if (dates.includes(today)) return 'active';
	if (dates.some((date) => date > today)) return 'scheduled';
	return 'finished';
}

export const actions: Actions = {
	create: async (event) => {
		if (!event.locals.user) return fail(401, { error: 'Debe iniciar sesion.' });

		const data = await event.request.formData();
		const code = (data.get('code') as string)?.replace(/\s+/g, '').toUpperCase();
		const auditContext = auditContextFromEvent(event);

		if (!code) return fail(400, { error: 'El código es obligatorio.' });
		if (code.length > 100) return fail(400, { error: 'El código es demasiado largo.' });
		if (!auditContext) return fail(401, { error: 'Debe iniciar sesion.' });

		const existing = await db
			.select({ id: proceso_admission.id })
			.from(proceso_admission)
			.where(eq(proceso_admission.code, code))
			.limit(1);

		if (existing.length > 0) return fail(409, { error: `El código "${code}" ya existe.` });

		const result = await auditedTransaction(auditContext, async (tx) => {
			const [insertResult] = await tx.insert(proceso_admission).values({ code, isEnabled: true });

			await writeAuditLog(tx, auditContext, {
				action: 'admission_process.created',
				entityType: 'admission_process',
				entityId: insertResult.insertId,
				before: null,
				after: { id: insertResult.insertId, code, isEnabled: true }
			});

			return insertResult;
		});

		return { processId: result.insertId, code };
	},

	saveDates: async (event) => {
		if (!event.locals.user) return fail(401, { error: 'Debe iniciar sesion.' });

		const data = await event.request.formData();
		const processId = Number(data.get('processId'));
		const rawDates = data.get('dates') as string;
		const auditContext = auditContextFromEvent(event);

		if (!processId || Number.isNaN(processId)) return fail(400, { error: 'ID de proceso inválido.' });
		if (!rawDates) return fail(400, { error: 'No se indicaron fechas.' });
		if (!auditContext) return fail(401, { error: 'Debe iniciar sesion.' });

		let dates: string[];
		try {
			const parsed = JSON.parse(rawDates);
			if (!Array.isArray(parsed)) throw new Error();

			dates = parsed
				.map((date: unknown) => (typeof date === 'string' ? date.trim() : ''))
				.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
				.filter((date) => !Number.isNaN(new Date(`${date}T00:00:00`).getTime()))
				.slice(0, 365);
		} catch {
			return fail(400, { error: 'Formato de fechas inválido.' });
		}

		if (!dates.length) return fail(400, { error: 'No se indicaron fechas válidas.' });

		const addedDates = await auditedTransaction(auditContext, async (tx) => {
				const [process] = await tx
					.select({
						id: proceso_admission.id,
						code: proceso_admission.code,
						isEnabled: proceso_admission.isEnabled
					})
					.from(proceso_admission)
					.where(eq(proceso_admission.id, processId))
					.limit(1);

				if (!process) throw new Error('PROCESS_NOT_FOUND');

				const existingRows = await tx
					.select({ activeDate: APActiveDates.activeDate })
					.from(APActiveDates)
					.where(eq(APActiveDates.codeId, processId));
				const existingDates = existingRows.map((row) => toDateKey(row.activeDate));
				const existingDateSet = new Set(existingDates);
				const newDates = [...new Set(dates)].filter((date) => !existingDateSet.has(date));

				if (newDates.length === 0) return [];

				await tx
					.insert(APActiveDates)
					.values(
						newDates.map((activeDate) => ({
							codeId: processId,
							activeDate: new Date(`${activeDate}T00:00:00`)
						}))
					)
					.onDuplicateKeyUpdate({ set: { activeDate: sql`active_date` } });

				// isEnabled is the admin's shutdown switch; adding dates must not undo a shutdown.
				await writeAuditLog(tx, auditContext, {
					action: 'admission_process.dates_added',
					entityType: 'admission_process',
					entityId: processId,
					before: {
						id: processId,
						code: process.code,
						isEnabled: process.isEnabled,
						activeDates: existingDates
					},
					after: {
						id: processId,
						code: process.code,
						isEnabled: process.isEnabled,
						activeDates: [...existingDates, ...newDates].sort(),
						addedDates: newDates
					}
				});

				return newDates;
			})
			.catch((error) => {
				if (error instanceof Error && error.message === 'PROCESS_NOT_FOUND') return null;
				throw error;
			});

		if (addedDates === null) return fail(404, { error: 'Proceso no encontrado.' });
		return { processId, saved: true, added: addedDates.length };
	},

	// Admin only: shut a process down when something is wrong with it, or turn it back on.
	// While disabled, no planilla can be generated and no document reviewed for it, whatever
	// its dates say (planilla.ts and processing.ts both require isEnabled).
	setEnabled: async (event) => {
		if (!event.locals.user) return fail(401, { error: 'Debe iniciar sesion.' });
		// hooks.server.ts already requires this; checked again so the action is safe on its own.
		if (!can(event.locals.user, 'processes.toggle')) {
			return fail(403, { error: 'Solo un administrador puede activar o desactivar procesos.' });
		}

		const data = await event.request.formData();
		const processId = Number(data.get('processId'));
		const enabledValue = data.get('enabled');
		const reason = String(data.get('reason') ?? '').trim();
		const auditContext = auditContextFromEvent(event);

		if (!Number.isInteger(processId) || processId <= 0) {
			return fail(400, { error: 'ID de proceso inválido.' });
		}
		if (enabledValue !== 'true' && enabledValue !== 'false') {
			return fail(400, { error: 'Estado inválido.' });
		}
		if (!reason) return fail(400, { error: 'Indique el motivo del cambio.' });
		if (reason.length > 500) return fail(400, { error: 'El motivo es demasiado largo.' });
		if (!auditContext) return fail(401, { error: 'Debe iniciar sesion.' });

		const enabled = enabledValue === 'true';

		const outcome = await auditedTransaction(auditContext, async (tx) => {
			const [process] = await tx
				.select({
					id: proceso_admission.id,
					code: proceso_admission.code,
					isEnabled: proceso_admission.isEnabled
				})
				.from(proceso_admission)
				.where(eq(proceso_admission.id, processId))
				.for('update');

			if (!process) return 'not_found' as const;
			if (process.isEnabled === enabled) return 'unchanged' as const;

			await tx
				.update(proceso_admission)
				.set({ isEnabled: enabled })
				.where(eq(proceso_admission.id, processId));

			await writeAuditLog(tx, auditContext, {
				action: 'admission_process.enabled_changed',
				entityType: 'admission_process',
				entityId: processId,
				before: { id: processId, code: process.code, isEnabled: process.isEnabled },
				after: { id: processId, code: process.code, isEnabled: enabled },
				metadata: { reason }
			});
			return 'changed' as const;
		});

		if (outcome === 'not_found') return fail(404, { error: 'Proceso no encontrado.' });
		return { processId, toggled: true, enabled };
	}
};

export const load: PageServerLoad = async () => {
	const rows = await db
		.select({
			id: proceso_admission.id,
			code: proceso_admission.code,
			isEnabled: proceso_admission.isEnabled,
			activeDate: APActiveDates.activeDate
		})
		.from(proceso_admission)
		.leftJoin(APActiveDates, eq(proceso_admission.id, APActiveDates.codeId));

	const result = Object.values(
		rows.reduce(
			(acc, row) => {
				if (!acc[row.id]) {
					acc[row.id] = { id: row.id, code: row.code, isEnabled: row.isEnabled, dates: [] };
				}
				if (row.activeDate) {
					acc[row.id].dates.push(toDateKey(row.activeDate));
				}
				return acc;
			},
			{} as Record<number, { id: number; code: string; isEnabled: boolean; dates: string[] }>
		)
	);

	const today = caracasDateKey();

	return {
		today,
		all_admission_proc: result.map((process) => {
			const dates = [...process.dates].sort();
			return {
				...process,
				dates,
				status: processStatus(process.isEnabled, dates, today),
				nextDate: dates.find((date) => date > today) ?? null
			};
		})
	};
};
