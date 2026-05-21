<script lang="ts">
	import { resolve } from '$app/paths';

	let { data, form } = $props();

	const previewRows = $derived(form?.preview?.rows ?? []);
	const warnings = $derived(form?.preview?.warnings ?? []);
	const errors = $derived(form?.preview?.errors ?? []);
	const canSave = $derived(form?.batchId && errors.length === 0 && form?.step === 'preview');
</script>

<h1>Cargar admisiones</h1>

<p><a href={resolve('/digaipe/admisiones')}>Volver al listado</a></p>

<form method="POST" action="?/preview" enctype="multipart/form-data">
	<fieldset>
		<legend>Archivos requeridos</legend>

		<label>
			Archivo de admisiones XLSX
			<input name="sourceFile" type="file" accept=".xlsx" required />
		</label>

		<label>
			Estadistica firmada PDF
			<input name="estadisticaFile" type="file" accept=".pdf" required />
		</label>

		<label>
			Manifest PDF
			<input name="manifestFile" type="file" accept=".pdf" required />
		</label>
	</fieldset>

	<button type="submit">Previsualizar</button>
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
	<table>
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
