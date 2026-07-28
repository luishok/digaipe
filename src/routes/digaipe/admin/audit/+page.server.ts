import { auditContextFromEvent, writeAuditLog } from '$lib/server/audit';
import { db } from '$lib/server/db';
import { auditEvents } from '$lib/server/db/schema';
import { redirect } from '@sveltejs/kit';
import { and, count, desc, eq, gte, like, lte, type SQL } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 100;

function parsePage(value: string | null) {
	const page = Number(value ?? '1');
	return Number.isInteger(page) && page > 0 ? page : 1;
}

function parseDate(value: string | null) {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

export const load: PageServerLoad = async (event) => {
	const { locals, url } = event;
	if (!locals.user) redirect(302, '/login');
	if (locals.user.role !== 'admin') {
		const auditContext = auditContextFromEvent(event);
		if (auditContext) {
			await writeAuditLog(db, auditContext, {
				action: 'audit.access_denied',
				entityType: 'audit_ledger',
				entityId: 'list',
				outcome: 'denied'
			});
		}
		redirect(302, '/digaipe');
	}

	const filters = {
		action: url.searchParams.get('action')?.trim() ?? '',
		source: url.searchParams.get('source')?.trim() ?? '',
		actorUserId: url.searchParams.get('actor')?.trim() ?? '',
		entityType: url.searchParams.get('entityType')?.trim() ?? '',
		entityId: url.searchParams.get('entityId')?.trim() ?? '',
		from: url.searchParams.get('from')?.trim() ?? '',
		to: url.searchParams.get('to')?.trim() ?? ''
	};
	const conditions: SQL[] = [];
	if (filters.action) conditions.push(eq(auditEvents.action, filters.action));
	if (filters.source) conditions.push(eq(auditEvents.source, filters.source));
	if (filters.actorUserId) conditions.push(eq(auditEvents.actorUserId, filters.actorUserId));
	if (filters.entityType) conditions.push(eq(auditEvents.entityType, filters.entityType));
	if (filters.entityId) conditions.push(eq(auditEvents.entityId, filters.entityId));
	const from = parseDate(filters.from);
	const to = parseDate(filters.to);
	if (from) conditions.push(gte(auditEvents.occurredAt, from));
	if (to) conditions.push(lte(auditEvents.occurredAt, to));
	const where = conditions.length ? and(...conditions) : undefined;

	const requestedPage = parsePage(url.searchParams.get('page'));
	const [{ total }] = await db.select({ total: count() }).from(auditEvents).where(where);
	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const page = Math.min(requestedPage, totalPages);
	const logs = await db
		.select()
		.from(auditEvents)
		.where(where)
		.orderBy(desc(auditEvents.sequence))
		.limit(PAGE_SIZE)
		.offset((page - 1) * PAGE_SIZE);

	const auditContext = auditContextFromEvent(event);
	if (auditContext) {
		await writeAuditLog(db, auditContext, {
			action: 'audit.log_viewed',
			entityType: 'audit_ledger',
			entityId: 'list',
			metadata: { filters, page, resultCount: logs.length }
		});
	}

	return { logs, page, total, totalPages, filters };
};
