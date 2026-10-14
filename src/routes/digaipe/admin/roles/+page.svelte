<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageData, ActionData } from './$types';

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

<h1>Usuarios y roles</h1>
<p class="subtitle">Administre las cuentas y los permisos de acceso a DIGAIPE.</p>
<a href={resolve('/digaipe/admin')}>Volver a administración</a>

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
			<div class="input-group">
				<label for="role">Rol</label>
				<select id="role" name="role" class="full-width" required>
					<option value="user" selected={form?.values?.role !== 'admin'}>Usuario</option>
					<option value="admin" selected={form?.values?.role === 'admin'}>Administrador</option>
				</select>
			</div>
		</div>
		<p><small>Los administradores pueden gestionar usuarios y consultar la auditoría.</small></p>
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
						><option value="">Todos</option><option value="user">Usuario</option><option
							value="admin">Administrador</option
						></select
					></label
				>
			</div>
			<button type="submit" disabled={pending}>Buscar</button>
			<a href={resolve('/digaipe/admin/roles')}>Limpiar filtros</a>
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
							{#if isSelf}<span class="status-badge">Administrador</span>
							{:else}
								<form
									class="admin-cell-action"
									method="POST"
									action="?/setRole"
									use:enhance={submit}
								>
									<input type="hidden" name="userId" value={user.id} />
									<select
										class="table-input"
										name="role"
										aria-label={`Rol de ${user.name}`}
										disabled={pending}
									>
										<option value="user" selected={user.role !== 'admin'}>Usuario</option><option
											value="admin"
											selected={user.role === 'admin'}>Administrador</option
										>
									</select>
									<button
										type="submit"
										disabled={pending}
										aria-label={`Guardar rol de ${user.name}`}>Guardar</button
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
