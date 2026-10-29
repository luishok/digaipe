import { createHash, randomUUID } from 'node:crypto';
import type { RequestEvent } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';

type AuditWriter = Pick<typeof db, 'execute'>;
type AuditTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
	| 'user.created'
	| 'user.deleted'
	| 'user_role.changed'
	| 'career.imported'
	| 'admission_process.created'
	| 'admission_process.dates_added'
	| 'admission_import_batch.created'
	| 'admission_import_batch.saved'
	| 'admission_import_batch.integrity_failed'
	| 'admission_planilla.student_updated'
	| 'auth.sign_in_succeeded'
	| 'auth.sign_in_failed'
	| 'auth.sign_in_blocked'
	| 'auth.sign_up_succeeded'
	| 'auth.sign_up_failed'
	| 'auth.sign_out'
	| 'audit.log_viewed'
	| 'audit.access_denied'
	| 'route.access_denied'
	| 'audit.exported'
	| 'admission_statistics.exported'
	| 'admission_planilla.generated'
	| 'admission_planilla.printed'
	| 'student_data.viewed'
	| 'admission_document.reviewed'
	| 'admission_document.unlocked';

type AuditPolicy = {
	retainFullValues?: boolean;
};

const auditPolicies: Record<AuditAction, AuditPolicy> = {
	'user.created': {},
	'user.deleted': {},
	'user_role.changed': {},
	'career.imported': {},
	'admission_process.created': {},
	'admission_process.dates_added': {},
	'admission_import_batch.created': {},
	'admission_import_batch.saved': {},
	'admission_import_batch.integrity_failed': {},
	'admission_planilla.student_updated': { retainFullValues: true },
	'auth.sign_in_succeeded': {},
	'auth.sign_in_failed': {},
	'auth.sign_in_blocked': {},
	'auth.sign_up_succeeded': {},
	'auth.sign_up_failed': {},
	'auth.sign_out': {},
	'audit.log_viewed': {},
	'audit.access_denied': {},
	'route.access_denied': {},
	'audit.exported': {},
	'admission_statistics.exported': {},
	'admission_planilla.generated': {},
	'admission_planilla.printed': {},
	'student_data.viewed': {},
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

/**
 * Runs `operation` in a transaction whose database triggers attribute their audit rows to
 * `context`. This is the only way to set that attribution: MySQL session variables outlive
 * the transaction on pooled connections, so they are always cleared in `finally`, even after
 * an early return or an error. Otherwise the next trigger-audited write on that connection
 * would be credited to this user.
 */
export async function auditedTransaction<T>(
	context: AuditContext,
	operation: (tx: AuditTransaction) => Promise<T>
): Promise<T> {
	return db.transaction(async (tx) => {
		await setAuditDatabaseContext(tx, context);
		try {
			return await operation(tx);
		} finally {
			await clearAuditDatabaseContext(tx);
		}
	});
}

async function setAuditDatabaseContext(writer: AuditWriter, context: AuditContext) {
	await writer.execute(sql`
		SET
			@digaipe_audit_actor_user_id = ${context.actorUserId},
			@digaipe_audit_actor_name = ${context.actorName},
			@digaipe_audit_actor_email = ${context.actorEmail},
			@digaipe_audit_correlation_id = ${context.correlationId}
	`);
}

async function clearAuditDatabaseContext(writer: AuditWriter) {
	await writer.execute(sql`
		SET
			@digaipe_audit_actor_user_id = NULL,
			@digaipe_audit_actor_name = NULL,
			@digaipe_audit_actor_email = NULL,
			@digaipe_audit_correlation_id = NULL
	`);
}

export async function writeAuditLog(writer: AuditWriter, context: AuditContext, entry: AuditEntry) {
	const policy = auditPolicies[entry.action];
	const before = prepareAuditValue(entry.before, policy);
	const after = prepareAuditValue(entry.after, policy);
	const metadata = redactAuditValue(entry.metadata ?? null);

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
}

// Bounds the size of one view event; the full count is always recorded.
const MAX_VIEWED_IDS = 500;

/**
 * Records that a page showed student data to the signed-in user: which page, with which
 * filters, and which records. Answers "who looked at this student's record, and when".
 *
 * A search term is stored only as a hash (hashAuditIdentifier): people type cédulas there, and
 * the ledger cannot be edited later. A known cédula can still be matched against the hash.
 * Runs before the data is returned, so if the audit write fails the page fails too: no
 * unrecorded access.
 */
export async function auditStudentDataView(
	event: RequestEvent,
	view: {
		page: string;
		recordType: 'admission' | 'admission_processing';
		recordIds: (number | string)[];
		filters?: Record<string, unknown>;
		search?: string;
	}
) {
	const context = auditContextFromEvent(event);
	if (!context) return;
	const search = view.search?.trim();
	await writeAuditLog(db, context, {
		action: 'student_data.viewed',
		entityType: 'page',
		entityId: view.page,
		metadata: {
			recordType: view.recordType,
			resultCount: view.recordIds.length,
			recordIds: view.recordIds.slice(0, MAX_VIEWED_IDS),
			recordIdsTruncated: view.recordIds.length > MAX_VIEWED_IDS,
			filters: view.filters ?? {},
			searchHash: search ? hashAuditIdentifier(search) : null
		}
	});
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
