<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Cambiar contraseña | DIGAIPE</title></svelte:head>

<h1>Cambiar contraseña</h1>
{#if data.required}
	<p class="subtitle">
		Un administrador estableció su contraseña. Debe elegir una nueva antes de continuar.
	</p>
{/if}

{#if form?.message}
	<div class="report-alert alert-error mt-4" role="alert">{form.message}</div>
{/if}
{#if form?.success}
	<div class="report-card" role="status">{form.success}</div>
{/if}

<section class="report-card" aria-labelledby="change-password">
	<h2 id="change-password" class="report-title">Nueva contraseña</h2>
	<form method="POST" use:enhance>
		<div class="input-group">
			<label for="currentPassword">Contraseña actual</label>
			<input id="currentPassword" name="currentPassword" type="password" required
				autocomplete="current-password" />
		</div>
		<div class="input-group">
			<label for="newPassword">
				Nueva contraseña ({data.minPasswordLength} a {data.maxPasswordLength} caracteres)
			</label>
			<input id="newPassword" name="newPassword" type="password" required
				minlength={data.minPasswordLength} maxlength={data.maxPasswordLength}
				autocomplete="new-password" />
		</div>
		<div class="input-group">
			<label for="confirmPassword">Confirmar nueva contraseña</label>
			<input id="confirmPassword" name="confirmPassword" type="password" required
				minlength={data.minPasswordLength} maxlength={data.maxPasswordLength}
				autocomplete="new-password" />
		</div>
		<div class="filter-actions">
			<button type="submit" class="btn-submit">Cambiar contraseña</button>
		</div>
	</form>
</section>
