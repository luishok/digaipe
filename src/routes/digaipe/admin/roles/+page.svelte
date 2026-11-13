<script lang="ts">
	import { resolve } from '$app/paths';
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { formatDate } from '$lib/dates';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageData, ActionData } from './$types';
	import { parseRoles, ROLE_LABELS, ROLES } from '$lib/permissions';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let pending = $state(false);

	const submit: SubmitFunction = () => {
		pending = true;
		return async ({ update }) => {
			try { await update(); } finally { pending = false; }
		};
	};

	function pageQuery(page: number) {
		return new URLSearchParams({ search: data.search, role: data.role, page: String(page) });
	}

	// ── Dropdown creación ─────────────────────────────────────────────────
	// Only the initial value (roles kept after a failed submit without JavaScript), on purpose.
	let createRoles  = $state<string[]>(untrack(() => form?.values?.roles ?? []));
	let createOpen   = $state(false);

	// enhance resets the form's inputs after a successful create, but not this state.
	const submitCreate: SubmitFunction = () => {
		pending = true;
		return async ({ result, update }) => {
			try {
				await update();
				if (result.type === 'success') createRoles = [];
			} finally { pending = false; }
		};
	};

	function toggleCreateRole(role: string) {
		createRoles = createRoles.includes(role)
			? createRoles.filter((r) => r !== role)
			: [...createRoles, role];
	}
	function createLabel() {
		return createRoles.length === 0
			? 'Seleccionar roles…'
			: createRoles.map((r) => ROLE_LABELS[r as keyof typeof ROLE_LABELS]).join(', ');
	}

	// ── Dropdown tabla (un dropdown por usuario) ──────────────────────────
	// Rebuilt from the server whenever `data` reloads (after create, setRole, paging...), so a
	// new user's row shows the roles it was saved with. Local picks are a temporary override.
	let tableRolesMap = $derived<Record<string, string[]>>(
		Object.fromEntries(data.users.map((u) => [u.id, parseRoles(u.role)]))
	);
	let tableOpenId = $state<string | null>(null);

	function getTableRoles(userId: string) {
		return tableRolesMap[userId] ?? [];
	}
	function toggleTableRole(userId: string, role: string) {
		const cur = getTableRoles(userId);
		tableRolesMap = {
			...tableRolesMap,
			[userId]: cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role]
		};
	}
	function tableLabel(userId: string) {
		const roles = getTableRoles(userId);
		return roles.length === 0
			? 'Sin roles asignados'
			: roles.map((r) => ROLE_LABELS[r as keyof typeof ROLE_LABELS]).join(', ');
	}

	// Cierra todos los dropdowns al hacer clic fuera
	function handleOutsideClick(e: MouseEvent) {
		if (!(e.target as HTMLElement).closest('.ms-wrapper')) {
			createOpen  = false;
			tableOpenId = null;
		}
	}
</script>

<svelte:window onclick={handleOutsideClick} />

<style>
/* ── Multi-select dropdown compartido ──────────────────────────────────── */
.ms-wrapper { position: relative; width: 100%; }

