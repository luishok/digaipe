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
			<div>
				<!-- Cambiamos el id por un evento onclick -->
				<button onclick={openModal} class="btn-primary">Subir Archivo</button>
				<button type="button" onclick={() => openCareerDialog(null)}>Agregar Carrera</button>
			</div>

			<dialog bind:this={careerDialog} aria-labelledby="career-dialog-title">
				<div class="modal-actions">
					<button type="button" onclick={() => careerDialog?.close()} class="close-button">X</button>
				</div>
				<h3 id="career-dialog-title">{editing ? 'Modificar Carrera' : 'Agregar Carrera'}</h3>
				{#key editing}
					<form
						method="POST"
						action={editing ? '?/update' : '?/create'}
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
						<label>
							Programa Académico
							<input
								name="programa_academico"
								value={editing?.programa_academico ?? ''}
								required
								maxlength="255"
							/>
						</label>
						<label>
							Facultad o Núcleo
							<input name="facultad" value={editing?.facultad ?? ''} required maxlength="255" />
						</label>
						<label>
							Núcleo (letra)
							<input
								name="nucleo"
								value={editing?.nucleo ?? ''}
								required
								maxlength="1"
								pattern="[A-Za-z]"
								readonly={codesLocked}
							/>
						</label>
						<label>
							Código OFAE
							<input
								name="ofae"
								value={editing?.ofae ?? ''}
								required
								maxlength="4"
								pattern={'[A-Za-z0-9]{1,4}'}
								readonly={codesLocked}
							/>
						</label>
						{#if codesLocked}
							<p>
								El núcleo y el OFAE no se pueden cambiar: {editing?.admissionCount} admisión(es) usan
								esta carrera.
							</p>
						{/if}
						<label>
							Código OPSU
							<input name="codigo" type="number" min="0" step="1" value={editing?.codigo ?? ''} />
						</label>
						<label>
							Código OCRE
							<input name="ocre" type="number" min="0" step="1" value={editing?.ocre ?? ''} />
						</label>
						<button type="submit">{editing ? 'Guardar Cambios' : 'Agregar'}</button>
					</form>
				{/key}
				{#if singleResult?.error}
					<p role="alert">{singleResult.message}</p>
				{/if}
			</dialog>

			<!-- Usamos bind:this para conectar el HTML con la variable de arriba -->
			<dialog bind:this={modalElement}>
				<div class="modal-actions">
					<button onclick={closeModal} class="close-button">X</button>
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

						<button type="submit">Procesar y Guardar</button>
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
	/* modal */
	dialog {
		position: relative;
		border: none;
		border-radius: 8px;
		padding: 20px;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
		text-align: center;
		left: 50%;
		top: 50%;
		height: 50vh;
		transform: translate(-50%, -50%);
		width: 500px;
	}

	/* Animación y fondo oscuro */
	dialog::backdrop {
		background-color: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(3px); /* Un toque de desenfoque */
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 20px;
		position: absolute;
		right: 20px;
	}
	.import_careers {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
		height: 100%;
	}
	.modal-form {
		display: flex;
		flex-direction: column;
		height: 70%;
	}
	.modal-form input[type='file'] {
		padding: 10px;
		border: 1px solid #ccc;
		border-radius: 4px;
		margin: auto 0;
	}
	.modal-form button {
		margin-top: auto;
	}
	.close-button {
		margin: 0;
		padding: 10px;
		border-radius: 50%;
		width: 30px;
		height: 30px;
		font-size: 12px;
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
		margin-bottom: 20px;
	}

	.custom-file-upload:hover {
		border-color: #3b82f6;
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

	/* Botón de guardar con estilo más "SaaS" */
	.btn-save {
		width: 100%;
		padding: 12px;
		background-color: #1e293b;
		color: white;
		border: none;
		border-radius: 8px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	.btn-save:hover:not(:disabled) {
		background-color: #0f172a;
	}

	.btn-save:disabled {
		background-color: #cbd5e1;
		cursor: not-allowed;
	}
</style>
