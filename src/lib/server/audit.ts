import type { RequestEvent } from '@sveltejs/kit';
import { auditLogs } from '$lib/server/db/schema';

type AuditWriter = {
	insert: typeof import('$lib/server/db').db.insert;
};

export type AuditContext = {
	actorUserId: string;
	ipAddress: string | null;
	userAgent: string | null;
};

export type AuditEntry = {
	action: string;
	entityType: string;
	entityId: string | number;
	before?: unknown;
	after?: unknown;
	metadata?: unknown;
};

const sensitiveKeys = new Set([
	'password',
	'token',
	'accessToken',
	'refreshToken',
	'idToken',
	'cedula',
	'apellidos_nombres',
	'apellidosNombres',
	'telefono',
	'correo',
	'email',
	'genero'
]);

export function auditContextFromEvent(event: RequestEvent): AuditContext | null {
	if (!event.locals.user) return null;

	return {
		actorUserId: event.locals.user.id,
		ipAddress: event.getClientAddress(),
		userAgent: event.request.headers.get('user-agent')
	};
}

export async function writeAuditLog(writer: AuditWriter, context: AuditContext, entry: AuditEntry) {
	await writer.insert(auditLogs).values({
		actorUserId: context.actorUserId,
		action: entry.action,
		entityType: entry.entityType,
		entityId: String(entry.entityId),
		before: redactAuditValue(entry.before ?? null),
		after: redactAuditValue(entry.after ?? null),
		metadata: redactAuditValue(entry.metadata ?? null),
		ipAddress: context.ipAddress,
		userAgent: context.userAgent
	});
}

function redactAuditValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(redactAuditValue);
	if (!value || typeof value !== 'object') return value;

	return Object.fromEntries(
		Object.entries(value).map(([key, nestedValue]) => [
			key,
			sensitiveKeys.has(key) ? '[REDACTED]' : redactAuditValue(nestedValue)
		])
	);
}
