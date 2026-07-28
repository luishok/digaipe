<script lang="ts">
	import { resolve } from '$app/paths';

	let { data, form } = $props();

	const previewRows = $derived(form?.preview?.rows ?? []);
	const warnings = $derived(form?.preview?.warnings ?? []);
	const errors = $derived(form?.preview?.errors ?? []);
	const canSave = $derived(form?.batchId && errors.length === 0 && form?.step === 'preview');

	// 1. Archivo de admisiones (XLSX)
	let sourceFiles: FileList | undefined = $state();
	let sourceFileName: string = $derived(
		sourceFiles && sourceFiles.length > 0 ? sourceFiles[0].name : ''
	);

	// 2. Estadística firmada (PDF)
	let estadisticaFiles: FileList | undefined = $state();
	let estadisticaFileName: string = $derived(
		estadisticaFiles && estadisticaFiles.length > 0 ? estadisticaFiles[0].name : ''
	);

	// 3. Manifest (PDF)
	let manifestFiles: FileList | undefined = $state();
	let manifestFileName: string = $derived(
		manifestFiles && manifestFiles.length > 0 ? manifestFiles[0].name : ''
	);

	let isButtonDisabled: boolean = $derived(
		!sourceFileName || !estadisticaFileName || !manifestFileName
	);
</script>

<p><a href={resolve('/digaipe/admisiones')}>Volver al listado</a></p>

<h1>Cargar admisiones</h1>

