<script lang="ts">
	import { resolve } from '$app/paths';
	import { batchStatusLabel } from '$lib';
	import alertIcon from '$lib/assets/alert.png';
	import errorIcon from '$lib/assets/error.png';

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

<div class="div-back-links">
	<a href={resolve('/digaipe/admisiones')}>
		<svg id="back" width='40px' height='40px' data-name="Capa 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 490.66 490.64">  <path class="cls-1" d="M0,259.65c0-9.58,0-19.16,0-28.74.28-1.38.72-2.74.81-4.13,2.39-34.22,11.44-66.63,28-96.6C66.96,61.08,124.92,18.79,202.55,3.87c9.36-1.8,18.9-2.6,28.36-3.87,9.58,0,19.16,0,28.74,0,1.23.27,2.46.7,3.7.79,34.23,2.33,66.77,11.15,96.67,27.89,80.62,45.14,124.38,114.13,130.17,206.38,2.49,39.68-4.99,78.12-22.75,113.76-43.53,87.36-114.43,134.94-211.86,141.33-44.23,2.9-86.44-6.99-125.34-28.38C61.06,423.71,18.78,365.65,3.87,287.98,2.07,278.63,1.27,269.1,0,259.65ZM245.05,459.9c118.28.2,214.45-95.65,214.85-214.14.4-118.39-95.78-214.89-214.38-215.09-118.28-.2-214.45,95.65-214.85,214.14-.4,118.39,95.78,214.89,214.38,215.09Z"/>  <path class="cls-2" d="M190.26,229.95c18.19-18.18,35.35-35.32,52.5-52.47,3.84-3.84,7.86-7.52,11.4-11.62,7.34-8.5,3.39-21.66-7.34-24.6-6.69-1.83-12,.74-16.77,5.53-27.47,27.62-55.06,55.12-82.59,82.67-9.51,9.52-9.46,22.17.13,31.76,27.31,27.32,54.63,54.64,81.96,81.95,1.13,1.13,2.23,2.3,3.49,3.27,5.16,3.96,10.8,4.69,16.59,1.68,5.77-3,9.16-8.07,7.97-14.46-.76-4.08-3.04-8.48-5.95-11.46-18.84-19.31-38.03-38.27-57.11-57.36-1.16-1.16-2.27-2.36-4.07-4.24h6.4c50.45,0,100.89,0,151.34,0,1.76,0,3.52.06,5.27-.07,7.76-.57,13.82-6.57,14.37-14.16.55-7.59-4.61-14.5-12.19-16.05-2.16-.44-4.44-.36-6.67-.37-50.77-.02-101.53-.01-152.3-.01h-6.43Z"/>  <path class="cls-1" d="M190.26,229.95h6.43c50.77,0,101.53,0,152.3.01,2.23,0,4.51-.08,6.67.37,7.59,1.55,12.74,8.46,12.19,16.05-.55,7.59-6.61,13.59-14.37,14.16-1.75.13-3.51.07-5.27.07-50.45,0-100.89,0-151.34,0h-6.4c1.8,1.88,2.91,3.09,4.07,4.24,19.07,19.08,38.27,38.04,57.11,57.36,2.91,2.98,5.19,7.38,5.95,11.46,1.19,6.39-2.21,11.47-7.97,14.46-5.78,3-11.42,2.27-16.59-1.68-1.26-.97-2.36-2.14-3.49-3.27-27.32-27.31-54.64-54.63-81.96-81.95-9.58-9.59-9.64-22.24-.13-31.76,27.54-27.55,55.12-55.05,82.59-82.67,4.77-4.8,10.07-7.37,16.77-5.53,10.73,2.94,14.68,16.09,7.34,24.6-3.54,4.1-7.56,7.78-11.4,11.62-17.15,17.15-34.31,34.3-52.5,52.47Z"/></svg>
	</a>
</div>

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
					Manifiesto PDF

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
	<div class="div-card">
    <h3>Archivos cargados</h3>
    <ul>
        <li>Admisiones: {form.files.sourceFileName}</li>
        <li>Estadistica: {form.files.estadisticaFileName}</li>
        <li>Manifiesto: {form.files.manifestFileName}</li>
    </ul>

    {#if form?.batchId}
        <p>
            <a href={resolve(`/digaipe/admisiones/cargar/${form.batchId}`)}>
                Abrir vista previa permanente del lote #{form.batchId}
            </a>
        </p>
    {/if}

    {#if previewRows.length > 0}
        <p>
            {previewRows.length} filas, {warnings.length} advertencias, {errors.length} errores.
        </p>
    {/if}
</div>
{/if}

{#if canSave}
    <form method="POST" action="?/save">
        <input type="hidden" name="batchId" value={form?.batchId} />
        <button type="submit" class="button-sticky">Guardar admisiones</button>
    </form>
{:else if errors.length > 0}
    <p style="color: red;">*Corrija los errores y vuelva a cargar los archivos para poder guardar.</p>
{/if}

<div class="container-advertencias-errores">
    {#if warnings.length > 0}
        <div class="advertencias_container div-card">
            <img src={alertIcon} alt="Advertencias" width="24" height="24" />
            <h2>Advertencias: {warnings.length}</h2>
            <div class="contenedor_tabla">
                <table class="table_container">
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
            </div>
        </div>
    {/if}

    {#if errors.length > 0}
        <div class="errores_container div-card">
            <img src={errorIcon} alt="Errores" width="24" height="24" />
            <h2>Errores: {errors.length}</h2>
            <div class="contenedor_tabla">
                <table class="table_container">
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
            </div>
        </div>
    {/if}
</div>


{#if previewRows.length > 0}
    <div class="div-card">
        <h2>Vista previa</h2>
        <p style="width:100%">
            <strong>Nota:</strong> Las advertencias no impiden guardar el lote, pero los errores sí.
        </p>
        <div class="contenedor_tabla" style="max-height: 500px;">
            <table class="table_container">
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
        </div>
    </div>
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
				{#if data.canDeleteDraft}<th>Eliminar borrador</th>{/if}
			</tr>
		</thead>
		<tbody>
			{#each data.recentBatches as batch (batch.id)}
				<tr>
					<td>{batch.id}</td>
					<td>{batchStatusLabel(batch.status)}</td>
					<td>
						{#if batch.status === 'draft' && batch.isOwn}
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
					{#if data.canDeleteDraft}
						<td>
							{#if batch.status === 'draft'}
								<form
									method="POST"
									action="?/deleteDraft"
									onsubmit={(event) => {
										if (!confirm(`¿Eliminar el lote #${batch.id}? Se borrarán sus archivos.`))
											event.preventDefault();
									}}
								>
									<input type="hidden" name="batchId" value={batch.id} />
									<input
										name="reason"
										type="text"
										placeholder="Motivo"
										aria-label="Motivo de la eliminación"
										required
										maxlength="500"
									/>
									<button type="submit">Eliminar</button>
								</form>
							{/if}
						</td>
					{/if}
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
