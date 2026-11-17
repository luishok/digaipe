<script lang="ts">
	import { enhance } from '$app/forms';
	import { can } from '$lib/permissions';

	let { data, form } = $props();

	// --- Agregar / modificar una carrera ---
	type Career = (typeof data.all_careers)[number];
	let careerDialog = $state<HTMLDialogElement>();
	// null = agregando una carrera nueva
	let editing = $state<Career | null>(null);
	// Admissions point at the career by núcleo + OFAE, so those are locked once it is in use.
	let codesLocked = $derived(!!editing && editing.admissionCount > 0);
	let singleResult = $derived(form?.action === 'create' || form?.action === 'update' ? form : null);
	let lastSaved = $state<string | null>(null);

	function openCareerDialog(career: Career | null) {
		editing = career;
		form = null;
		lastSaved = null;
		careerDialog?.showModal();
	}

	// --- Lógica del Modal ---
	let modalElement = $state<HTMLDialogElement>(); // Aquí se guardará la referencia al <dialog>

	function openModal() {
		modalElement?.showModal();
	}

	function closeModal() {
		modalElement?.close();
	}
	let files = $state<FileList | null>(null); // Guardará la lista de archivos seleccionados

	// Variable derivada que reacciona cuando cambia 'files'
	let fileName = $derived(files && files.length > 0 ? files[0].name : null);

	let headers: { key: keyof Career; value: string }[] = [
		{ key: 'programa_academico', value: 'Programa Academico' },
		{ key: 'codigo', value: 'Codigo OPSU' },
		{ key: 'ofae', value: 'Codigo OFAE' },
		{ key: 'ocre', value: 'Codigo OCRE' },
		{ key: 'facultad', value: 'Facultad' },
		{ key: 'todo', value: 'Nombre Completo' },
		{ key: 'nucleo', value: 'Nucleo' },
		{ key: 'clave', value: 'Clave' }
	];

	// 1. Usamos $state para que el término de búsqueda sea reactivo en Svelte 5
	let searchTerm = $state('');

	// 2. Usamos $derived para que esta variable se recalcule automáticamente
	// cada vez que el usuario escriba algo en 'searchTerm'
	let filteredCareers = $derived(
		// Validamos que data.all_careers exista para evitar errores si la data tarda en cargar
		(data?.all_careers || []).filter((career) => {
			// Si el buscador está vacío, mostramos todo
			if (searchTerm === '') return true;

			const term = searchTerm.toLowerCase();

			// Buscamos coincidencias en cualquiera de las columnas definidas en 'headers'
			return headers.some((header) => {
				const cellValue = String(career[header.key] || '').toLowerCase();
				return cellValue.includes(term);
			});
		})
	);
</script>

<h1 style="text-align: center;">Carreras</h1>

