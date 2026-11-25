<script lang="ts">
	import { enhance } from '$app/forms';
	import { can } from '$lib/permissions';
	import { formatDate } from '$lib/dates';
	import { resolve } from '$app/paths';

	let { form, data } = $props();
	const canManage = $derived(can(data.user, 'processes.manage'));
	const canToggle = $derived(can(data.user, 'processes.toggle'));

	let dateInput = $state('');
	let dates = $state<string[]>([]);
	let dateInputs = $state<Record<number, string>>({});
	let pendingDates = $state<Record<number, string[]>>({});

	function addDate() {
		if (!dateInput || dates.includes(dateInput)) return;
		dates = [...dates, dateInput];
		dateInput = '';
		document.getElementsByClassName('selected-dates')[0].setAttribute('style', 'display: block;');
	}

	function removeDate(date: string) {
		dates = dates.filter((d) => d !== date);
		if (dates.length === 0) {
			document.getElementsByClassName('selected-dates')[0].setAttribute('style', 'display: none;');
		}
	}

	function processPendingDates(processId: number) {
		return pendingDates[processId] ?? [];
	}

	function addProcessDate(processId: number, existingDates: string[]) {
		const processDateInput = dateInputs[processId];
		const currentDates = processPendingDates(processId);
		if (
			!processDateInput ||
			existingDates.includes(processDateInput) ||
			currentDates.includes(processDateInput)
		)
			return;

		pendingDates = { ...pendingDates, [processId]: [...currentDates, processDateInput] };
		dateInputs = { ...dateInputs, [processId]: '' };
	}

	function removePendingProcessDate(processId: number, date: string) {
		pendingDates = {
			...pendingDates,
			[processId]: processPendingDates(processId).filter((pendingDate) => pendingDate !== date)
		};
	}

	function clearPendingProcessDates(processId: number) {
		pendingDates = { ...pendingDates, [processId]: [] };
	}

	// Escuchamos de forma reactiva cuando "form.saved" pase a ser verdadero
	$effect(() => {
		if (form?.saved) {
			const timer = setTimeout(() => {
				location.reload();
				// Si necesitas limpiar el estado del form:
				if (form) form.saved = false;
			}, 4000);

			// Svelte 5 ejecuta esta función de retorno para limpiar el efecto anterior
			return () => clearTimeout(timer);
		}
	});
</script>

