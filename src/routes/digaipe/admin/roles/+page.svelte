<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageData, ActionData } from './$types';
	import { parseRoles, ROLE_LABELS, ROLES } from '$lib/permissions';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let pending = $state(false);
	const submit: SubmitFunction = () => {
		pending = true;
		return async ({ update }) => {
			try {
				await update();
			} finally {
				pending = false;
			}
		};
	};
	function pageQuery(page: number) {
		return new URLSearchParams({ search: data.search, role: data.role, page: String(page) });
	}
</script>

<svelte:head><title>Usuarios y roles | DIGAIPE</title></svelte:head>
<div class="div-back-links">
	<a href={resolve('/digaipe/admin')}>
		<svg id="back" width='40px' height='40px' data-name="Capa 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 490.66 490.64">  <path class="cls-1" d="M0,259.65c0-9.58,0-19.16,0-28.74.28-1.38.72-2.74.81-4.13,2.39-34.22,11.44-66.63,28-96.6C66.96,61.08,124.92,18.79,202.55,3.87c9.36-1.8,18.9-2.6,28.36-3.87,9.58,0,19.16,0,28.74,0,1.23.27,2.46.7,3.7.79,34.23,2.33,66.77,11.15,96.67,27.89,80.62,45.14,124.38,114.13,130.17,206.38,2.49,39.68-4.99,78.12-22.75,113.76-43.53,87.36-114.43,134.94-211.86,141.33-44.23,2.9-86.44-6.99-125.34-28.38C61.06,423.71,18.78,365.65,3.87,287.98,2.07,278.63,1.27,269.1,0,259.65ZM245.05,459.9c118.28.2,214.45-95.65,214.85-214.14.4-118.39-95.78-214.89-214.38-215.09-118.28-.2-214.45,95.65-214.85,214.14-.4,118.39,95.78,214.89,214.38,215.09Z"/>  <path class="cls-2" d="M190.26,229.95c18.19-18.18,35.35-35.32,52.5-52.47,3.84-3.84,7.86-7.52,11.4-11.62,7.34-8.5,3.39-21.66-7.34-24.6-6.69-1.83-12,.74-16.77,5.53-27.47,27.62-55.06,55.12-82.59,82.67-9.51,9.52-9.46,22.17.13,31.76,27.31,27.32,54.63,54.64,81.96,81.95,1.13,1.13,2.23,2.3,3.49,3.27,5.16,3.96,10.8,4.69,16.59,1.68,5.77-3,9.16-8.07,7.97-14.46-.76-4.08-3.04-8.48-5.95-11.46-18.84-19.31-38.03-38.27-57.11-57.36-1.16-1.16-2.27-2.36-4.07-4.24h6.4c50.45,0,100.89,0,151.34,0,1.76,0,3.52.06,5.27-.07,7.76-.57,13.82-6.57,14.37-14.16.55-7.59-4.61-14.5-12.19-16.05-2.16-.44-4.44-.36-6.67-.37-50.77-.02-101.53-.01-152.3-.01h-6.43Z"/>  <path class="cls-1" d="M190.26,229.95h6.43c50.77,0,101.53,0,152.3.01,2.23,0,4.51-.08,6.67.37,7.59,1.55,12.74,8.46,12.19,16.05-.55,7.59-6.61,13.59-14.37,14.16-1.75.13-3.51.07-5.27.07-50.45,0-100.89,0-151.34,0h-6.4c1.8,1.88,2.91,3.09,4.07,4.24,19.07,19.08,38.27,38.04,57.11,57.36,2.91,2.98,5.19,7.38,5.95,11.46,1.19,6.39-2.21,11.47-7.97,14.46-5.78,3-11.42,2.27-16.59-1.68-1.26-.97-2.36-2.14-3.49-3.27-27.32-27.31-54.64-54.63-81.96-81.95-9.58-9.59-9.64-22.24-.13-31.76,27.54-27.55,55.12-55.05,82.59-82.67,4.77-4.8,10.07-7.37,16.77-5.53,10.73,2.94,14.68,16.09,7.34,24.6-3.54,4.1-7.56,7.78-11.4,11.62-17.15,17.15-34.31,34.3-52.5,52.47Z"/></svg>
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

