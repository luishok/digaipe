import { auditContextFromEvent, setAuditDatabaseContext, writeAuditLog } from '$lib/server/audit';
import { db } from '$lib/server/db';
import { APActiveDates, proceso_admission } from '$lib/server/db/schema';
import { fail, type Actions } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

function toDateKey(value: Date | string): string {
	if (typeof value === 'string') return value.slice(0, 10);
	return value.toISOString().slice(0, 10);
}

export const actions: Actions = {
	create: async (event) => {
		if (!event.locals.user) return fail(401, { error: 'Debe iniciar sesion.' });

		const data = await event.request.formData();
		const code = (data.get('code') as string)?.replace(/\s+/g, '').toUpperCase();
		const auditContext = auditContextFromEvent(event);

		if (!code) return fail(400, { error: 'Code is required' });
		if (code.length > 100) return fail(400, { error: 'Code is too long' });
		if (!auditContext) return fail(401, { error: 'Debe iniciar sesion.' });

		const existing = await db
			.select({ id: proceso_admission.id })
			.from(proceso_admission)
			.where(eq(proceso_admission.code, code))
			.limit(1);

		if (existing.length > 0) return fail(409, { error: `Code "${code}" already exists` });

		const result = await db.transaction(async (tx) => {
			await setAuditDatabaseContext(tx, auditContext);
			const [insertResult] = await tx.insert(proceso_admission).values({ code, isEnabled: false });

			await writeAuditLog(tx, auditContext, {
				action: 'admission_process.created',
				entityType: 'admission_process',
				entityId: insertResult.insertId,
				before: null,
				after: { id: insertResult.insertId, code, isEnabled: false }
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

		if (!processId || Number.isNaN(processId)) return fail(400, { error: 'Invalid process ID' });
		if (!rawDates) return fail(400, { error: 'No dates provided' });
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
			return fail(400, { error: 'Invalid dates format' });
		}

		if (!dates.length) return fail(400, { error: 'No valid dates provided' });

		const addedDates = await db
			.transaction(async (tx) => {
				await setAuditDatabaseContext(tx, auditContext);
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

				await tx
					.update(proceso_admission)
					.set({ isEnabled: true })
					.where(eq(proceso_admission.id, processId));

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
						isEnabled: true,
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

		if (addedDates === null) return fail(404, { error: 'Process not found' });
		return { processId, saved: true, added: addedDates.length };
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

	return {
		all_admission_proc: result
	};
};
