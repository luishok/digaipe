<script lang="ts">
	import { enhance } from '$app/forms';
	import { can } from '$lib/permissions';

	let { data, form } = $props();

	let headers: { key: keyof Modality; value: string }[] = [
		{ key: 'id', value: 'ID' },
		{ key: 'code', value: 'Código' },
		{ key: 'name', value: 'Nombre' }
	];

	// --- Agregar / modificar una modalidad ---
	type Modality = (typeof data.all_admission_modalities)[number];
	const canManage = $derived(can(data.user, 'catalogs.import'));
	let modalityDialog = $state<HTMLDialogElement>();
	// null = agregando una modalidad nueva
	let editing = $state<Modality | null>(null);
	// Uploads find the modality by its code, so the code is locked once admissions use it.
	let codeLocked = $derived(!!editing && editing.admissionCount > 0);
	let lastSaved = $state<string | null>(null);

	function openModalityDialog(modality: Modality | null) {
		editing = modality;
		form = null;
		lastSaved = null;
		modalityDialog?.showModal();
	}
</script>

<h1>Modalidades de Admisión</h1>

{#if canManage}
	<button type="button" onclick={() => openModalityDialog(null)}>Agregar Modalidad</button>

	<dialog bind:this={modalityDialog} aria-labelledby="modality-dialog-title">
		<button type="button" onclick={() => modalityDialog?.close()}>X</button>
		<h3 id="modality-dialog-title">{editing ? 'Modificar Modalidad' : 'Agregar Modalidad'}</h3>
		{#key editing}
			<form
				method="POST"
				action={editing ? '?/update' : '?/create'}
				use:enhance={() => {
					return async ({ result, update }) => {
						await update();
						if (result.type === 'success') {
							lastSaved = String(result.data?.message ?? '');
							modalityDialog?.close();
						}
					};
				}}
			>
				{#if editing}
					<input type="hidden" name="id" value={editing.id} />
				{/if}
				<label>
					Código
					<input
						name="code"
						value={editing?.code ?? ''}
						required
						maxlength="4"
						pattern={'[A-Za-z0-9]{1,4}'}
						readonly={codeLocked}
					/>
				</label>
				{#if codeLocked}
					<p>
						El código no se puede cambiar: {editing?.admissionCount} admisión(es) usan esta modalidad.
					</p>
				{/if}
				<label>
					Nombre
					<input name="name" value={editing?.name ?? ''} required maxlength="128" />
				</label>
				<button type="submit">{editing ? 'Guardar Cambios' : 'Agregar'}</button>
			</form>
		{/key}
		{#if form?.error}
			<p role="alert">{form.message}</p>
		{/if}
	</dialog>
{/if}

{#if lastSaved}
	<p role="status">{lastSaved}</p>
{/if}

<div class="table_container">
	<table>
		<thead>
			<tr>
				{#each headers as header (header.key)}
					<th>{header.value}</th>
				{/each}
				{#if canManage}<th>Acciones</th>{/if}
			</tr>
		</thead>
		<tbody>
			{#each data.all_admission_modalities as modality (modality.id)}
				<tr>
					{#each headers as header (header.key)}
						<td>{modality[header.key]}</td>
					{/each}
					{#if canManage}
						<td>
							<button type="button" onclick={() => openModalityDialog(modality)}>Modificar</button>
						</td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.import_section {
		margin-bottom: 1.5rem;
	}
</style>