<div class="header-carreras">
	{#if data.user}
		{#if can(data.user, 'catalogs.import')}
			<div style='display: flex; flex-direction: column; gap: 1em; justify-content: center;'>
				<!-- Cambiamos el id por un evento onclick -->
				<button onclick={openModal} class="btn-primary">Subir Archivo</button>
				<button class='btn-secondary' style='padding: 0.5em 1.5em;' type="button" onclick={() => openCareerDialog(null)}>Agregar Carrera</button>
			</div>

			<dialog bind:this={careerDialog} aria-labelledby="career-dialog-title" class="career-dialog">
				<div class="modal-actions">
					<button type="button" onclick={() => careerDialog?.close()} class="close-button" aria-label="Cerrar modal">✕</button>
				</div>
				<div class="modal-header">
					<h3 id="career-dialog-title">{editing ? 'Modificar Carrera' : 'Agregar Carrera'}</h3>
				</div>
				{#key editing}
					<form
						method="POST"
						action={editing ? '?/update' : '?/create'}
						class="career-form"
						use:enhance={() => {
							return async ({ result, update }) => {
								await update();
								if (result.type === 'success') {
									lastSaved = String(result.data?.message ?? '');
									careerDialog?.close();
								}
							};
						}}
					>
						{#if editing}
							<input type="hidden" name="id" value={editing.id} />
						{/if}
						<div class="form-group">
							<label for="c-programa">Programa Académico</label>
							<input
								id="c-programa"
								name="programa_academico"
								value={editing?.programa_academico ?? ''}
								required
								maxlength="255"
								placeholder="Ej. Ingeniería de Sistemas"
							/>
						</div>
						<div class="form-group">
							<label for="c-facultad">Facultad o Núcleo</label>
							<input
								id="c-facultad"
								name="facultad"
								value={editing?.facultad ?? ''}
								required
								maxlength="255"
								placeholder="Ej. Facultad de Ingeniería"
							/>
						</div>
						<div class="form-row">
							<div class="form-group">
								<label for="c-nucleo">Núcleo (letra)</label>
								<input
									id="c-nucleo"
									name="nucleo"
									value={editing?.nucleo ?? ''}
									required
									maxlength="1"
									pattern="[A-Za-z]"
									readonly={codesLocked}
									placeholder="Ej. U"
								/>
							</div>
							<div class="form-group">
								<label for="c-ofae">Código OFAE</label>
								<input
									id="c-ofae"
									name="ofae"
									value={editing?.ofae ?? ''}
									required
									maxlength="4"
									pattern={'[A-Za-z0-9]{1,4}'}
									readonly={codesLocked}
									placeholder="Ej. 101"
								/>
							</div>
						</div>
						{#if codesLocked}
							<p class="lock-notice">
								El núcleo y el OFAE no se pueden cambiar: {editing?.admissionCount} admisión(es) usan
								esta carrera.
							</p>
						{/if}
						<div class="form-row">
							<div class="form-group">
								<label for="c-codigo">Código OPSU</label>
								<input
									id="c-codigo"
									name="codigo"
									type="number"
									min="0"
									step="1"
									value={editing?.codigo ?? ''}
									placeholder="Opcional"
								/>
							</div>
							<div class="form-group">
								<label for="c-ocre">Código OCRE</label>
								<input
									id="c-ocre"
									name="ocre"
									type="number"
									min="0"
									step="1"
									value={editing?.ocre ?? ''}
									placeholder="Opcional"
								/>
							</div>
						</div>
						<button type="submit" class="btn-submit">{editing ? 'Guardar Cambios' : 'Agregar Carrera'}</button>
					</form>
				{/key}
				{#if singleResult?.error}
					<p role="alert" class="modal-error">{singleResult.message}</p>
				{/if}
			</dialog>

			<!-- Usamos bind:this para conectar el HTML con la variable de arriba -->
			<dialog bind:this={modalElement}>
				<div class="modal-actions">
					<button type="button" onclick={closeModal} class="close-button" aria-label="Cerrar modal">✕</button>
				</div>
				<div class="import_careers">
					<h3>Subir Archivo CSV</h3>
					<form method="POST" action="?/import" enctype="multipart/form-data" class="modal-form">
						<label class="custom-file-upload {fileName ? 'has-file' : ''}">
							<input type="file" name="csvFile" accept=".csv" bind:files required />

							<div class="upload-content">
								{#if !fileName}
									<!-- Icono de Nube/Subir -->
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="48"
										height="48"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
											points="17 8 12 3 7 8"
										/><line x1="12" y1="3" x2="12" y2="15" /></svg
									>
									<p>Haga clic para seleccionar o arrastre su CSV</p>
									<span>Solo archivos .csv</span>
								{:else}
									<!-- Icono de Archivo Seleccionado -->
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="48"
										height="48"
										viewBox="0 0 24 24"
										fill="none"
										stroke="#166534"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										><path
											d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"
										/><polyline points="14 2 14 8 20 8" /></svg
									>
									<p class="file-ready">¡Archivo listo!</p>
									<strong>{fileName}</strong>
								{/if}
							</div>
						</label>

						<button type="submit" class="btn-submit">Procesar y Guardar</button>
					</form>

					{#if form?.action === 'import' && !form.error}
						<p style="color: green;">{form.message}</p>
					{:else if form?.action === 'import' && form.error}
						<p style="color: red;">{form.message}</p>
					{/if}
				</div>
			</dialog>
		{/if}
	{/if}

	<!-- Input de búsqueda vinculado a la variable $state -->

	<input
		type="text"
		bind:value={searchTerm}
		placeholder="Buscar por programa, facultad, núcleo..."
		class="buscador"
		style="width: 100%;"
	/>
</div>
{#if lastSaved}
	<p role="status">{lastSaved}</p>
{/if}
<div class="table_container">
	<table>
		<thead>
			<!-- Siempre es buena práctica envolver los <th> en un <tr> -->
			<tr>
				{#each headers as header (header.key)}
					<th>{header.value}</th>
				{/each}
				{#if can(data.user, 'catalogs.import')}<th>Acciones</th>{/if}
			</tr>
		</thead>
		<tbody>
			<!-- ¡Importante! Iteramos sobre la variable derivada 'filteredCareers' -->
			{#each filteredCareers as career (career.id)}
				<tr>
					{#each headers as header (header.key)}
						<td>{career[header.key]}</td>
					{/each}
					{#if can(data.user, 'catalogs.import')}
						<td>
							<button type="button" onclick={() => openCareerDialog(career)}>Modificar</button>
						</td>
					{/if}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.header-carreras {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
		gap: 5%;
	}

	/* Modal dialog base */
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
		max-width: 520px;
		max-height: 85vh;
		overflow-y: auto;
		margin: 0;
	}

	/* Animación y fondo oscuro */
	dialog::backdrop {
		background-color: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(3px); /* Un toque de desenfoque */
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

	.modal-header {
		text-align: center;
		margin-bottom: 20px;
	}

	.modal-header h3 {
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--ula-blue, #0033a0);
		margin: 0;
	}

	/* Estilos del formulario de Agregar/Modificar Carrera */
	.career-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
		text-align: left;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
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

	/* Estilos para el modal de Importar CSV */
	.import_careers {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
	}

	.import_careers h3 {
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--ula-blue, #0033a0);
		margin: 0;
		text-align: center;
	}

	.modal-form {
		display: flex;
		flex-direction: column;
		width: 100%;
		gap: 16px;
	}

	/* Escondemos el input feo */
	input[type='file'] {
		display: none;
	}

	.custom-file-upload {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		border: 2px dashed #cbd5e1;
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.3s ease;
		background-color: #f8fafc;
	}

	.custom-file-upload:hover {
		border-color: var(--ula-blue, #0033a0);
		background-color: #eff6ff;
	}

	/* Cuando ya hay un archivo seleccionado */
	.custom-file-upload.has-file {
		border-style: solid;
		border-color: #22c55e;
		background-color: #f0fdf4;
	}

	.upload-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		color: #64748b;
	}

	.upload-content p {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 500;
	}

	.upload-content span {
		font-size: 0.8rem;
		color: #94a3b8;
	}

	.file-ready {
		color: #166534;
	}
</style>
