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

	function openPlanilla(admission: Row, event?: MouseEvent) {
		if (event) {
			(event.currentTarget as HTMLElement)?.closest('details')?.removeAttribute('open');
		}
		selected = admission;
		planillaDialog?.showModal();
	}

	function onRowClick(event: MouseEvent, admission: Row) {
		const target = event.target as HTMLElement;
		if (target.closest('button, a, details, summary, input, select, textarea, label')) {
			return;
		}
		openPlanilla(admission);
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
		margin: 1.5rem auto; /* margin auto a los lados lo centra horizontalmente */
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

	/* Modal dialog */
	dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		border: none;
		border-radius: 12px;
		padding: 28px 24px;
		box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
		background-color: #ffffff;
		width: 90%;
		max-width: 580px;
		max-height: 85vh;
		overflow-y: auto;
		margin: 0;
	}

	dialog::backdrop {
		background-color: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(3px);
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		position: absolute;
		top: 16px;
		right: 16px;
	}

	.tag-table{
		display: flex;
		justify-content: space-between;

	}

	.table_container {
		width: 100%;
		max-width: 100%;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		margin: 1rem 0;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		background-color: #ffffff;
		box-sizing: border-box;
	}

	.table_container table {
		width: 100%;
		min-width: 520px;
		border-collapse: collapse;
		text-align: left;
	}

	.table_container th {
		padding: 12px 16px;
		background-color: #f8fafc;
		border-bottom: 2px solid #e2e8f0;
		font-weight: 600;
		color: #475569;
		font-size: 0.8rem;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.table_container td {
		padding: 14px 16px;
		border-bottom: 1px solid #f1f5f9;
		font-size: 0.9rem;
		color: #1e293b;
		vertical-align: middle;
	}

	.cedula-cell {
		display: flex;
		flex-direction: column;
		gap: 4px;
		align-items: flex-start;
	}

	.close-button {
		margin: 0;
		padding: 0;
		border-radius: 50%;
		width: 32px;
		height: 32px;
		font-size: 14px;
		font-weight: bold;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #f1f5f9;
		color: #64748b;
		border: 1px solid #e2e8f0;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.close-button:hover {
		background-color: #e2e8f0;
		color: #0f172a;
	}

	.planilla-dialog-title {
		text-align: center;
		margin-bottom: 8px;
	}

	.planilla-dialog-title h2 {
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--ula-blue, #003399);
		margin: 0;
	}

	.modal-desc {
		font-size: 0.9rem;
		color: #64748b;
		text-align: center;
		margin-bottom: 16px;
		line-height: 1.4;
	}

	.info-grid {
		display: grid;
		grid-template-columns: 140px 1fr;
		gap: 8px 12px;
		background-color: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 14px 16px;
		margin: 0 0 14px 0;
		font-size: 0.9rem;
		text-align: left;
	}

	.info-grid dt {
		font-weight: 600;
		color: #475569;
	}

	.info-grid dd {
		margin: 0;
		color: #0f172a;
		font-weight: 500;
		word-break: break-word;
	}

	.edit-notice {
		font-size: 0.85rem;
		color: #64748b;
		margin-bottom: 16px;
		text-align: center;
	}

	.edit-notice a {
		color: var(--ula-blue, #003399);
		font-weight: 600;
		text-decoration: underline;
	}

	.confirm-checkbox {
		display: flex;
		align-items: center;
		gap: 10px;
		font-weight: 600;
		font-size: 0.9rem;
		color: #166534;
		cursor: pointer;
		padding: 10px 14px;
		background-color: #f0fdf4;
		border: 1px solid #bbf7d0;
		border-radius: 8px;
		margin-bottom: 16px;
	}

	.confirm-checkbox input[type="checkbox"] {
		width: 18px;
		height: 18px;
		cursor: pointer;
		accent-color: #16a34a;
	}

	.modal-button-group {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
	}

	.modal-button-group .btn-primary,
	.modal-button-group .btn-outline {
		height: 42px;
		border-radius: 8px;
		font-weight: 600;
		padding: 0 20px;
	}

	a.modal-action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		color: #ffffff !important;
		box-sizing: border-box;
	}

	a.modal-action-btn:hover {
		color: #ffffff !important;
		text-decoration: none;
		background-color: #002266;
	}

	.clickable-row {
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.clickable-row:hover,
	.clickable-row:hover td {
		background-color: #e6ebf6;
	}

	/* Ajuste responsivo para pantallas pequeñas y móviles */
	@media (max-width: 640px) {
		.search-card {
			padding: 16px;
			margin: 16px auto;
		}

		.search-form {
			flex-direction: column;
			align-items: stretch;
			gap: 12px;
		}

		.button-group {
			width: 100%;
			display: flex;
			gap: 8px;
		}

		.btn-primary,
		.btn-outline {
			flex: 1;
			text-align: center;
		}

		.table_container {
			border-radius: 6px;
			margin: 0.75rem 0;
		}

		.table_container th {
			padding: 10px 10px;
			font-size: 0.75rem;
		}

		.table_container td {
			padding: 10px 10px;
			font-size: 0.85rem;
		}

		dialog {
			width: 95%;
			padding: 20px 16px;
			max-height: 90vh;
		}

		.info-grid {
			grid-template-columns: 1fr;
			gap: 4px;
		}
	}
</style>


<svelte:window onfocus={refreshIfReturning} />

<dialog bind:this={planillaDialog} aria-labelledby="planilla-dialog-title" onclose={() => (selected = null)}>
	{#if selected}
		<div class="modal-actions">
			<button type="button" onclick={() => planillaDialog?.close()} class="close-button" aria-label="Cerrar modal">✕</button>
		</div>
		<div class="planilla-dialog-title">
			<h2 id="planilla-dialog-title">{selected.processingStatus ? 'Reimprimir planilla' : 'Generar planilla'}</h2>
		</div>
		{#if selected.alternativeCount > 1}<p role="status">Este estudiante tiene {selected.alternativeCount} modalidades para esta carrera y proceso. Verifique la modalidad elegida; solo podrá matricularse por una.</p>{/if}
		<p class="modal-desc">
			{#if selected.processingStatus}
				Esta planilla ya fue generada previamente (estado actual: <b>{selected.processingStatus}</b>).
			{:else}
				Revise los datos. La planilla se genera con ellos y la admisión pasa a revisión de documentos
				(estado <b>pendiente</b>).
			{/if}
		</p>
		<dl class="info-grid">
			<dt>Cédula</dt><dd>{selected.cedula}</dd>
			<dt>Estudiante</dt><dd>{selected.planilla.propio}</dd>
			<dt>Programa</dt><dd>{selected.planilla.prog}</dd>
			<dt>Modalidad</dt><dd>{selected.planilla.mod}</dd>
			<dt>Período de ingreso</dt><dd>{selected.periodoIngreso}</dd>
			<dt>Proceso</dt><dd>{selected.processCode}</dd>
			<dt>Fecha de asignación</dt><dd>{formatDate(selected.fechaAsignacion)}</dd>
			<dt>Fecha de matrícula</dt><dd>{selected.planilla.fechaMat}</dd>
			<dt>N.º de planilla</dt><dd>{selected.planilla.planilla}</dd>
			<dt>Referencia de admisión</dt><dd>{selected.planilla.admissionReference}</dd>
			<dt>Teléfono</dt><dd>{selected.telefono ?? '—'}</dd>
			<dt>Correo</dt><dd>{selected.correo ?? '—'}</dd>
			{#if selected.processingStatus}
				<dt>Estado</dt><dd><span class="status-badge status-{selected.processingStatus === 'en proceso' ? 'en-proceso' : selected.processingStatus}">{selected.processingStatus}</span></dd>
			{/if}
		</dl>
		<p class="edit-notice">
			¿Algún dato está mal?
			<a href={resolve(`/digaipe/generacion-planilla/${selected.id}`)}>Corregir en el detalle</a>
		</p>

		{#if selected.processingStatus}
			<div class="modal-button-group">
			
				<!-- <button type="button" class="btn-outline" onclick={() => planillaDialog?.close()}>Cerrar</button> -->
				<a
					href={resolve(`/digaipe/generacion-planilla/${selected.id}`)}
					target="_blank"
					class="btn-outline"
				>
					Detalles
				</a>
				<a
					href={pdfUrl(selected.id)}
					target="_blank"
					rel="noreferrer"
					class="btn-primary modal-action-btn"
					onclick={() => planillaDialog?.close()}
				>
					Reimprimir
				</a>
			</div>
		{:else}
			<form method="POST" action={pdfUrl(selected.id)} target="_blank" onsubmit={generated}>
				<label class="confirm-checkbox">
					<input type="checkbox" name="confirmado" required />
					<span>Verifiqué que los datos son correctos</span>
				</label>
				<div class="modal-button-group">
					<button type="button" class="btn-outline" onclick={() => planillaDialog?.close()}>Cancelar</button>
					<button type="submit" class="btn-primary">Generar planilla PDF</button>
				</div>
			</form>
		{/if}
	{/if}
</dialog>

<h1>Generacion de planilla</h1>



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

<div class="tag-table">
	<p>{data.admissions.length} admisiones</p>
	<p>Admisiones con proceso activo para <b>{data.today}</b></p>
</div>

{#if data.admissions.length === 0}
	<p>No hay admisiones disponibles para generar planilla hoy.</p>
{:else}
	<div class="table_container">
		<table>
			<thead>
				<tr>
					<th>Cédula</th>
					<th>Estudiante</th>
					<th>Teléfono</th>
					<th>Correo</th>
				</tr>
			</thead>
			<tbody>
				{#each data.admissions as admission (admission.id)}
					<tr
						class="clickable-row"
						onclick={(event) => onRowClick(event, admission)}
						title="Haga clic para ver o generar planilla"
					>
						<td>
							<div class="cedula-cell">
								<span>{admission.cedula}</span>
								{#if admission.processingStatus === 'pendiente' || admission.processingStatus === 'en proceso' || admission.processingStatus === 'devuelto' || admission.processingStatus === 'matriculado'}
									<span class="status-badge status-{admission.processingStatus === 'en proceso' ? 'en-proceso' : admission.processingStatus}">{admission.processingStatus}</span>
								{/if}
							</div>
						</td>
						<td>{admission.apellidosNombres}</td>
						<td>{admission.telefono ?? ''}</td>
						<td>{admission.correo ?? ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
