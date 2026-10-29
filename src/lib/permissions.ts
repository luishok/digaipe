// Roles and what each one may do. Shared by the server (hooks, actions) and the pages (menu,
// buttons), so both always agree. A user may hold several roles, stored comma-separated in
// `user.role` (the format better-auth's admin plugin uses).

export const ROLES = ['admin', 'planillas', 'revisor', 'estadisticas', 'cargador', 'auditor'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
	admin: 'Administrador',
	planillas: 'Generación de planillas',
	revisor: 'Matrícula y devolución',
	estadisticas: 'Estadísticas',
	cargador: 'Carga de admisiones',
	auditor: 'Auditor (solo lectura)'
};

export const PERMISSIONS = [
	'statistics.view',
	'admissions.view',
	'admissions.upload',
	'processes.view',
	'processes.manage',
	'catalogs.view',
	'catalogs.import',
	'planillas.view',
	'planillas.generate',
	'students.edit',
	'documents.view',
	'documents.review',
	'documents.unlock',
	'audit.view',
	'users.manage'
] as const;
export type Permission = (typeof PERMISSIONS)[number];

// Read-only permissions: everything the auditor role gets.
const viewPermissions = PERMISSIONS.filter((permission) => permission.endsWith('.view'));

const grants: Record<Role, readonly Permission[]> = {
	admin: PERMISSIONS,
	planillas: ['planillas.view', 'planillas.generate', 'students.edit', 'catalogs.view'],
	revisor: ['documents.view', 'documents.review', 'documents.unlock', 'catalogs.view'],
	estadisticas: ['statistics.view', 'catalogs.view'],
	cargador: [
		'admissions.view',
		'admissions.upload',
		'processes.view',
		'processes.manage',
		'catalogs.view',
		'catalogs.import'
	],
	auditor: viewPermissions
};

const isRole = (value: string): value is Role => (ROLES as readonly string[]).includes(value);

/** The valid roles in a stored `user.role` value. Unknown values (e.g. the old "user") grant nothing. */
export function parseRoles(stored: string | null | undefined): Role[] {
	return [...new Set((stored ?? '').split(',').map((role) => role.trim()).filter(isRole))];
}

/** Canonical stored form: known roles only, in ROLES order, comma-separated. */
export function formatRoles(roles: readonly string[]): string {
	return ROLES.filter((role) => roles.includes(role)).join(',');
}

export function can(user: { role?: string | null } | null | undefined, permission: Permission) {
	return parseRoles(user?.role).some((role) => grants[role].includes(permission));
}
