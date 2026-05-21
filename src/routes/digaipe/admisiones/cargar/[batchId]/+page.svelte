<script lang="ts">
	import { resolve } from '$app/paths';

	let { data, form } = $props();

	const warnings = $derived(data.preview.warnings);
	const errors = $derived(data.preview.errors);
	const canSave = $derived(data.batch.status === 'draft' && errors.length === 0);
</script>

<h1>Vista previa del lote #{data.batch.id}</h1>

<p><a href={resolve('/digaipe/admisiones/cargar')}>Volver a cargar admisiones</a></p>
<p><a href={resolve('/digaipe/admisiones')}>Volver al listado</a></p>

{#if form?.message}
	<p>{form.message}</p>
{/if}

<h2>Archivos</h2>
<ul>
	<li>Admisiones: {data.batch.sourceFileName}</li>
	<li>Estadistica: {data.batch.estadisticaFileName}</li>
	<li>Manifest: {data.batch.manifestFileName}</li>
</ul>

<p>Estado: {data.batch.status}</p>
<p>
	{data.preview.rows.length} filas, {warnings.length} advertencias, {errors.length} errores.
</p>

{#if data.batch.status !== 'draft'}
	<p>Este lote ya fue guardado.</p>
{:else if canSave}
	<form method="POST" action="?/save">
		<input type="hidden" name="batchId" value={data.batch.id} />
		<button type="submit">Guardar admisiones</button>
	</form>
{:else}
	<p>Corrija los errores y vuelva a cargar los archivos para poder guardar.</p>
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
			{#each errors as previewError (`${previewError.row}-${previewError.field}-${previewError.message}`)}
				<tr>
					<td>{previewError.row}</td>
					<td>{previewError.field}</td>
					<td>{previewError.message}</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<h2>Vista previa</h2>
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
		{#each data.preview.rows as row (row.row)}
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