<h1>Procesos de Admisión</h1>
{#if form?.error}<p role="alert">{form.error}</p>{/if}
{#if form?.message}<p role="status">{form.message}</p>{/if}

<!-- Step 1: Create the process -->
<div class="process-container">
	{#if canManage}
	<div class="process-left">
		<h2>Crear Proceso de Admisión</h2>
		<div class="item-process-left">
			<form
				class="create-process"
				id="create-process-form"
				method="POST"
				action="?/create"
				use:enhance
			>
				<div class="input-group2">
					<label for="process-code" class="label-text">Código del Proceso</label>
					<input
						id="process-code"
						class="input-text"
						name="code"
						type="text"
						placeholder="Ingresa código del proceso"
						required
						maxlength="100"
					/>
				</div>
				<div class="container-button-create">
					<button type="submit">Crear</button>
				</div>
			</form>

			{#if form?.error}
				<p style="color: red">❌{form.error}</p>
			{/if}

			{#if form?.processId}
				<p>✅Process created: <strong>{form.code}</strong></p>
				<style>
					#create-process-form {
						display: none;
					}
				</style>
			{/if}
		</div>
		{#if form?.processId}
			<div class="item-process-left">
				<label for="active-dates-input">Agregar Fechas Activas</label>
				<!-- Step 2: Pick and list dates -->
				<input id="active-dates-input" class="input-date" type="date" bind:value={dateInput} />
				<button type="button" onclick={addDate}>+</button>

				<div class="selected-dates">
					<p style="font-weight: bold;">Fechas Seleccionadas</p>
					<ul>
						{#each dates as date (date)}
							<li>
								{formatDate(date)}
								<button type="button" class="button-red" onclick={() => removeDate(date)}>x</button>
							</li>
						{/each}
					</ul>
				</div>

				<!-- Step 3: Save dates -->
				{#if dates.length > 0}
					<form
						class="save-dates-form"
						method="POST"
						action="?/saveDates"
						use:enhance={() => {
							return async ({ result, update }) => {
								await update();
								if (result.type === 'success') {
									dates = [];
									form = null;
									update({ reset: true });
								}
							};
						}}
					>
						<input type="hidden" name="processId" value={form.processId} />
						<input type="hidden" name="dates" value={JSON.stringify(dates)} />
						<button type="submit">Guardar Fechas</button>
					</form>
				{/if}
			</div>
			{#if form?.saved}
				<style>
					.item-process-left {
						display: none;
					}
					.mensaje-exito {
						display: block !important;
						background: white;
						padding: 1rem;
						text-align: center;
						border-radius: 8px;
						height: fit-content;
					}
				</style>
				<div class="mensaje-exito">
					<p>✅ Fechas Guardadas!</p>
				</div>
			{/if}
		{/if}
	</div>
	{/if}

	<div class="process-right">
		<h2>Procesos Guardados</h2>
		<div class="table_container">
			<table>
				<thead>
					<tr>
						<th>ID</th>
						<th>Codigo</th>
						<th>Estado</th>
						<th>Fechas</th>
						<th>Cierre e informes</th>
						{#if canManage}<th>Agregar fechas</th>{/if}
						{#if canToggle}<th>Activar / Desactivar</th>{/if}
					</tr>
				</thead>
				<tbody>
					{#each data.all_admission_proc.toReversed() as process (process.id)}
						<tr>
							<td>{process.id}</td>
							<td>{process.code}</td>
							<td>
								{#if process.closedAt}
									Cerrado el {formatDate(process.closedAt)}
								{:else if process.status === 'active'}
									Activo hoy
								{:else if process.status === 'scheduled'}
									Programado (próxima: {formatDate(process.nextDate)})
								{:else if process.status === 'finished'}
									Plazo finalizado — pendiente de cierre
								{:else if process.status === 'disabled'}
									Deshabilitado
								{:else}
									Sin fechas
								{/if}
							</td>
							<td>{process.dates.length > 0 ? process.dates.map(formatDate).join(', ') : 'Sin fechas activas'}</td>
							<td>
								{#if can(data.user, 'statistics.view')}
									<div class="reports-links">
										<a class="btn-report-link" href={resolve(`/digaipe/estadisticas?reportMode=matricula&filter_process=${encodeURIComponent(process.code)}`)}>
											<span class="icon">📊</span> Ver resultado de matrícula
										</a>
										{#each data.closures.filter((closure) => closure.processId === process.id) as closure (closure.id)}
											<a class="btn-closure-link" href={resolve(`/digaipe/estadisticas/cierres/${closure.id}`)}>
												📄 Informe oficial v{closure.version}
											</a>
										{/each}
									</div>
								{/if}
								{#if canToggle && (process.closedAt || (process.dates.length && process.dates.every((date) => date < data.today)))}
									<form class="action-inline-form" method="POST" action={process.closedAt ? '?/reopen' : '?/close'} use:enhance={({ cancel }) => {
										if (!confirm(process.closedAt ? '¿Reabrir el proceso? Se conservarán los informes oficiales anteriores.' : '¿Cerrar el proceso? Las asignaciones sin matrícula quedarán como No matriculado y se guardará un informe oficial.')) cancel();
									}}>
										<input type="hidden" name="processId" value={process.id} />
										<input class="input-reason" name="reason" aria-label="Motivo del cierre o reapertura" placeholder="Motivo del cierre o reapertura" maxlength="500" required />
										<button type="submit" class={process.closedAt ? 'btn-reopen' : 'btn-close'}>
											{process.closedAt ? 'Reabrir proceso' : 'Cerrar proceso'}
										</button>
									</form>
								{/if}
							</td>
							{#if canManage}
							<td>
								<input class="input-date" type="date" bind:value={dateInputs[process.id]} disabled={!!process.closedAt} />
								<button type="button" disabled={!!process.closedAt} onclick={() => addProcessDate(process.id, process.dates)}
									>+</button
								>

								{#if processPendingDates(process.id).length > 0}
									<ul>
										{#each processPendingDates(process.id) as date (date)}
											<li>
												{formatDate(date)}
												<button
													type="button"
													class="button-red"
													onclick={() => removePendingProcessDate(process.id, date)}>x</button
												>
											</li>
										{/each}
									</ul>

									<form
										class="save-dates-form"
										method="POST"
										action="?/saveDates"
										use:enhance={() => {
											return async ({ result, update }) => {
												await update();
												if (result.type === 'success') {
													clearPendingProcessDates(process.id);
												}
											};
										}}
									>
										<input type="hidden" name="processId" value={process.id} />
										<input
											type="hidden"
											name="dates"
											value={JSON.stringify(processPendingDates(process.id))}
										/>
										<button type="submit">Guardar Fechas</button>
									</form>
								{/if}
							</td>
							{/if}
							{#if canToggle}
							<td>
								<form
									class="action-inline-form"
									method="POST"
									action="?/setEnabled"
									use:enhance={({ cancel }) => {
										const message = process.isEnabled
											? `¿Desactivar el proceso ${process.code}? No se podrán generar planillas ni revisar documentos hasta reactivarlo.`
											: `¿Reactivar el proceso ${process.code}?`;
										if (!confirm(message)) cancel();
									}}
								>
									<input type="hidden" name="processId" value={process.id} />
									<input type="hidden" name="enabled" value={process.isEnabled ? 'false' : 'true'} />
									<input
										class="input-reason"
										name="reason"
										type="text"
										placeholder="Motivo"
										aria-label="Motivo del cambio"
										required
										maxlength="500"
									/>
									<button type="submit" disabled={!!process.closedAt} class={process.isEnabled ? 'btn-toggle-disable' : 'btn-toggle-enable'}>
										{process.isEnabled ? 'Desactivar' : 'Reactivar'}
									</button>
								</form>
							</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

<style>
	h1 {
		text-align: center;
	}
	.process-container {
		display: flex;
		flex-direction:column;
		gap: 2rem;
		height: max-content;
		/* max-height: 70vh; */
	}
	.process-container p {
		margin: 0;
	}
	.process-left,
	.process-right {
		flex: 1;
		border-radius: 8px;
		overflow-y: auto;
	}
	.process-left {
		background-color: var(--ula-blue);
		padding: 1rem;
		gap: 0.5rem;
		display: flex;
		flex-direction: column;
		padding: 24px;
		border-radius: 12px;
		box-shadow:
			0 4px 6px 4px rgba(0, 0, 0, 0.05),
			0 2px 4px 4px rgba(0, 0, 0, 0.03);
	}

	.process-left h2 {
		font-size: 20px;
		color: #ffffff; /* Blanco para resaltar sobre el fondo azul */
		margin-top: 0;
		margin-bottom: 20px;
		font-weight: 700;
		border-left: 4px solid white; /* Detalle elegante con blanco en el título */
		padding-left: 10px;
	}
	.item-process-left {
		border-radius: 8px;
		background: white;
		padding: 1.5rem;
		align-items: center;
	}
	.item-process-left label {
		display: flex;
		flex-direction: column;
		gap: 6px; /* Controla la separación entre el texto y el input */
		font-weight: 600; /* Opcional: para que resalte un poco más el título */
		margin: 0 1em;
		width: fit-content;
	}
	.process-right {
		background-color: var(--ula-light);
		padding: 1rem;
		padding: 24px;
		border-radius: 12px;
		box-shadow:
			0 4px 6px 4px rgba(0, 0, 0, 0.05),
			0 2px 4px 4px rgba(0, 0, 0, 0.03);
	}

	/* Efecto Hover (Cuando el mouse pasa por encima) */
	.input-date:hover {
		border-color: #94a3b8;
	}

	/* Estado Focus (Cuando el usuario hace clic o interactúa con él) */
	.input-date:focus {
		border-color: #0033a0; /* Tu color de acento */
		/* Crea un halo sutil alrededor del input usando tu azul con opacidad */
		box-shadow: 0 0 0 3px rgba(0, 51, 160, 0.15);
	}

	/* --- Personalización del Icono de Calendario Nativo --- */

	/* Para navegadores basados en Webkit (Chrome, Safari, Edge, Opera) */
	.input-date::-webkit-calendar-picker-indicator {
		background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%230033a0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>');
		cursor: pointer;
		padding: 2px;
		border-radius: 4px;
		transition: background-color 0.2s;
	}

	/* Cambia ligeramente el fondo del icono al pasar el mouse sobre él */
	.input-date::-webkit-calendar-picker-indicator:hover {
		background-color: rgba(0, 51, 160, 0.08);
	}

	.selected-dates {
		margin-top: 1rem;
		padding: 0.5rem;
		display: none;
		margin-bottom: 1rem;
	}
	.selected-dates ul {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-left: 1em;
	}

	.selected-dates li {
		background-color: #e2e8f0;
		padding: 0.5rem;
		border-radius: 4px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		letter-spacing: 4px;
	}
	.button-red {
		background-color: #ef4444;
	}
	.save-dates-form {
		display: flex;
		justify-content: center;
	}
	.save-dates-form button,
	.create-process button {
		width: 50%;
		min-width: fit-content;
	}
	.create-process .container-button-create {
		display: flex;
		justify-content: center;
		margin-top: 1rem;
	}

	.mensaje-exito {
		display: none;
	}

	/* Título de la sección */
	.process-right h2 {
		font-size: 20px;
		color: #1e293b; /* Gris oscuro elegante */
		margin-top: 0;
		margin-bottom: 20px;
		font-weight: 700;
		border-left: 4px solid #0033a0; /* Detalle elegante con tu azul en el título */
		padding-left: 10px;
	}

	/* Contenedor responsivo de la tabla */

	/* Estilos generales de la tabla */
	.process-right table {
		width: 100%;
		border-collapse: collapse; /* Elimina dobles bordes molestos */
		text-align: left;
		font-size: 14px;
	}

	/* Encabezado (Thead) */
	.process-right thead {
		background-color: #f8fafc; /* Gris ultra claro para contrastar con el fondo blanco */
		border-bottom: 2px solid #e2e8f0;
	}

	.process-right th {
		padding: 14px 16px;
		font-weight: 600;
		color: #475569; /* Color de texto suave pero legible para los headers */
		text-transform: uppercase; /* Opcional: hace que los headers se vean más corporativos */
		font-size: 12px;
		letter-spacing: 0.05em;
	}

	/* Filas y Celdas del Cuerpo (Tbody) */
	.process-right tbody tr {
		border-bottom: 1px solid #f1f5f9; /* Línea divisoria muy sutil entre registros */
		transition: background-color 0.15s ease;
	}

	/* Efecto cebra opcional (filas intercaladas con un tono gris casi imperceptible) */
	.process-right tbody tr:nth-child(even) {
		background-color: #fcfdfe;
	}

	/* Efecto Hover: Resalta la fila donde el usuario tiene el mouse */
	.process-right tbody tr:hover {
		background-color: rgba(0, 51, 160, 0.03); /* Un toque sutilísimo de tu azul */
	}

	.process-right td {
		padding: 14px 16px;
		color: #334155; /* Texto del contenido */
		vertical-align: middle;
	}

	/* Evita que el texto de las celdas se pegue feo si hay saltos de línea */
	.process-right td strong {
		color: #1e293b;
		font-weight: 600;
	}

	/* Enlaces de informes y estadísticas */
	.reports-links {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-bottom: 8px;
	}

	.btn-report-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
		color: var(--ula-blue);
		background-color: #eff6ff;
		border: 1px solid #bfdbfe;
		padding: 6px 12px;
		border-radius: 6px;
		text-decoration: none;
		width: fit-content;
		transition: all 0.2s ease;
	}

	.btn-report-link:hover {
		background-color: var(--ula-blue);
		color: #ffffff;
		border-color: var(--ula-blue);
		text-decoration: none;
		box-shadow: 0 2px 4px rgba(0, 51, 160, 0.15);
	}

	.btn-closure-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: #475569;
		background-color: #f8fafc;
		border: 1px solid #e2e8f0;
		padding: 4px 10px;
		border-radius: 6px;
		text-decoration: none;
		width: fit-content;
		transition: all 0.2s ease;
	}

	.btn-closure-link:hover {
		background-color: #e2e8f0;
		color: #1e293b;
		text-decoration: none;
	}

	/* Formularios inline de acciones (Cierre y Activar/Desactivar) */
	.action-inline-form {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 170px;
		max-width: 220px;
	}

	.input-reason {
		padding: 7px 10px;
		border: 1px solid #cbd5e1;
		border-radius: 6px;
		font-size: 12px;
		background-color: #ffffff;
		color: #1e293b;
		width: 100%;
		box-sizing: border-box;
		transition: border-color 0.2s, box-shadow 0.2s;
	}

	.input-reason:focus {
		outline: none;
		border-color: var(--ula-blue);
		box-shadow: 0 0 0 2px rgba(0, 51, 160, 0.15);
	}

	.input-reason::placeholder {
		color: #94a3b8;
		font-size: 11px;
	}

	/* Botones de acción */
	.btn-close {
		background-color: #f59e0b;
		color: #ffffff;
		border: none;
		padding: 6px 12px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		width: 100%;
		transition: background-color 0.2s, box-shadow 0.2s;
	}

	.btn-close:hover {
		background-color: #d97706;
		box-shadow: 0 2px 4px rgba(217, 119, 6, 0.25);
	}

	.btn-reopen {
		background-color: var(--ula-blue);
		color: #ffffff;
		border: none;
		padding: 6px 12px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		width: 100%;
		transition: background-color 0.2s, box-shadow 0.2s;
	}

	.btn-reopen:hover {
		background-color: var(--ula-dark);
		box-shadow: 0 2px 4px rgba(0, 36, 112, 0.25);
	}

	.btn-toggle-disable {
		background-color: #ef4444;
		color: #ffffff;
		border: none;
		padding: 6px 12px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		width: 100%;
		transition: background-color 0.2s, box-shadow 0.2s;
	}

	.btn-toggle-disable:hover:not(:disabled) {
		background-color: #dc2626;
		box-shadow: 0 2px 4px rgba(220, 38, 38, 0.25);
	}

	.btn-toggle-disable:disabled,
	.btn-toggle-enable:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-toggle-enable {
		background-color: #10b981;
		color: #ffffff;
		border: none;
		padding: 6px 12px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		width: 100%;
		transition: background-color 0.2s, box-shadow 0.2s;
	}

	.btn-toggle-enable:hover:not(:disabled) {
		background-color: #059669;
		box-shadow: 0 2px 4px rgba(5, 150, 105, 0.25);
	}
</style>
