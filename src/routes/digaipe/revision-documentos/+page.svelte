<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { formatDate } from '$lib/dates';
	import { page } from '$app/state';

	let { data, form } = $props();

	// Estados locales para la decisión de revisión
	let decisionStatus = $state<'matriculado' | 'devuelto'>('matriculado');
	let decisionReason = $state('');

	function handleStatusChange(status: 'matriculado' | 'devuelto') {
		decisionStatus = status;
		if (status === 'matriculado') {
			decisionReason = '';
		}
	}

	// Keep the active filters on action URLs so they survive the POST (with or without JS).
	const filterQuery = $derived(
		[...page.url.searchParams]
			.filter(([key]) => !key.startsWith('/'))
			.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
			.join('&')
	);
	const actionUrl = (name: string) => `?${filterQuery ? `${filterQuery}&` : ''}/${name}`;

	// SvelteKit skips load when a GET submit lands on the current URL; refetch explicitly.
	function filter(event: SubmitEvent) {
		const formData = new FormData(event.currentTarget as HTMLFormElement);
		const query = new URLSearchParams(formData as unknown as Record<string, string>).toString();
		if (`?${query}` !== page.url.search) return;
		event.preventDefault();
		invalidateAll();
	}
</script>

<style>
.label-title{
    display: flex;
    flex:column;
}
/* Contenedor track */
.switch-container {
	position: relative;
	display: inline-grid;
	grid-template-columns: 1fr 1fr;
	align-items: center;
	background-color: #e5e7eb;
	padding: 3px;
	border-radius: 9999px;
	border: 1px solid #d1d5db;
	user-select: none;
	min-height: 2.375rem;
	box-sizing: border-box;
	box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
}

/* Pastilla deslizante (Glider) */
.switch-glider {
	position: absolute;
	top: 3px;
	bottom: 3px;
	left: 3px;
	width: calc(50% - 3px);
	background-color: #ffffff;
	border-radius: 9999px;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 2px 5px rgba(0, 0, 0, 0.08);
	pointer-events: none;
	/* Transición con efecto de rebote sutil */
	transition: transform 0.28s cubic-bezier(0.34, 1.3, 0.64, 1),
	            box-shadow 0.25s ease;
	will-change: transform;
	z-index: 1;
}

/* Desplazamiento a la segunda posición */
.switch-container.is-devuelto .switch-glider {
	transform: translateX(100%);
}

/* Opciones (textos y radio) por encima de la pastilla */
.switch-option {
	position: relative;
	z-index: 2;
	display: inline-flex;
	justify-content: center;
	align-items: center;
	gap: 0.45rem;
	padding: 0.35rem 0.95rem;
	font-size: 0.875rem;
	font-weight: 500;
	color: #6b7280;
	cursor: pointer;
	line-height: 1;
	transition: color 0.22s ease;
	white-space: nowrap;
}

.switch-option:hover {
	color: #1f2937;
}

.switch-option.active {
	color: #111827;
	font-weight: 600;
}

/* Micro-animación de escala al pulsar (efecto táctil) */
.switch-container:active .switch-glider {
	transform: scaleX(0.96) scaleY(0.94);
}

.switch-container.is-devuelto:active .switch-glider {
	transform: translateX(100%) scaleX(0.96) scaleY(0.94);
}

/* Indicadores de estado con pulso sutil */
.status-indicator {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), 
	            opacity 0.2s ease;
	opacity: 0.6;
	transform: scale(0.85);
}

.switch-option.active .status-indicator {
	opacity: 1;
	transform: scale(1.15);
}

.dot-matriculado {
	background-color: #10b981;
}

.dot-devuelto {
	background-color: #ef4444;
}

/* Accesibilidad teclado */
.switch-option:has(input:focus-visible) {
	border-radius: 9999px;
	outline: 2px solid #2563eb;
	outline-offset: 1px;
}

/* Ocultar input nativo */
.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	white-space: nowrap;
	border: 0;
}
</style>

