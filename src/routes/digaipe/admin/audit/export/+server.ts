import { auditContextFromEvent, writeAuditLog } from '$lib/server/audit';
import { can } from '$lib/permissions';
import { db } from '$lib/server/db';
import { auditEvents } from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { and, eq, gte, lte, type SQL } from 'drizzle-orm';
import type { RequestHandler } from './$types';

const EXPORT_LIMIT = 10_000;

function requiredDate(value: string | null, label: string) {
	if (!value) error(400, `La fecha ${label} es obligatoria para exportar la auditoría.`);
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) error(400, `La fecha ${label} no es válida.`);
	return date;
}

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) error(401, 'Debe iniciar sesión.');
	if (!can(event.locals.user, 'audit.view')) error(403, 'No tiene permiso para exportar la auditoría.');

	const { url } = event;
	const from = requiredDate(url.searchParams.get('from'), 'Desde');
	const to = requiredDate(url.searchParams.get('to'), 'Hasta');
	if (from > to) error(400, 'La fecha Desde debe ser anterior a Hasta.');

	const conditions: SQL[] = [gte(auditEvents.occurredAt, from), lte(auditEvents.occurredAt, to)];
	const action = url.searchParams.get('action')?.trim();
	const source = url.searchParams.get('source')?.trim();
	const actor = url.searchParams.get('actor')?.trim();
	const entityType = url.searchParams.get('entityType')?.trim();
	const entityId = url.searchParams.get('entityId')?.trim();
	if (action) conditions.push(eq(auditEvents.action, action));
	if (source) conditions.push(eq(auditEvents.source, source));
	if (actor) conditions.push(eq(auditEvents.actorUserId, actor));
	if (entityType) conditions.push(eq(auditEvents.entityType, entityType));
	if (entityId) conditions.push(eq(auditEvents.entityId, entityId));

	const logs = await db
		.select()
		.from(auditEvents)
		.where(and(...conditions))
		.limit(EXPORT_LIMIT + 1);
	if (logs.length > EXPORT_LIMIT) {
		error(400, `La exportación supera ${EXPORT_LIMIT} eventos. Use un rango de fechas o filtros más acotados.`);
	}

	const auditContext = auditContextFromEvent(event);
	if (!auditContext) error(401, 'Debe iniciar sesión.');
	await writeAuditLog(db, auditContext, {
		action: 'audit.exported',
		entityType: 'audit_ledger',
		entityId: 'export',
		metadata: {
			from: from.toISOString(),
			to: to.toISOString(),
			action,
			source,
			actor,
			entityType,
			entityId,
			resultCount: logs.length
		}
	});

	const body = logs
		.map((log) => JSON.stringify(log))
		.join('\n')
		.concat(logs.length ? '\n' : '');
	return new Response(body, {
		headers: {
			'content-type': 'application/x-ndjson; charset=utf-8',
			'content-disposition': 'attachment; filename="digaipe-audit-export.ndjson"',
			'cache-control': 'no-store'
		}
	});
};
