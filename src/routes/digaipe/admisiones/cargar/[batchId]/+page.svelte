<script lang="ts">
	import { resolve } from '$app/paths';
	import { batchStatusLabel } from '$lib';
	import { can } from '$lib/permissions';
	import { formatDate } from '$lib/dates';
	import alertIcon from '$lib/assets/alert.png';
	import errorIcon from '$lib/assets/error.png';

	let { data, form } = $props();

	const warnings = $derived(data.preview.warnings);
	const errors = $derived(data.preview.errors);
	const canSave = $derived(data.batch.status === 'draft' && errors.length === 0);
	const canDeleteDraft = $derived(
		data.batch.status === 'draft' && can(data.user, 'admissions.deleteDraft')
	);
</script>


<div class="div-back-links">
	<a aria-label="Volver" href={resolve('/digaipe/admisiones/cargar')}>
		<svg id="back" width='40px' height='40px' data-name="Capa 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 490.66 490.64">  <path class="cls-1" d="M0,259.65c0-9.58,0-19.16,0-28.74.28-1.38.72-2.74.81-4.13,2.39-34.22,11.44-66.63,28-96.6C66.96,61.08,124.92,18.79,202.55,3.87c9.36-1.8,18.9-2.6,28.36-3.87,9.58,0,19.16,0,28.74,0,1.23.27,2.46.7,3.7.79,34.23,2.33,66.77,11.15,96.67,27.89,80.62,45.14,124.38,114.13,130.17,206.38,2.49,39.68-4.99,78.12-22.75,113.76-43.53,87.36-114.43,134.94-211.86,141.33-44.23,2.9-86.44-6.99-125.34-28.38C61.06,423.71,18.78,365.65,3.87,287.98,2.07,278.63,1.27,269.1,0,259.65ZM245.05,459.9c118.28.2,214.45-95.65,214.85-214.14.4-118.39-95.78-214.89-214.38-215.09-118.28-.2-214.45,95.65-214.85,214.14-.4,118.39,95.78,214.89,214.38,215.09Z"/>  <path class="cls-2" d="M190.26,229.95c18.19-18.18,35.35-35.32,52.5-52.47,3.84-3.84,7.86-7.52,11.4-11.62,7.34-8.5,3.39-21.66-7.34-24.6-6.69-1.83-12,.74-16.77,5.53-27.47,27.62-55.06,55.12-82.59,82.67-9.51,9.52-9.46,22.17.13,31.76,27.31,27.32,54.63,54.64,81.96,81.95,1.13,1.13,2.23,2.3,3.49,3.27,5.16,3.96,10.8,4.69,16.59,1.68,5.77-3,9.16-8.07,7.97-14.46-.76-4.08-3.04-8.48-5.95-11.46-18.84-19.31-38.03-38.27-57.11-57.36-1.16-1.16-2.27-2.36-4.07-4.24h6.4c50.45,0,100.89,0,151.34,0,1.76,0,3.52.06,5.27-.07,7.76-.57,13.82-6.57,14.37-14.16.55-7.59-4.61-14.5-12.19-16.05-2.16-.44-4.44-.36-6.67-.37-50.77-.02-101.53-.01-152.3-.01h-6.43Z"/>  <path class="cls-1" d="M190.26,229.95h6.43c50.77,0,101.53,0,152.3.01,2.23,0,4.51-.08,6.67.37,7.59,1.55,12.74,8.46,12.19,16.05-.55,7.59-6.61,13.59-14.37,14.16-1.75.13-3.51.07-5.27.07-50.45,0-100.89,0-151.34,0h-6.4c1.8,1.88,2.91,3.09,4.07,4.24,19.07,19.08,38.27,38.04,57.11,57.36,2.91,2.98,5.19,7.38,5.95,11.46,1.19,6.39-2.21,11.47-7.97,14.46-5.78,3-11.42,2.27-16.59-1.68-1.26-.97-2.36-2.14-3.49-3.27-27.32-27.31-54.64-54.63-81.96-81.95-9.58-9.59-9.64-22.24-.13-31.76,27.54-27.55,55.12-55.05,82.59-82.67,4.77-4.8,10.07-7.37,16.77-5.53,10.73,2.94,14.68,16.09,7.34,24.6-3.54,4.1-7.56,7.78-11.4,11.62-17.15,17.15-34.31,34.3-52.5,52.47Z"/></svg>
	</a>
</div>
<h1>Lote #{data.batch.id}</h1>

{#if form?.message}
	<p>{form.message}</p>
{/if}
<div class="div-card">
	<h3>Archivos</h3>
	<p>Estado: {batchStatusLabel(data.batch.status)}</p>
	<ul>
		<li>Admisiones: {data.batch.sourceFileName}</li>
		<li>Estadistica: {data.batch.estadisticaFileName}</li>
		<li>Manifiesto: {data.batch.manifestFileName}</li>
	</ul>

	<p>
		{data.preview.rows.length} filas, {warnings.length} advertencias, {errors.length} errores.
	</p>
</div>

{#if data.batch.status !== 'draft'}
	<p>Este lote ya fue guardado.</p>
{:else if canSave}
	<form method="POST" action="?/save">
		<input type="hidden" name="batchId" value={data.batch.id} />
		<button type="submit" class="button-sticky">Guardar admisiones</button>
	</form>
{:else}
	<p style="color: red;">*Corrija los errores y vuelva a cargar los archivos para poder guardar.</p>
{/if}
{#if canDeleteDraft}
	<form
		method="POST"
		action="{resolve('/digaipe/admisiones/cargar')}?/deleteDraft"
		onsubmit={(event) => {
			if (!confirm(`¿Eliminar el lote #${data.batch.id}? Se borrarán sus archivos.`))
				event.preventDefault();
		}}
	>
		<input type="hidden" name="batchId" value={data.batch.id} />
		<label>
			Motivo de la eliminación
			<input name="reason" type="text" required maxlength="500" />
		</label>
		<button type="submit">Eliminar borrador</button>
	</form>
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
			<img src={errorIcon} alt="Advertencias" width="24" height="24" />
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
						{#each errors as previewError (`${previewError.row}-${previewError.field}-${previewError.message}`)}
							<tr>
								<td>{previewError.row}</td>
								<td>{previewError.field}</td>
								<td>{previewError.message}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
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
						<td>{formatDate(row.fechaAsignacion)}</td>
						<td>{row.ano ?? ''}</td>
						<td>{row.proceso ?? ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
