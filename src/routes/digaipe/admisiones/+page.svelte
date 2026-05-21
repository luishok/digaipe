<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();

	const headers = [
		'Cedula',
		'Estudiante',
		'Telefono',
		'Correo',
		'Carrera',
		'Opcion',
		'Proceso',
		'Modalidad',
		'OCRE',
		'Periodo',
		'Fecha',
		'Lote'
	];
</script>

<h1>Admisiones</h1>

<p><a href={resolve('/digaipe/admisiones/cargar')}>Cargar admisiones</a></p>

<form method="GET">
	<label>
		Buscar
		<input name="search" type="search" value={data.filters.search} />
	</label>

	<label>
		Proceso
		<select name="process">
			<option value="">Todos</option>
			{#each data.filterOptions.processes as process (process.code)}
				<option value={process.code} selected={data.filters.process === process.code}>
					{process.code}
				</option>
			{/each}
		</select>
	</label>

	<label>
		Periodo
		<select name="period">
			<option value="">Todos</option>
			{#each data.filterOptions.periods as period (period.period)}
				<option value={period.period} selected={data.filters.period === period.period}>
					{period.period}
				</option>
			{/each}
		</select>
	</label>

	<label>
		Modalidad
		<select name="modality">
			<option value="">Todas</option>
			{#each data.filterOptions.modalities as modality (modality.code)}
				<option value={modality.code} selected={data.filters.modality === modality.code}>
					{modality.code} - {modality.name}
				</option>
			{/each}
		</select>
	</label>

	<label>
		Carrera
		<select name="career">
			<option value="">Todas</option>
			{#each data.filterOptions.careerOptions as career (career.opcion)}
				<option value={career.opcion} selected={data.filters.career === career.opcion}>
					{career.opcion}
				</option>
			{/each}
		</select>
	</label>

	<label>
		Desde
		<input name="dateFrom" type="date" value={data.filters.dateFrom} />
	</label>

	<label>
		Hasta
		<input name="dateTo" type="date" value={data.filters.dateTo} />
	</label>

	<button type="submit">Filtrar</button>
	<a href={resolve('/digaipe/admisiones')}>Limpiar</a>
</form>

<p>{data.admissions.length} admisiones</p>

{#if data.admissions.length === 0}
	<p>No hay admisiones para los filtros seleccionados.</p>
{:else}
	<table>
		<thead>
			<tr>
				{#each headers as header (header)}
					<th>{header}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each data.admissions as admission (admission.id)}
				<tr>
					<td>{admission.cedula}</td>
					<td>{admission.apellidosNombres}</td>
					<td>{admission.telefono ?? ''}</td>
					<td>{admission.correo ?? ''}</td>
					<td>{admission.careerName}</td>
					<td>{admission.opcion}</td>
					<td>{admission.processCode}</td>
					<td>{admission.modalityCode} - {admission.modalityName}</td>
					<td>{admission.ocreCode ?? ''}</td>
					<td>{admission.periodoIngreso}</td>
					<td>{new Date(admission.fechaAsignacion).toLocaleDateString()}</td>
					<td>
						{#if admission.batchId}
							#{admission.batchId} {admission.sourceFileName ?? ''}
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
