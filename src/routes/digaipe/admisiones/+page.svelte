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
	function cargar_admisiones() {
		window.location.href = resolve('/digaipe/admisiones/cargar');
	}
</script>

<h1>Admisiones</h1>
<div class="container-header-admisiones">
	<button class="button" onclick={cargar_admisiones}>Cargar admisiones</button>

	<form method="GET">
		<div class="container-inputs-admisiones">
			<div class="label-input">
				<label for="select-modality"> Modalidad </label>
				<select id="select-modality" name="modality">
					<option value="">Todas</option>
					{#each data.filterOptions.modalities as modality (modality.code)}
						<option value={modality.code} selected={data.filters.modality === modality.code}>
							{modality.code} - {modality.name}
						</option>
					{/each}
				</select>
			</div>
			<div class="label-input">
				<label for="select-period"> Periodo </label>
				<select id="period" name="period">
					<option value="">Todos</option>
					{#each data.filterOptions.periods as period (period.period)}
						<option value={period.period} selected={data.filters.period === period.period}>
							{period.period}
						</option>
					{/each}
				</select>
			</div>

			<div class="label-input">
				<label for="career"> Carrera </label>
				<select id="career" name="career">
					<option value="">Todas</option>
					{#each data.filterOptions.careerOptions as career (career.opcion)}
						<option value={career.opcion} selected={data.filters.career === career.opcion}>
							{career.opcion}
						</option>
					{/each}
				</select>
			</div>

			<div class="label-input">
				<label for="date-from"> Desde </label>
				<input id="date-from" name="dateFrom" type="date" value={data.filters.dateFrom} />
			</div>

			<div class="label-input">
				<label for="date-to"> Hasta </label>
				<input id="date-to" name="dateTo" type="date" value={data.filters.dateTo} />
			</div>
		</div>
		<div class="container-inputs-admisiones" style="margin-top:1em;">
			<div class="label-input">
				<label for="select-process"> Proceso </label>
				<select id="select-process" name="process">
					<option value="">Todos</option>
					{#each data.filterOptions.processes as process (process.code)}
						<option value={process.code} selected={data.filters.process === process.code}>
							{process.code}
						</option>
					{/each}
				</select>
			</div>

			<div class="label-input" style="width: 50%;">
				<label for="buscar"> Buscar </label>
				<input
					style="width:100%;"
					id="buscar"
					name="search"
					type="search"
					value={data.filters.search}
				/>
			</div>
			<button class="button-admisiones" type="submit">Filtrar</button>
			<a class="button-clear-admisiones" href={resolve('/digaipe/admisiones')}>Limpiar</a>
		</div>
	</form>
</div>
<p>{data.admissions.length} admisiones</p>

{#if data.admissions.length === 0}
	<p>No hay admisiones para los filtros seleccionados.</p>
{:else}
	<table class="table_container">
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

<style>
	.container-header-admisiones {
		display: flex;
		flex-direction: row;
		gap: 2em;
		margin-bottom: 1rem;
		justify-content: center;
	}
	.container-header-admisiones form {
		width: 80%;
	}
	.container-header-admisiones input,
	.container-header-admisiones select {
		width: fit-content;
	}
	.container-inputs-admisiones {
		display: flex;
		flex-wrap: wrap;
		gap: 2em;
	}
	.button-admisiones,
	.button-clear-admisiones {
		padding: 1em 1.5em;
		height: 3.5em;
		align-self: end;
		border-radius: 8px;
	}
	.button-clear-admisiones {
		background-color: transparent;
		border: 1px solid var(--ula-blue);
	}
</style>