<form method="POST" action="?/preview" enctype="multipart/form-data">
	<fieldset>
		<legend>Archivos requeridos</legend>
		<div class="container-docs">
			<div class="label-input">
				<label class="custom-file-upload {sourceFileName ? 'has-file' : ''}" for="file-xlsx">
					Archivo de admisiones XLSX

					<input
						id="file-xlsx"
						name="sourceFile"
						type="file"
						accept=".xlsx"
						required
						bind:files={sourceFiles}
					/>

					<div class="upload-content">
						{#if !sourceFileName}
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
							<p>Haga clic para seleccionar o arrastre su XLSX</p>
							<span>Solo archivos .XLSX</span>
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
							<strong>{sourceFileName}</strong>
						{/if}
					</div>
				</label>
			</div>

			<div class="label-input">
				<label
					class="custom-file-upload {estadisticaFileName ? 'has-file' : ''}"
					for="estadistica-pdf"
				>
					Estadistica firmada PDF

					<input
						id="estadistica-pdf"
						name="estadisticaFile"
						type="file"
						accept=".pdf"
						required
						bind:files={estadisticaFiles}
					/>
					<div class="upload-content">
						{#if !estadisticaFileName}
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
							<p>Haga clic para seleccionar o arrastre su PDF</p>
							<span>Solo archivos .PDF</span>
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
							<strong>{estadisticaFileName}</strong>
						{/if}
					</div>
				</label>
			</div>

			<div class="label-input">
				<label class="custom-file-upload {manifestFileName ? 'has-file' : ''}" for="manifest-pdf">
					Manifest PDF

					<input
						id="manifest-pdf"
						name="manifestFile"
						type="file"
						accept=".pdf"
						required
						bind:files={manifestFiles}
					/>

					<div class="upload-content">
						{#if !manifestFileName}
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
							<p>Haga clic para seleccionar o arrastre su PDF</p>
							<span>Solo archivos .PDF</span>
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
							<strong>{manifestFileName}</strong>
						{/if}
					</div>
				</label>
			</div>
		</div>
		<button type="submit" disabled={isButtonDisabled}>Previsualizar</button>
	</fieldset>
</form>

{#if form?.message}
	<p>{form.message}</p>
{/if}

{#if form?.files}
	<h2>Archivos cargados</h2>
	<ul>
		<li>Admisiones: {form.files.sourceFileName}</li>
		<li>Estadistica: {form.files.estadisticaFileName}</li>
		<li>Manifest: {form.files.manifestFileName}</li>
	</ul>
	{#if form?.batchId}
		<p>
			<a href={resolve(`/digaipe/admisiones/cargar/${form.batchId}`)}>
				Abrir vista previa permanente del lote #{form.batchId}
			</a>
		</p>
	{/if}
{/if}

{#if warnings.length > 0}
	<h2>Advertencias</h2>
	<table>
		<thead>
			<tr>
				<th>Fila</th>
				<th>Campo</th>
				<th>Mensaje</th>
			</tr>
		</thead>
		<tbody>
			{#each warnings as warning (`${warning.row}-${warning.field}-${warning.message}`)}
				<tr>
					<td>{warning.row}</td>
					<td>{warning.field}</td>
					<td>{warning.message}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

{#if errors.length > 0}
	<h2>Errores</h2>
	<table>
		<thead>
			<tr>
				<th>Fila</th>
				<th>Campo</th>
				<th>Mensaje</th>
			</tr>
		</thead>
		<tbody>
			{#each errors as error (`${error.row}-${error.field}-${error.message}`)}
				<tr>
					<td>{error.row}</td>
					<td>{error.field}</td>
					<td>{error.message}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

{#if previewRows.length > 0}
	<h2>Vista previa</h2>
	<p>
		{previewRows.length} filas, {warnings.length} advertencias, {errors.length} errores.
	</p>

	{#if canSave}
		<form method="POST" action="?/save">
			<input type="hidden" name="batchId" value={form?.batchId} />
			<button type="submit">Guardar admisiones</button>
		</form>
	{:else if errors.length > 0}
		<p>Corrija los errores y vuelva a cargar los archivos para poder guardar.</p>
	{/if}

	<table>
		<thead>
			<tr>
				<th>Fila</th>
				<th>Proceso</th>
				<th>Cedula</th>
				<th>Estudiante</th>
				<th>Telefono</th>
				<th>Correo</th>
				<th>Opcion</th>
				<th>Carrera</th>
				<th>Modalidad</th>
				<th>OCRE</th>
				<th>Periodo</th>
				<th>Fecha</th>
				<th>Ano</th>
				<th>Proceso num.</th>
			</tr>
		</thead>
		<tbody>
			{#each previewRows as row (row.row)}
				<tr>
					<td>{row.row}</td>
					<td>{row.numAsignacion}</td>
					<td>{row.cedula}</td>
					<td>{row.apellidosNombres}</td>
					<td>{row.telefono ?? ''}</td>
					<td>{row.correo ?? ''}</td>
					<td>{row.opcion}</td>
					<td>{row.careerName ?? ''}</td>
					<td>{row.modaIngreso} {row.modalityName ?? ''}</td>
					<td>{row.codOcre} {row.ocreName ?? ''}</td>
					<td>{row.periodoIngreso}</td>
					<td>{row.fechaAsignacion}</td>
					<td>{row.ano ?? ''}</td>
					<td>{row.proceso ?? ''}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<h2>Lotes recientes</h2>
{#if data.recentBatches.length === 0}
	<p>No hay lotes recientes.</p>
{:else}
	<table class="table_container">
		<thead>
			<tr>
				<th>ID</th>
				<th>Estado</th>
				<th>Archivo</th>
				<th>Filas</th>
				<th>Advertencias</th>
				<th>Errores</th>
				<th>Creado</th>
				<th>Guardado</th>
			</tr>
		</thead>
		<tbody>
			{#each data.recentBatches as batch (batch.id)}
				<tr>
					<td>{batch.id}</td>
					<td>{batch.status}</td>
					<td>
						{#if batch.status === 'draft'}
							<a href={resolve(`/digaipe/admisiones/cargar/${batch.id}`)}>{batch.sourceFileName}</a>
						{:else}
							{batch.sourceFileName}
						{/if}
					</td>
					<td>{batch.rowCount}</td>
					<td>{batch.warningCount}</td>
					<td>{batch.errorCount}</td>
					<td>{new Date(batch.createdAt).toLocaleString()}</td>
					<td>{batch.savedAt ? new Date(batch.savedAt).toLocaleString() : ''}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	input[type='file'] {
		display: none;
	}

	fieldset .custom-file-upload {
		width: 400px;
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
	fieldset {
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		padding: 20px;
		margin-bottom: 20px;
		text-align: center;
	}
	fieldset .container-docs {
		display: flex;
		flex-direction: row;
		justify-content: space-around;
	}

	fieldset button {
		background-color: green; /* Azul ULA */
		color: white;
		border: none;
		padding: 10px 20px;
		border-radius: 8px;
		cursor: pointer;
		font-size: 1rem;
	}
	.btn-submit:hover:not(:disabled) {
		background-color: #002270; /* Un tono más oscuro */
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
	}

	button:disabled {
		background-color: #cbd5e1; /* Gris claro */
		color: #94a3b8; /* Texto grisáceo suave */
		cursor: not-allowed; /* Cambia el cursor a señal de prohibido */
		box-shadow: none;
	}
</style>
