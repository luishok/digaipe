<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>
<style>
	/* Contenedor tipo Card centrado */
	.search-card {
		background-color: #ffffff;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		padding: 24px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
		max-width: 700px; /* Controla el ancho máximo de la tarjeta */
		margin: 30px auto; /* margin auto a los lados lo centra horizontalmente */
	}

	.search-form {
		display: flex;
		align-items: flex-end;
		gap: 15px;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 5px;
		flex-grow: 1;
	}

	.input-group label {
		font-size: 14px;
		font-weight: 700;
		color: #1a1a1a;
	}

	.input-group input {
		padding: 0 12px;
		border: 1px solid #ced4da;
		border-radius: 4px;
		font-size: 14px;
		height: 40px;
		box-sizing: border-box;
		background-color: #ffffff;
		outline: none;
		transition: border-color 0.2s;
	}

	.input-group input:focus {
		border-color: #003399; /* Azul institucional */
	}

	.button-group {
		display: flex;
		gap: 10px;
	}

	.btn-primary {
		background-color: #003399; 
		color: white;
		border: none;
		padding: 0 24px;
		height: 40px;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn-primary:hover {
		background-color: #002266;
	}

	.btn-outline {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background-color: white;
		color: #003399;
		border: 1px solid #003399;
		padding: 0 24px;
		height: 40px;
		border-radius: 4px;
		font-size: 14px;
		font-weight: 500;
		text-decoration: none;
		box-sizing: border-box;
		transition: background-color 0.2s;
	}

	.btn-outline:hover {
		background-color: #f8f9fa;
	}

	/* Ajuste responsivo para pantallas pequeñas */
	@media (max-width: 500px) {
		.search-form {
			flex-direction: column;
			align-items: stretch;
		}
		.button-group {
			width: 100%;
			justify-content: space-between;
		}
		.btn-primary, .btn-outline {
			flex: 1;
		}
	}
</style>


<h1>Generacion de planilla DIGAIPE</h1>

<p>Admisiones con proceso activo para {data.today}</p>

<div class="search-card">
	<form method="GET" class="search-form">
		<div class="input-group">
			<label for="search">Buscar</label>
			<input 
				id="search"
				name="search" 
				type="search" 
				value={data.search} 
				placeholder="Ingrese un término de búsqueda..."
			/>
		</div>
		<div class="button-group">
			<button type="submit" class="btn-primary">Buscar</button>
			<a href={resolve('/digaipe/generacion-planilla')} class="btn-outline">Limpiar</a>
		</div>
	</form>
</div>

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