<section class="report-card" aria-labelledby="create-user">
	<h2 id="create-user" class="report-title">Agregar usuario</h2>
	<form method="POST" action="?/create" use:enhance={submit}>
		<div class="kpi-grid">
			<div class="input-group">
				<label for="name">Nombre completo</label>
				<input
					id="name"
					name="name"
					type="text"
					required
					maxlength="255"
					autocomplete="name"
					value={form?.values?.name ?? ''}
				/>
			</div>
			<div class="input-group">
				<label for="email">Correo electrónico</label>
				<input
					id="email"
					name="email"
					type="email"
					required
					maxlength="255"
					autocomplete="email"
					value={form?.values?.email ?? ''}
				/>
			</div>
			<div class="input-group">
				<label for="password">Contraseña (8 a 128 caracteres)</label>
				<input
					id="password"
					name="password"
					type="password"
					required
					minlength="8"
					maxlength="128"
					autocomplete="new-password"
				/>
			</div>
			<fieldset class="input-group">
				<legend>Roles (uno o más)</legend>
				{#each ROLES as role (role)}
					<label
						><input
							type="checkbox"
							name="roles"
							value={role}
							checked={form?.values?.roles?.includes(role) ?? false}
						/>
						{ROLE_LABELS[role]}</label
					>
				{/each}
			</fieldset>
		</div>
		<p>
			<small
				>Administrador: todo, incluidos usuarios y auditoría. Auditor: puede ver todo, sin
				modificar nada.</small
			>
		</p>
		<div class="filter-actions">
			<button type="submit" disabled={pending}>Agregar usuario</button>
		</div>
	</form>
</section>

<section class="data-section" aria-labelledby="users-title">
	<div class="section-header">
		<h2 id="users-title">Usuarios registrados <span class="count-badge">{data.total}</span></h2>
	</div>
	<form method="GET" class="filter-card">
		<div class="filter-row-flex">
			<div class="label-input">
				<label
					>Correo electrónico <input
						type="search"
						name="search"
						maxlength="255"
						value={data.search}
						placeholder="Buscar por correo"
					/></label
				>
			</div>
			<div class="label-input">
				<label
					>Rol <select name="role" value={data.role}
						><option value="">Todos</option>
						{#each ROLES as role (role)}<option value={role}>{ROLE_LABELS[role]}</option>{/each}</select
					></label
				>
			</div>
			<button type="submit" disabled={pending}>Buscar</button>
			<a href={resolve('/digaipe/admin/roles')}>Limpiar</a>
		</div>
	</form>
	<p>
		<small
			>Su propia cuenta está protegida. Los cambios de rol cierran las sesiones del usuario
			afectado.</small
		>
	</p>
	<div class="table-container">
		<table class="custom-table">
			<thead
				><tr
					><th scope="col">Usuario</th><th scope="col">Correo electrónico</th><th scope="col"
						>Fecha de creación</th
					><th scope="col">Rol</th><th scope="col">Eliminar</th></tr
				></thead
			>
			<tbody>
				{#each data.users as user (user.id)}
					{@const isSelf = user.id === data.currentUserId}
					<tr>
						<td class="font-medium"
							>{user.name}
							{#if isSelf}<span class="count-badge">Su cuenta</span>{/if}</td
						>
						<td>{user.email}</td>
						<td class="whitespace-nowrap"
							>{new Date(user.createdAt).toLocaleDateString('es-VE', { timeZone: 'UTC' })}</td
						>
						<td>
							{#if isSelf}<span class="status-badge"
									>{parseRoles(user.role).map((role) => ROLE_LABELS[role]).join(', ')}</span
								>
							{:else}
								<form
									class="admin-cell-action"
									method="POST"
									action="?/setRole"
									use:enhance={submit}
								>
									<input type="hidden" name="userId" value={user.id} />
									<fieldset aria-label={`Roles de ${user.name}`} disabled={pending}>
										{#each ROLES as role (role)}
											<label
												><input
													type="checkbox"
													name="roles"
													value={role}
													checked={parseRoles(user.role).includes(role)}
												/>
												{ROLE_LABELS[role]}</label
											>
										{/each}
										{#if parseRoles(user.role).length === 0}<small>Sin roles asignados</small>{/if}
									</fieldset>
									<button
										type="submit"
										disabled={pending}
										aria-label={`Guardar roles de ${user.name}`}>Guardar</button
									>
								</form>
							{/if}
						</td>
						<td>
							{#if isSelf}<small>Cuenta protegida</small>
							{:else}
								<details>
									<summary>Eliminar usuario</summary>
									<form method="POST" action="?/delete" use:enhance={submit}>
										<input type="hidden" name="userId" value={user.id} />
										<p>Esta acción elimina la cuenta y sus sesiones.</p>
										<label class="checkbox-chip"
											><input
												type="checkbox"
												name="confirm"
												value={user.id}
												required
												disabled={pending}
											/>
											Confirmo eliminar a {user.name} ({user.email})</label
										>
										<button class="btn-unlock mt-4" type="submit" disabled={pending}
											>Eliminar definitivamente</button
										>
									</form>
								</details>
							{/if}
						</td>
					</tr>
				{:else}<tr
						><td colspan="5">No se encontraron usuarios con los filtros seleccionados.</td></tr
					>{/each}
			</tbody>
		</table>
	</div>
	<nav class="filter-actions" aria-label="Paginación de usuarios">
		{#if data.page > 1}<a
				class="btn"
				href={resolve(`/digaipe/admin/roles?${pageQuery(data.page - 1)}`)}>Anterior</a
			>{/if}
		<span>Página {data.page} de {data.totalPages}</span>
		{#if data.page < data.totalPages}<a
				class="btn"
				href={resolve(`/digaipe/admin/roles?${pageQuery(data.page + 1)}`)}>Siguiente</a
			>{/if}
	</nav>
</section>
