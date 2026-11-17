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
	<div class="actions-header">
		<button type="button" onclick={() => openModalityDialog(null)} class="btn-primary">Agregar Modalidad</button>
	</div>

	<dialog bind:this={modalityDialog} aria-labelledby="modality-dialog-title" class="modality-dialog">
		<div class="modal-actions">
			<button type="button" onclick={() => modalityDialog?.close()} class="close-button" aria-label="Cerrar modal">✕</button>
		</div>
		<div class="modality-dialog-title">
			<h3 id="modality-dialog-title">{editing ? 'Modificar Modalidad' : 'Agregar Modalidad'}</h3>
		</div>
		{#key editing}
			<form
				method="POST"
				action={editing ? '?/update' : '?/create'}
				class="modality-form"
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
				<div class="form-group">
					<label for="m-code">Código</label>
					<input
						id="m-code"
						name="code"
						value={editing?.code ?? ''}
						required
						maxlength="4"
						pattern={'[A-Za-z0-9]{1,4}'}
						readonly={codeLocked}
						placeholder="Ej. CNE"
					/>
				</div>
				{#if codeLocked}
					<p class="lock-notice">
						El código no se puede cambiar: {editing?.admissionCount} admisión(es) usan esta modalidad.
					</p>
				{/if}
				<div class="form-group">
					<label for="m-name">Nombre</label>
					<input
						id="m-name"
						name="name"
						value={editing?.name ?? ''}
						required
						maxlength="128"
						placeholder="Ej. Convenio Nacional de Estudios"
					/>
				</div>
				<button type="submit" class="btn-submit">{editing ? 'Guardar Cambios' : 'Agregar Modalidad'}</button>
			</form>
		{/key}
		{#if form?.error}
			<p role="alert" class="modal-error">{form.message}</p>
		{/if}
	</dialog>
{/if}

{#if lastSaved}
	<p role="status" class="status-msg">{lastSaved}</p>
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
	.actions-header {
		margin-bottom: 1.5rem;
	}

	/* Modal dialog */
	dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		border: none;
		border-radius: 12px;
		padding: 28px 24px;
		box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
		background-color: #ffffff;
		width: 90%;
		max-width: 480px;
		max-height: 85vh;
		overflow-y: auto;
		margin: 0;
	}

	dialog::backdrop {
		background-color: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(3px);
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		position: absolute;
		top: 16px;
		right: 16px;
	}

	.close-button {
		margin: 0;
		padding: 0;
		border-radius: 50%;
		width: 32px;
		height: 32px;
		font-size: 14px;
		font-weight: bold;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #f1f5f9;
		color: #64748b;
		border: 1px solid #e2e8f0;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.close-button:hover {
		background-color: #e2e8f0;
		color: #0f172a;
	}

	.modality-dialog-title {
		text-align: center;
		margin-bottom: 20px;
	}

	.modality-dialog-title h3 {
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--ula-blue, #0033a0);
		margin: 0;
	}

	.modality-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
		text-align: left;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.form-group label {
		font-size: 0.875rem;
		font-weight: 600;
		color: #334155;
	}

	.form-group input {
		width: 100%;
		padding: 10px 14px;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		font-size: 0.95rem;
		font-family: inherit;
		color: #1e293b;
		background-color: #f8fafc;
		transition: all 0.2s ease;
		box-sizing: border-box;
	}

	.form-group input:focus {
		outline: none;
		border-color: var(--ula-blue, #0033a0);
		background-color: #ffffff;
		box-shadow: 0 0 0 3px rgba(0, 51, 160, 0.15);
	}

	.form-group input:read-only {
		background-color: #f1f5f9;
		color: #64748b;
		cursor: not-allowed;
		border-color: #e2e8f0;
	}

	.btn-submit {
		width: 100%;
		padding: 12px;
		background-color: var(--ula-blue, #0033a0);
		color: #ffffff;
		border: none;
		border-radius: 8px;
		font-weight: 600;
		font-size: 1rem;
		cursor: pointer;
		transition: background-color 0.2s ease, transform 0.1s ease;
		margin-top: 8px;
	}

	.btn-submit:hover {
		background-color: var(--ula-dark, #002470);
	}

	.btn-submit:active {
		transform: scale(0.99);
	}

	.lock-notice {
		background-color: #eff6ff;
		border-left: 4px solid var(--ula-blue, #0033a0);
		padding: 8px 12px;
		border-radius: 4px;
		font-size: 0.85rem;
		color: #1e40af;
		margin: 0;
	}

	.modal-error {
		color: #dc2626;
		background-color: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 0.875rem;
		text-align: center;
		margin-top: 12px;
	}

	.status-msg {
		color: #166534;
		background-color: #f0fdf4;
		border: 1px solid #bbf7d0;
		padding: 10px 14px;
		border-radius: 8px;
		margin-bottom: 16px;
	}
</style>