.ms-trigger {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
	width: 100%;
	min-height: 38px;
	padding: 6px 10px;
	background: #fff;
	border: 1px solid #ced4da;
	border-radius: 4px;
	font-size: 0.875rem;
	color: #1a1a1a;
	font-family: inherit;
	cursor: pointer;
	text-align: left;
	transition: border-color 0.15s, box-shadow 0.15s;
	box-sizing: border-box;
}
.ms-trigger:hover { border-color: #adb5bd; }
.ms-trigger:focus,
.ms-trigger.open {
	outline: none;
	border-color: #003399;
	box-shadow: 0 0 0 3px rgba(0, 51, 153, 0.12);
}

.ms-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ms-label.empty { color: #9ca3af; }

.ms-meta { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

.ms-count {
	background: #003399;
	color: #fff;
	border-radius: 999px;
	font-size: 0.7rem;
	font-weight: 700;
	min-width: 20px;
	height: 20px;
	padding: 0 6px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.ms-arrow { font-size: 0.6rem; color: #6b7280; transition: transform 0.2s; }
.ms-trigger.open .ms-arrow { transform: rotate(180deg); }

.ms-dropdown {
	position: absolute;
	z-index: 200;
	top: calc(100% + 4px);
	left: 0;
	right: 0;
	background: #fff;
	border: 1px solid #d1d5db;
	border-radius: 6px;
	box-shadow: 0 8px 24px rgba(0,0,0,0.1);
	overflow: hidden;
}

.ms-option {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 9px 12px;
	font-size: 0.875rem;
	color: #1e293b;
	cursor: pointer;
	transition: background-color 0.1s;
	user-select: none;
	border: none;
	background: none;
	width: 100%;
	text-align: left;
	font-family: inherit;
}
.ms-option:hover { background-color: #f0f4ff; }
.ms-option:not(:last-child) { border-bottom: 1px solid #f8fafc; }
.ms-option.selected { background-color: #f0f4ff; }

.ms-checkbox {
	width: 16px;
	height: 16px;
	flex-shrink: 0;
	border: 2px solid #cbd5e1;
	border-radius: 3px;
	background: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: background 0.15s, border-color 0.15s;
}
.ms-option.selected .ms-checkbox { background: #003399; border-color: #003399; }
.ms-checkmark { color: #fff; font-size: 11px; line-height: 1; opacity: 0; transition: opacity 0.1s; }
.ms-option.selected .ms-checkmark { opacity: 1; }

/* Botón guardar dentro de la celda */
.btn-save-role {
	margin-top: 6px;
	width: 100%;
	padding: 5px 0;
	font-size: 0.8rem;
	font-weight: 600;
	color: #fff;
	background: #003399;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	font-family: inherit;
	transition: background-color 0.15s;
}
.btn-save-role:hover:not(:disabled) { background: #002266; }
.btn-save-role:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

<svelte:head><title>Usuarios y roles | DIGAIPE</title></svelte:head>

<div class="div-back-links">
	<a aria-label="Volver" href={resolve('/digaipe/admin')}>
		<svg id="back" width="40px" height="40px" data-name="Capa 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 490.66 490.64">
			<path class="cls-1" d="M0,259.65c0-9.58,0-19.16,0-28.74.28-1.38.72-2.74.81-4.13,2.39-34.22,11.44-66.63,28-96.6C66.96,61.08,124.92,18.79,202.55,3.87c9.36-1.8,18.9-2.6,28.36-3.87,9.58,0,19.16,0,28.74,0,1.23.27,2.46.7,3.7.79,34.23,2.33,66.77,11.15,96.67,27.89,80.62,45.14,124.38,114.13,130.17,206.38,2.49,39.68-4.99,78.12-22.75,113.76-43.53,87.36-114.43,134.94-211.86,141.33-44.23,2.9-86.44-6.99-125.34-28.38C61.06,423.71,18.78,365.65,3.87,287.98,2.07,278.63,1.27,269.1,0,259.65ZM245.05,459.9c118.28.2,214.45-95.65,214.85-214.14.4-118.39-95.78-214.89-214.38-215.09-118.28-.2-214.45,95.65-214.85,214.14-.4,118.39,95.78,214.89,214.38,215.09Z"/>
			<path class="cls-2" d="M190.26,229.95c18.19-18.18,35.35-35.32,52.5-52.47,3.84-3.84,7.86-7.52,11.4-11.62,7.34-8.5,3.39-21.66-7.34-24.6-6.69-1.83-12,.74-16.77,5.53-27.47,27.62-55.06,55.12-82.59,82.67-9.51,9.52-9.46,22.17.13,31.76,27.31,27.32,54.63,54.64,81.96,81.95,1.13,1.13,2.23,2.3,3.49,3.27,5.16,3.96,10.8,4.69,16.59,1.68,5.77-3,9.16-8.07,7.97-14.46-.76-4.08-3.04-8.48-5.95-11.46-18.84-19.31-38.03-38.27-57.11-57.36-1.16-1.16-2.27-2.36-4.07-4.24h6.4c50.45,0,100.89,0,151.34,0,1.76,0,3.52.06,5.27-.07,7.76-.57,13.82-6.57,14.37-14.16.55-7.59-4.61-14.5-12.19-16.05-2.16-.44-4.44-.36-6.67-.37-50.77-.02-101.53-.01-152.3-.01h-6.43Z"/>
			<path class="cls-1" d="M190.26,229.95h6.43c50.77,0,101.53,0,152.3.01,2.23,0,4.51-.08,6.67.37,7.59,1.55,12.74,8.46,12.19,16.05-.55,7.59-6.61,13.59-14.37,14.16-1.75.13-3.51.07-5.27.07-50.45,0-100.89,0-151.34,0h-6.4c1.8,1.88,2.91,3.09,4.07,4.24,19.07,19.08,38.27,38.04,57.11,57.36,2.91,2.98,5.19,7.38,5.95,11.46,1.19,6.39-2.21,11.47-7.97,14.46-5.78,3-11.42,2.27-16.59-1.68-1.26-.97-2.36-2.14-3.49-3.27-27.32-27.31-54.64-54.63-81.96-81.95-9.58-9.59-9.64-22.24-.13-31.76,27.54-27.55,55.12-55.05,82.59-82.67,4.77-4.8,10.07-7.37,16.77-5.53,10.73,2.94,14.68,16.09,7.34,24.6-3.54,4.1-7.56,7.78-11.4,11.62-17.15,17.15-34.31,34.3-52.5,52.47Z"/>
		</svg>
	</a>
</div>

<h1>Usuarios y roles</h1>
<p class="subtitle">Administre las cuentas y los permisos de acceso a DIGAIPE.</p>

{#if form?.message}
	<div class="report-alert alert-error mt-4" role="alert">{form.message}</div>
{/if}
{#if form?.success}
	<div class="report-card" role="status">{form.success}</div>
{/if}

<!-- ── Formulario Agregar usuario ─────────────────────────────────────── -->
<section class="report-card" aria-labelledby="create-user">
	<h2 id="create-user" class="report-title">Agregar usuario</h2>
	<form method="POST" action="?/create" use:enhance={submitCreate}>
		<div class="kpi-grid">
			<div class="input-group">
				<label for="name">Nombre completo</label>
				<input id="name" name="name" type="text" required maxlength="255"
					autocomplete="name" defaultValue={form?.values?.name ?? ''} />
			</div>
			<div class="input-group">
				<label for="email">Correo electrónico</label>
				<input id="email" name="email" type="email" required maxlength="255"
					autocomplete="email" defaultValue={form?.values?.email ?? ''} />
			</div>
			<div class="input-group">
				<label for="password">Contraseña (8 a 128 caracteres)</label>
				<input id="password" name="password" type="password" required
					minlength="8" maxlength="128" autocomplete="new-password" />
			</div>

			<!-- Multi-select roles -->
			<div class="input-group">
				<label id="create-roles-label" for="create-roles-trigger">Roles (uno o más)</label>

				{#each createRoles as r (r)}
					<input type="hidden" name="roles" value={r} />
				{/each}

				<div class="ms-wrapper" role="group" aria-labelledby="create-roles-label">
					<button
						id="create-roles-trigger"
						type="button"
						class="ms-trigger"
						class:open={createOpen}
						aria-haspopup="listbox"
						aria-expanded={createOpen}
						onclick={(e) => { e.stopPropagation(); createOpen = !createOpen; }}
					>
						<span class="ms-label" class:empty={createRoles.length === 0}>{createLabel()}</span>
						<span class="ms-meta">
							{#if createRoles.length > 0}<span class="ms-count">{createRoles.length}</span>{/if}
							<span class="ms-arrow">▼</span>
						</span>
					</button>

					{#if createOpen}
						<div class="ms-dropdown" role="listbox" aria-multiselectable="true" aria-labelledby="create-roles-label">
							{#each ROLES as role (role)}
								{@const selected = createRoles.includes(role)}
								<button type="button" class="ms-option" class:selected role="option"
									aria-selected={selected}
									onclick={(e) => { e.stopPropagation(); toggleCreateRole(role); }}>
									<span class="ms-checkbox" aria-hidden="true">
										<span class="ms-checkmark">✓</span>
									</span>
									{ROLE_LABELS[role]}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<p><small>Administrador: todo, incluidos usuarios y auditoría. Auditor: puede ver todo, sin modificar nada.</small></p>
		<div class="filter-actions">
			<button type="submit" class="btn-submit" disabled={pending}>Agregar usuario</button>
		</div>
	</form>
</section>

<!-- ── Tabla usuarios ─────────────────────────────────────────────────── -->
<section class="data-section" aria-labelledby="users-title">
	<div class="section-header">
		<h2 id="users-title">Usuarios registrados <span class="count-badge">{data.total}</span></h2>
	</div>

	<form method="GET" class="filter-card">
		<div class="filter-row-flex">
			<div class="label-input">
				<label>Correo electrónico
					<input type="search" name="search" maxlength="255"
						value={data.search} placeholder="Buscar por correo" />
				</label>
			</div>
			<div class="label-input">
				<label>Rol
					<select name="role" value={data.role}>
						<option value="">Todos</option>
						{#each ROLES as role (role)}<option value={role}>{ROLE_LABELS[role]}</option>{/each}
					</select>
				</label>
			</div>
			<div class="filter-actions">
				<button type="submit" class="btn-submit" disabled={pending}>Buscar</button>
				<a href={resolve('/digaipe/admin/roles')} class="btn-secondary">Limpiar</a>
			</div>
		</div>
	</form>

	<p><small>Su propia cuenta está protegida. Los cambios de rol y de contraseña cierran las sesiones del usuario afectado.</small></p>

	<div class="table-container">
		<table class="custom-table">
			<thead>
				<tr>
					<th scope="col">Usuario</th>
					<th scope="col">Correo electrónico</th>
					<th scope="col">Fecha de creación</th>
					<th scope="col">Rol</th>
					<th scope="col">Contraseña</th>
					<th scope="col">Eliminar</th>
				</tr>
			</thead>
			<tbody>
				{#each data.users as user (user.id)}
					{@const isSelf = user.id === data.currentUserId}
					<tr>
						<td class="font-medium">
							{user.name}
							{#if isSelf}<span class="count-badge">Su cuenta</span>{/if}
						</td>
						<td>{user.email}</td>
						<td class="whitespace-nowrap">
							{formatDate(user.createdAt)}
						</td>

						<!-- Columna Rol -->
						<td>
							{#if isSelf}
								<span class="status-badge">
									{parseRoles(user.role).map((r) => ROLE_LABELS[r as keyof typeof ROLE_LABELS]).join(', ')}
								</span>
							{:else}
								{@const tableRoles = getTableRoles(user.id)}
								{@const isOpen = tableOpenId === user.id}

								<form class="admin-cell-action" method="POST" action="?/setRole" use:enhance={submit}>
									<input type="hidden" name="userId" value={user.id} />

									<!-- Inputs hidden reactivos -->
									{#each tableRoles as r (r)}
										<input type="hidden" name="roles" value={r} />
									{/each}

									<!-- Dropdown multi-select -->
									<div class="ms-wrapper">
										<button
											type="button"
											class="ms-trigger"
											class:open={isOpen}
											aria-haspopup="listbox"
											aria-expanded={isOpen}
											aria-label={`Roles de ${user.name}`}
											disabled={pending}
											onclick={(e) => {
												e.stopPropagation();
												tableOpenId = tableOpenId === user.id ? null : user.id;
											}}
										>
											<span class="ms-label" class:empty={tableRoles.length === 0}>
												{tableLabel(user.id)}
											</span>
											<span class="ms-meta">
												{#if tableRoles.length > 0}
													<span class="ms-count">{tableRoles.length}</span>
												{/if}
												<span class="ms-arrow">▼</span>
											</span>
										</button>

										{#if isOpen}
											<div class="ms-dropdown" role="listbox" aria-multiselectable="true">
												{#each ROLES as role (role)}
													{@const selected = tableRoles.includes(role)}
													<button
														type="button"
														class="ms-option"
														class:selected
														role="option"
														aria-selected={selected}
														onclick={(e) => { e.stopPropagation(); toggleTableRole(user.id, role); }}
													>
														<span class="ms-checkbox" aria-hidden="true">
															<span class="ms-checkmark">✓</span>
														</span>
														{ROLE_LABELS[role]}
													</button>
												{/each}
											</div>
										{/if}
									</div>

									<button
										type="submit"
										class="btn-save-role"
										disabled={pending}
										aria-label={`Guardar roles de ${user.name}`}
									>Guardar</button>
								</form>
							{/if}
						</td>

						<!-- Columna Contraseña -->
						<td>
							{#if isSelf}
								<a href={resolve('/digaipe/cambiar-password')}>Cambiar mi contraseña</a>
							{:else}
								<details>
									<summary>Restablecer contraseña</summary>
									<form method="POST" action="?/resetPassword" use:enhance={submit}>
										<input type="hidden" name="userId" value={user.id} />
										<p>El usuario deberá cambiarla al iniciar sesión. Sus sesiones abiertas se cerrarán.</p>
										<div class="input-group">
											<label for={`reset-password-${user.id}`}>Contraseña temporal (8 a 128 caracteres)</label>
											<input id={`reset-password-${user.id}`} name="password" type="password"
												required minlength="8" maxlength="128" autocomplete="new-password"
												disabled={pending} />
										</div>
										<button class="btn-submit mt-4" type="submit" disabled={pending}>
											Restablecer
										</button>
									</form>
								</details>
							{/if}
						</td>

						<!-- Columna Eliminar -->
						<td>
							{#if isSelf}
								<small>Cuenta protegida</small>
							{:else}
								<details>
									<summary>Eliminar usuario</summary>
									<form method="POST" action="?/delete" use:enhance={submit}>
										<input type="hidden" name="userId" value={user.id} />
										<p>Esta acción elimina la cuenta y sus sesiones.</p>
										<label class="checkbox-chip">
											<input type="checkbox" name="confirm" value={user.id}
												required disabled={pending} />
											Confirmo eliminar a {user.name} ({user.email})
										</label>
										<button class="btn-unlock mt-4" type="submit" disabled={pending}>
											Eliminar definitivamente
										</button>
									</form>
								</details>
							{/if}
						</td>
					</tr>
				{:else}
					<tr><td colspan="6">No se encontraron usuarios con los filtros seleccionados.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>

	<nav class="filter-actions" aria-label="Paginación de usuarios">
		{#if data.page > 1}
			<a class="btn-secondary" href={resolve(`/digaipe/admin/roles?${pageQuery(data.page - 1)}`)}>Anterior</a>
		{/if}
		<span>Página {data.page} de {data.totalPages}</span>
		{#if data.page < data.totalPages}
			<a class="btn-secondary" href={resolve(`/digaipe/admin/roles?${pageQuery(data.page + 1)}`)}>Siguiente</a>
		{/if}
	</nav>
</section>
