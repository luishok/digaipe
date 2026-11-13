<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { can } from '$lib/permissions';
	import { formatDate } from '$lib/dates';

	let { data } = $props();

	type Row = (typeof data.admissions)[number];
	let planillaDialog = $state<HTMLDialogElement>();
	let selected = $state<Row | null>(null);
	let refreshOnReturn = false;

	const pdfUrl = (id: number) => resolve(`/digaipe/generacion-planilla/${id}/pdf`);

	function openPlanilla(event: MouseEvent, admission: Row) {
		(event.currentTarget as HTMLElement).closest('details')?.removeAttribute('open');
		selected = admission;
		planillaDialog?.showModal();
	}

	// The PDF opens in a new tab and registers the processing there. Close the modal only after
	// the browser has started that submission (removing the form now would cancel it), then
	// refresh the list so the row shows its new status.
	function generated() {
		refreshOnReturn = true;
		setTimeout(() => planillaDialog?.close(), 0);
		setTimeout(() => invalidateAll(), 1500);
	}
	function refreshIfReturning() {
		if (!refreshOnReturn) return;
		refreshOnReturn = false;
		invalidateAll();
	}
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


<svelte:window onfocus={refreshIfReturning} />

<dialog bind:this={planillaDialog} aria-labelledby="planilla-dialog-title" onclose={() => (selected = null)}>
	{#if selected}
		<h2 id="planilla-dialog-title">Generar planilla</h2>
		<p>
			Revise los datos. La planilla se genera con ellos y la admisión pasa a revisión de documentos
			(estado <b>pendiente</b>).
		</p>
		<dl>
			<dt>Cédula</dt><dd>{selected.cedula}</dd>
			<dt>Estudiante</dt><dd>{selected.planilla.propio}</dd>
			<dt>Programa</dt><dd>{selected.planilla.prog}</dd>
			<dt>Modalidad</dt><dd>{selected.planilla.mod}</dd>
			<dt>Período de ingreso</dt><dd>{selected.periodoIngreso}</dd>
			<dt>Proceso</dt><dd>{selected.processCode}</dd>
			<dt>Fecha de asignación</dt><dd>{formatDate(selected.fechaAsignacion)}</dd>
			<dt>Fecha de matrícula</dt><dd>{selected.planilla.fechaMat}</dd>
			<dt>N.º de planilla</dt><dd>{selected.planilla.planilla}</dd>
			<dt>Teléfono</dt><dd>{selected.telefono ?? '—'}</dd>
			<dt>Correo</dt><dd>{selected.correo ?? '—'}</dd>
		</dl>
		<p>
			¿Algún dato está mal?
			<a href={resolve(`/digaipe/generacion-planilla/${selected.id}`)}>Corregir en el detalle</a>
		</p>
		<form method="POST" action={pdfUrl(selected.id)} target="_blank" onsubmit={generated}>
			<label>
				<input type="checkbox" name="confirmado" required />
				Verifiqué que los datos son correctos
			</label>
			<div class="button-group">
				<button type="submit" class="btn-primary">Generar planilla PDF</button>
				<button type="button" class="btn-outline" onclick={() => planillaDialog?.close()}>Cancelar</button>
			</div>
		</form>
	{/if}
</dialog>

<h1>Generacion de planilla</h1>

<p>Admisiones con proceso activo para <b>{data.today}</b></p>

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
					<td>
						{admission.cedula}
						{#if admission.processingStatus === 'pendiente' || admission.processingStatus === 'en proceso' || admission.processingStatus === 'devuelto' || admission.processingStatus === 'matriculado'}
							<span class="status-badge status-{admission.processingStatus === 'en proceso' ? 'en-proceso' : admission.processingStatus}">{admission.processingStatus}</span>
						{/if}
					</td>
					<td>{admission.apellidosNombres}</td>
					<td>{admission.telefono ?? ''}</td>
					<td>{admission.correo ?? ''}</td>
					<td>{admission.genero ?? ''}</td>
					<td>{admission.careerName}</td>
					<td>{admission.processCode}</td>
					<td>{admission.modalityCode} - {admission.modalityName}</td>
					<td>{admission.periodoIngreso}</td>
					<td>
						<details>
							<summary>Acciones</summary>
							<ul>
								{#if can(data.user, 'planillas.generate') && !admission.processingStatus}
									<li>
										<button type="button" onclick={(event) => openPlanilla(event, admission)}>
											Generar planilla
										</button>
									</li>
								{/if}
								{#if admission.processingStatus}
									<li>
										<a href={pdfUrl(admission.id)} target="_blank" rel="noreferrer">Reimprimir PDF</a>
									</li>
								{/if}
								<li>
									<a href={resolve(`/digaipe/generacion-planilla/${admission.id}`)}>Ver detalle</a>
								</li>
							</ul>
						</details>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
