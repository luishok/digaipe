<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<h1>Generacion de planilla DIGAIPE</h1>

<p>Admisiones con proceso activo para {data.today}</p>

<form method="GET">
	<label>
		Buscar
		<input name="search" type="search" value={data.search} />
	</label>
	<button type="submit">Buscar</button>
	<a href={resolve('/digaipe/generacion-planilla')}>Limpiar</a>
</form>

<p>{data.admissions.length} admisiones</p>

{#if data.admissions.length === 0}
	<p>No hay admisiones disponibles para generar planilla hoy.</p>
{:else}
	<table class="table_container">
		<thead>
			<tr>
				<th>Cedula</th>
				<th>Estudiante</th>
				<th>Telefono</th>
				<th>Correo</th>
				<th>Genero</th>
				<th>Carrera</th>
				<th>Proceso</th>
				<th>Modalidad</th>
				<th>Periodo</th>
				<th>Accion</th>
			</tr>
		</thead>
		<tbody>
			{#each data.admissions as admission (admission.id)}
				<tr>
					<td>{admission.cedula}</td>
					<td>{admission.apellidosNombres}</td>
					<td>{admission.telefono ?? ''}</td>
					<td>{admission.correo ?? ''}</td>
					<td>{admission.genero ?? ''}</td>
					<td>{admission.careerName}</td>
					<td>{admission.processCode}</td>
					<td>{admission.modalityCode} - {admission.modalityName}</td>
					<td>{admission.periodoIngreso}</td>
					<td>
						<a href={resolve(`/digaipe/generacion-planilla/${admission.id}`)}>Seleccionar</a>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
