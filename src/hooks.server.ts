import { error, redirect, type Handle } from '@sveltejs/kit';
import { can, type Permission } from '$lib/permissions';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { auditContextFromEvent, writeAuditLog } from '$lib/server/audit';
import { db } from '$lib/server/db';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { randomUUID } from 'node:crypto';

// Only the better-auth HTTP endpoints the app uses. Everything else (direct sign-in, the admin
// plugin's impersonate/set-password/ban/remove, update-user, change-password, ...) would bypass
// the app's permission checks and audit events, so it gets a 404. Sign-in and sign-out go
// through the /login and /digaipe form actions, which audit them.
const allowedAuthEndpoints = new Set(['GET /api/auth/get-session']);

const handleAuthAllowlist: Handle = async ({ event, resolve }) => {
	let pathname: string;
	try {
		pathname = decodeURIComponent(event.url.pathname).toLowerCase();
	} catch {
		return new Response('Not found', { status: 404 });
	}
	const isAuthApi = pathname === '/api/auth' || pathname.startsWith('/api/auth/');
	if (isAuthApi && !allowedAuthEndpoints.has(`${event.request.method} ${pathname}`)) {
		return new Response('Not found', { status: 404 });
	}
	return resolve(event);
};

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	event.locals.auditCorrelationId = randomUUID();
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

// Route ids (not URL paths) so encoding or casing tricks cannot slip past the check.
const authenticatedRoutes = ['/digaipe', '/data'];

function isUnder(routeId: string, prefixes: string[]) {
	return prefixes.some((prefix) => routeId === prefix || routeId.startsWith(`${prefix}/`));
}

// Viewing: a request to a route (or anything below it) needs, for every rule that matches,
// at least one of the listed permissions. See src/lib/permissions.ts for who holds what.
const viewRules: { route: string; anyOf: Permission[] }[] = [
	{ route: '/digaipe/estadisticas', anyOf: ['statistics.view'] },
	{ route: '/digaipe/admisiones', anyOf: ['admissions.view'] },
	{ route: '/digaipe/admisiones/cargar', anyOf: ['admissions.upload'] },
	{ route: '/digaipe/procesos-adm', anyOf: ['processes.view'] },
	{ route: '/digaipe/carreras', anyOf: ['catalogs.view'] },
	{ route: '/digaipe/modalidades-adm', anyOf: ['catalogs.view'] },
	{ route: '/digaipe/generacion-planilla', anyOf: ['planillas.view'] },
	{ route: '/digaipe/revision-documentos', anyOf: ['documents.view'] },
	{ route: '/digaipe/admin', anyOf: ['users.manage', 'audit.view'] },
	{ route: '/digaipe/admin/roles', anyOf: ['users.manage'] },
	{ route: '/digaipe/admin/audit', anyOf: ['audit.view'] }
];

// Changing anything (every method except GET/HEAD) is looked up here by
// "<route id> <method> <form action>", with "default" for the default action and for +server
// endpoints. Anything not listed is refused, so a new form action stays closed until someone
// decides who may use it. `null` means any signed-in user.
const writeRules: Record<string, Permission | null> = {
	'/digaipe POST signOut': null,
	'/digaipe/admin/roles POST create': 'users.manage',
	'/digaipe/admin/roles POST setRole': 'users.manage',
	'/digaipe/admin/roles POST delete': 'users.manage',
	'/digaipe/admisiones/cargar POST preview': 'admissions.upload',
	'/digaipe/admisiones/cargar POST save': 'admissions.upload',
	'/digaipe/admisiones/cargar/[batchId] POST save': 'admissions.upload',
	'/digaipe/carreras POST default': 'catalogs.import',
	'/digaipe/generacion-planilla/[admissionId] POST updateStudent': 'students.edit',
	'/digaipe/generacion-planilla/[admissionId]/pdf POST default': 'planillas.generate',
	'/digaipe/procesos-adm POST create': 'processes.manage',
	'/digaipe/procesos-adm POST saveDates': 'processes.manage',
	'/digaipe/revision-documentos POST review': 'documents.review',
	'/digaipe/revision-documentos POST unlock': 'documents.unlock'
};

function formActionName(url: URL) {
	const key = [...url.searchParams.keys()].find((name) => name.startsWith('/'));
	return key ? key.slice(1) : 'default';
}

/** The permission this request lacks, or null when it is allowed. */
function missingPermission(event: Parameters<Handle>[0]['event'], routeId: string) {
	const user = event.locals.user;
	for (const rule of viewRules) {
		if (isUnder(routeId, [rule.route]) && !rule.anyOf.some((permission) => can(user, permission))) {
			return rule.anyOf.join('|');
		}
	}
	const method = event.request.method;
	if (method === 'GET' || method === 'HEAD') return null;
	const key = `${routeId} ${method} ${formActionName(event.url)}`;
	if (!(key in writeRules)) return `unlisted:${key}`;
	const permission = writeRules[key];
	return permission && !can(user, permission) ? permission : null;
}

// Central guard. Layout `load` guards are not enough: a client can request a page's
// __data.json without running its parent layouts, and form actions and +server endpoints
// never run layout loads. Per-route checks stay as a second layer.
const handleAuthorization: Handle = async ({ event, resolve }) => {
	const routeId = event.route.id;
	if (!routeId || !isUnder(routeId, authenticatedRoutes)) return resolve(event);
	if (!event.locals.user) redirect(303, '/login');

	const missing = missingPermission(event, routeId);
	if (missing) {
		const auditContext = auditContextFromEvent(event);
		if (auditContext) {
			await writeAuditLog(db, auditContext, {
				action: 'route.access_denied',
				entityType: 'route',
				entityId: routeId,
				metadata: {
					method: event.request.method,
					action: formActionName(event.url),
					missing,
					roles: event.locals.user.role ?? null
				},
				outcome: 'denied'
			});
		}
		const isWrite = event.request.method !== 'GET' && event.request.method !== 'HEAD';
		if (isWrite) error(403, 'No tiene permiso para realizar esta acción.');
		redirect(303, '/digaipe');
	}

	return resolve(event);
};

const securityHeaders = {
	'X-Content-Type-Options': 'nosniff',
	// Also covered by CSP frame-ancestors on pages; this covers endpoints and older browsers.
	'X-Frame-Options': 'DENY',
	'Referrer-Policy': 'same-origin',
	'Cross-Origin-Opener-Policy': 'same-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
};

// First in the chain, so every response gets the headers, including the allowlist's 404s.
const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	try {
		for (const [name, value] of Object.entries(securityHeaders)) response.headers.set(name, value);
		// Student data must not stay in the browser cache of a shared PC after sign-out.
		if (event.route.id && isUnder(event.route.id, authenticatedRoutes) && !response.headers.has('cache-control')) {
			response.headers.set('Cache-Control', 'no-store');
		}
	} catch {
		// Responses built with Response.redirect() have immutable headers; nothing to protect there.
	}
	return response;
};

export const handle: Handle = sequence(
	handleSecurityHeaders,
	handleAuthAllowlist,
	handleBetterAuth,
	handleAuthorization
);