<h1>Revisión de documentos</h1>
{#if form?.message}<p aria-live="polite">{form.message}</p>{/if}

<form method="GET" onsubmit={filter}>
    <fieldset class="filter-card">
        <legend>Filtros</legend>

        <!-- Fila 1: Rango de fechas y Búsqueda -->
        <div class="filter-row-flex">
            <div class="label-input">
                <label>
                    Desde 
                    <input type="date" name="dateFrom" value={data.filters.dateFrom} />
                </label>
            </div>

            <div class="label-input">
                <label>
                    Hasta 
                    <input type="date" name="dateTo" value={data.filters.dateTo} />
                </label>
            </div>

            <div class="label-input">
                <label>
                    Buscar 
                    <input type="search" name="search" value={data.filters.search} placeholder="Escribe para buscar..." />
                </label>
            </div>
        </div>

        <!-- Fila 2: Desplegables de Estado, Proceso y Acciones -->
        <div class="filter-row-flex">
            <div class="label-input">
                <label>
                    Estado 
                    <select name="status">
                        <option value="">Todos</option>
                        <option value="pendiente" selected={data.filters.status === 'pendiente'}>Pendiente</option>
                        <option value="matriculado" selected={data.filters.status === 'matriculado'}>Matriculado</option>
                        <option value="devuelto" selected={data.filters.status === 'devuelto'}>Devuelto</option>
                    </select>
                </label>
            </div>

            <div class="label-input">
                <label>
                    Proceso 
                    <select name="process">
                        <option value="">Todos</option>
                        {#each data.processes as process (process.code)}
                            <option value={process.code} selected={data.filters.process === process.code}>
                                {process.code}
                            </option>
                        {/each}
                    </select>
                </label>
            </div>

            <!-- Botones de Acción -->
            <div class="filter-actions">
                <button type="submit" class="btn-submit">Filtrar</button>
                <a href={resolve('/digaipe/revision-documentos')} class="btn-secondary">Limpiar</a>
            </div>
        </div>
    </fieldset>
</form>

<form method="POST" action={actionUrl('review')} class="data-section" use:enhance>
    <!-- Header de la Sección -->
    <div class="section-header">
        <div>
            <h2>Admisiones con planilla generada</h2>
            <span class="count-badge">{data.rows.length} admisión(es)</span>
        </div>
    </div>

    <!-- Tabla Responsiva -->
    <div class="table-container">
        <table class="custom-table">
            <thead>
                <tr>
                    {#if data.canReview}
                        <th class="th-checkbox">
                            <span class="sr-only">Seleccionar</span>
                        </th>
                    {/if}
                    <th>Fecha válida</th>
                    <th>Estado</th>
                    <th>Proceso</th>
                    <th>Carrera</th>
                    <th>Cédula</th>
                    <th>Estudiante</th>
                    <th>Motivo</th>
                    {#if data.canUnlock}
                        <th>Administración</th>
                    {/if}
                </tr>
            </thead>
            <tbody>
                {#each data.rows as row (row.id)}
                    <tr>
                        {#if data.canReview}
                            <td class="td-checkbox">
                                {#if row.status != 'matriculado'}
                                    <input type="checkbox" name="processingId" value={row.id} class="row-checkbox" />
                                {:else}
                                    <input type="checkbox" name="processingId" disabled value={row.id} class="row-checkbox" />
                                {/if }
                                
                            </td>
                        {/if}
                        <td class="whitespace-nowrap">{formatDate(row.processingDate)}</td>
                        <td>
                            <span class="status-badge status-{row.status?.toLowerCase()}">
                                {row.status}
                            </span>
                        </td>
                        <td><code class="code-tag">{row.processCode}</code></td>
                        <td>{row.career ?? '—'}</td>
                        <td class="font-mono">{row.cedula}</td>
                        <td class="font-medium">{row.student}</td>
                        <td class="text-muted">{row.returnReason ?? '—'}</td>
                        {#if data.canUnlock}
                            <td>
                                <div class="admin-cell-action">
                                    <input 
                                        type="text" 
                                        name={`unlockReason_${row.id}`} 
                                        maxlength="500" 
                                        placeholder="Motivo de desbloqueo..." 
                                        class="table-input"
                                    />
                                    <button
                                        type="submit"
                                        formmethod="POST"
                                        formaction={actionUrl('unlock')}
                                        name="unlockProcessingId"
                                        value={row.id}
                                        class="btn-unlock"
                                    >
                                        Desbloquear
                                    </button>
                                </div>
                            </td>
                        {/if}
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>

    <!-- Panel de Decisión para Seleccionadas -->
	{#if data.canReview}
		<fieldset class="filter-card mt-4">
			<legend>Decisión para las seleccionadas</legend>

			<div class="filter-row-flex align-end">
				<!-- Opciones tipo Radio -->
				<!-- Interruptor Segmentado de Estado -->
                <!-- Interruptor Segmentado Animado -->
<div class="label-input">
	<span class="label-title">Decisión</span>
	<div 
		class="switch-container" 
		class:is-devuelto={decisionStatus === 'devuelto'}
	>
		<!-- Pastilla deslizante animada -->
		<span class="switch-glider" aria-hidden="true"></span>

		<label class="switch-option" class:active={decisionStatus === 'matriculado'}>
			<input
				type="radio"
				name="status"
				value="matriculado"
				class="sr-only"
				checked={decisionStatus === 'matriculado'}
				onchange={() => handleStatusChange('matriculado')}
			/>
			<span class="status-indicator dot-matriculado"></span>
			Matricular
		</label>

		<label class="switch-option" class:active={decisionStatus === 'devuelto'}>
			<input
				type="radio"
				name="status"
				value="devuelto"
				class="sr-only"
				checked={decisionStatus === 'devuelto'}
				onchange={() => handleStatusChange('devuelto')}
			/>
			<span class="status-indicator dot-devuelto"></span>
			Devolver
		</label>
	</div>
</div>
				<!-- Campo de Motivo condicionado -->
				<div class="label-input flex-1">
					<label>
						Motivo de devolución
						<input
							class="motivo-devolucion-text"
							type="text"
							name="reason"
							maxlength="500"
							placeholder={decisionStatus === 'devuelto'
								? 'Especifique la razón de devolución...'
								: 'No aplica para matriculado'}
							bind:value={decisionReason}
							disabled={decisionStatus === 'matriculado'}
							required={decisionStatus === 'devuelto'}
						/>
					</label>
				</div>

				<div class="filter-actions">
					<button type="submit" class="btn-submit">
						Guardar decisión
					</button>
				</div>
			</div>
		</fieldset>
	{/if}
</form>
