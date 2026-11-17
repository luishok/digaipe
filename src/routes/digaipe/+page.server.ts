import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { APActiveDates, proceso_admission } from '$lib/server/db/schema';
import { caracasDateKey } from '$lib/server/admisiones/processing';
import { formatDate } from '$lib/dates';

function formatProcessCode(code: string, rawDate: Date | string) {
	let dateKey = '';
	if (typeof rawDate === 'string') {
		dateKey = rawDate.slice(0, 10);
	} else if (rawDate instanceof Date) {
		const y = rawDate.getUTCFullYear();
		const m = String(rawDate.getUTCMonth() + 1).padStart(2, '0');
		const d = String(rawDate.getUTCDate()).padStart(2, '0');
		dateKey = `${y}-${m}-${d}`;
	} else {
		dateKey = String(rawDate ?? '');
	}

	const parts = dateKey.split('-');
	let shortDate = dateKey;
	if (parts.length === 3) {
		const [year, month, day] = parts;
		shortDate = `${year.slice(-2)}-${month}-${day}`;
	}

	const cleanCode = (code ?? '').trim();
	const prefix = cleanCode.startsWith('.')
		? cleanCode
		: cleanCode.startsWith('UA')
			? `.${cleanCode}`
			: cleanCode;
	const fullCode = `${prefix}/${shortDate}`;

	return {
		fullCode,
		dateKey,
		formattedDate: formatDate(dateKey)
	};
}

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		return redirect(302, '/login');
	}
	const user = event.locals.user;

	const today = caracasDateKey();

	// Buscar las fechas activas de los procesos habilitados
	// Primero buscamos las fechas de hoy y futuras (>= today)
	const upcomingRows = await db
		.select({
			id: proceso_admission.id,
			code: proceso_admission.code,
			activeDate: APActiveDates.activeDate
		})
		.from(APActiveDates)
		.innerJoin(proceso_admission, eq(APActiveDates.codeId, proceso_admission.id))
		.where(
			and(
				eq(proceso_admission.isEnabled, true),
				sql`${APActiveDates.activeDate} >= ${today}`
			)
		)
		.orderBy(asc(APActiveDates.activeDate))
		.limit(5);

	let displayRows = upcomingRows;

	// Si no hay fechas futuras en la base de datos (por ejemplo, en desarrollo o datos históricos),
	// mostramos los últimos procesos programados para que la sección muestre información relevante.
	if (displayRows.length === 0) {
		displayRows = await db
			.select({
				id: proceso_admission.id,
				code: proceso_admission.code,
				activeDate: APActiveDates.activeDate
			})
			.from(APActiveDates)
			.innerJoin(proceso_admission, eq(APActiveDates.codeId, proceso_admission.id))
			.where(eq(proceso_admission.isEnabled, true))
			.orderBy(desc(APActiveDates.activeDate))
			.limit(5);
		displayRows.reverse();
	}

	const proximosProcesos = displayRows.map((row) => {
		const { fullCode, dateKey, formattedDate } = formatProcessCode(row.code, row.activeDate);
		const isToday = dateKey === today;
		const isUpcoming = dateKey > today;
		let daysLeftText = 'Programado';
		if (isToday) {
			daysLeftText = 'Hoy';
		} else if (isUpcoming) {
			const diffDays = Math.ceil(
				(new Date(`${dateKey}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) /
					(1000 * 60 * 60 * 24)
			);
			daysLeftText = diffDays === 1 ? 'Mañana' : `En ${diffDays} días`;
		}

		return {
			id: row.id,
			processCode: row.code,
			fullCode,
			dateKey,
			formattedDate,
			isToday,
			isUpcoming,
			daysLeftText
		};
	});

	return { user, proximosProcesos };
};

export const actions: Actions = {
	signOut: async (event) => {
		await auth.api.signOut({
			headers: event.request.headers
		});
		return redirect(302, '/');
	}
};
