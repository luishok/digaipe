import { createHash, randomUUID } from 'node:crypto';
import type { RequestEvent } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import type { db } from '$lib/server/db';

type AuditWriter = Pick<typeof db, 'execute'>;

export type AuditContext = {
	actorUserId: string | null;
	actorName: string | null;
	actorEmail: string | null;
	correlationId: string;
	ipAddress: string | null;
	userAgent: string | null;
};

export type AuditOutcome = 'success' | 'failure' | 'denied';

export type AuditEntry = {
	action: AuditAction;
	entityType: string;
	entityId: string | number;
	before?: unknown;
	after?: unknown;
	metadata?: unknown;
	outcome?: AuditOutcome;
};

export type AuditAction =
	| 'user_role.changed'
	| 'career.imported'
	| 'admission_process.created'
	| 'admission_process.dates_added'
	| 'admission_import_batch.created'
	| 'admission_import_batch.saved'
	| 'admission_planilla.student_updated'
	| 'auth.sign_in_succeeded'
	| 'auth.sign_in_failed'
	| 'auth.sign_up_succeeded'
	| 'auth.sign_up_failed'
	| 'auth.sign_out'
	| 'audit.log_viewed'
	| 'audit.access_denied'
	| 'audit.exported'
	| 'admission_statistics.exported'
	| 'admission_planilla.generated'
	| 'admission_document.reviewed'
	| 'admission_document.unlocked';

type AuditPolicy = {
	retainFullValues?: boolean;
};

const auditPolicies: Record<AuditAction, AuditPolicy> = {
	'user_role.changed': {},
	'career.imported': {},
	'admission_process.created': {},
	'admission_process.dates_added': {},
	'admission_import_batch.created': {},
	'admission_import_batch.saved': {},
	'admission_planilla.student_updated': { retainFullValues: true },
	'auth.sign_in_succeeded': {},
	'auth.sign_in_failed': {},
	'auth.sign_up_succeeded': {},
	'auth.sign_up_failed': {},
	'auth.sign_out': {},
	'audit.log_viewed': {},
	'audit.access_denied': {},
	'audit.exported': {},
	'admission_statistics.exported': {},
	'admission_planilla.generated': {},
	'admission_document.reviewed': {},
	'admission_document.unlocked': {}
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
		actorName: event.locals.user.name ?? null,
		actorEmail: event.locals.user.email ?? null,
		correlationId: event.locals.auditCorrelationId,
		ipAddress: event.getClientAddress(),
		userAgent: event.request.headers.get('user-agent')
	};
}

export function anonymousAuditContextFromEvent(event: RequestEvent): AuditContext {
	return {
		actorUserId: null,
		actorName: null,
		actorEmail: null,
		correlationId: event.locals.auditCorrelationId || randomUUID(),
		ipAddress: event.getClientAddress(),
		userAgent: event.request.headers.get('user-agent')
	};
}

export async function setAuditDatabaseContext(writer: AuditWriter, context: AuditContext) {
	await writer.execute(sql`
		SET
			@digaipe_audit_actor_user_id = ${context.actorUserId},
			@digaipe_audit_actor_name = ${context.actorName},
			@digaipe_audit_actor_email = ${context.actorEmail},
			@digaipe_audit_correlation_id = ${context.correlationId}
	`);
}

export async function writeAuditLog(writer: AuditWriter, context: AuditContext, entry: AuditEntry) {
	const policy = auditPolicies[entry.action];
	const before = prepareAuditValue(entry.before, policy);
	const after = prepareAuditValue(entry.after, policy);
	const metadata = redactAuditValue(entry.metadata ?? null);

	try {
		await writer.execute(sql`
			CALL append_audit_event(
				${randomUUID()},
				${'application'},
				${entry.action},
				${entry.outcome ?? 'success'},
				${context.actorUserId},
				${context.actorName},
				${context.actorEmail},
				${context.correlationId},
				${context.ipAddress},
				${context.userAgent},
				${entry.entityType},
				${String(entry.entityId)},
				${JSON.stringify(before)},
				${JSON.stringify(after)},
				${JSON.stringify(metadata)}
			)
		`);
	} finally {
		await writer.execute(sql`
			SET
				@digaipe_audit_actor_user_id = NULL,
				@digaipe_audit_actor_name = NULL,
				@digaipe_audit_actor_email = NULL,
				@digaipe_audit_correlation_id = NULL
		`);
	}
}

export function hashAuditIdentifier(value: string) {
	return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function prepareAuditValue(value: unknown, policy: AuditPolicy): unknown {
	if (policy.retainFullValues) return value ?? null;
	return redactAuditValue(value ?? null);
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
