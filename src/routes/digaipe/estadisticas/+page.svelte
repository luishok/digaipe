<script lang="ts">
	import { resolve } from '$app/paths';
	import type { ReportMode } from '$lib/server/admisiones/statistics';
	import type { PageServerData } from './$types';
	let { data }: { data: PageServerData } = $props();

	const has = (arr: string[] | undefined, value: string) =>
		Array.isArray(arr) && arr.includes(value);
	const colChecked = (key: string) => !data.spec?.columns || data.spec.columns.includes(key);
	const dimChecked = (title: string) =>
		!data.spec?.dimensions || data.spec.dimensions.includes(title);

	// These are form-draft values. The applied values always come from the URL-backed `data.spec`.
	let reportMode = $state<ReportMode>('general');
	let dateFrom = $state('');
	let dateTo = $state('');
	let careerSearch = $state('');
	let copied = $state(false);
	let busy = $state(false);

	// Re-sync the form to the route after every navigation (GET submit, back/forward, shared
	// links) and clear the busy flag — otherwise the report-type select and "Vista previa"
	// button stay stuck on their initial values and stop reflecting the current report.
	$effect(() => {
		busy = false;
		reportMode = data.spec?.reportMode ?? 'general';
		dateFrom = data.spec?.dateFrom ?? '';
		dateTo = data.spec?.dateTo ?? '';
	});

	const iso = (y: number, m: number, d: number) =>
		`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
	function preset(kind: 'hoy' | '7' | 'mes' | 'ano') {
		const now = new Date();
		const y = now.getFullYear();
		const m = now.getMonth();
		const d = now.getDate();
		const to = iso(y, m, d);
		if (kind === 'hoy') {
			dateFrom = to;
			dateTo = to;
		} else if (kind === '7') {
			const from = new Date(y, m, d - 6);
			dateFrom = iso(from.getFullYear(), from.getMonth(), from.getDate());
			dateTo = to;
		} else if (kind === 'mes') {
			dateFrom = iso(y, m, 1);
			dateTo = to;
		} else {
			dateFrom = iso(y, 0, 1);
			dateTo = to;
		}
	}
	async function copyLink() {
		try {
			await navigator.clipboard.writeText(window.location.href);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			copied = false;
		}
	}
	// Case- and accent-insensitive, like the server-side search ('medicina' finds 'MEDICINA').
	const fold = (value: string) =>
		value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
	const careerQuery = $derived(fold(careerSearch.trim()));
	const careerMatches = (career: string) => !careerQuery || fold(career).includes(careerQuery);
	const pct = (value: number) => `${(value * 100).toFixed(1)} %`;
</script>

<h1>Reportes y estadísticas</h1>

<!-- 
  Usa una clase principal para el layout. 
  Mantenemos intacta tu lógica de SvelteKit.
-->
<div class="dashboard-layout">
	<form
		method="GET"
		action="/digaipe/estadisticas"
		data-sveltekit-reload
		onsubmit={() => (busy = true)}
		class="report-form"
	>
		<!-- SECCIÓN 1: Configuración Principal y Fechas -->
		<section class="form-card">
			<div class="card-header">
				<h2>1. Configuración Básica</h2>
			</div>
			
			<div class="input-grid">
				<div class="input-group">
					<label for="reportMode">Tipo de reporte</label>
					<select name="reportMode" id="reportMode" bind:value={reportMode}>
						<option value="general">Análisis general (datos)</option>
						<option value="consolidado">Consolidado de revisión</option>
						<option value="estadisticas">Estadísticas</option>
						<option value="reconciliacion">Reconciliación (embudo)</option>
					</select>
				</div>
				<div class="input-group">
					<label for="dateBasis">Base de fecha</label>
					<select name="dateBasis" id="dateBasis">
						<option value="asignacion" selected={(data.spec?.dateBasis ?? 'asignacion') === 'asignacion'}>Fecha de asignación origen</option>
						<option value="digaipe" selected={data.spec?.dateBasis === 'digaipe'}>Fecha válida DIGAIPE</option>
					</select>
				</div>
				<div class="input-group self-center">
				<label class="toggle-card">
					<input type="checkbox" name="includeStudentData" checked={data.spec?.includeStudentData ?? false} class="toggle-input" />
					<span class="toggle-track">
						<span class="toggle-thumb"></span>
					</span>
					<span class="toggle-text">Incluir datos del estudiante</span>
				</label>
			</div>
			</div>

			<hr class="divider" />

			<div class="input-grid dates-grid">
				<div class="input-group">
					<label>Desde <input type="date" name="dateFrom" bind:value={dateFrom} required /></label>
				</div>
				<div class="input-group">
					<label>Hasta <input type="date" name="dateTo" bind:value={dateTo} required /></label>
				</div>
				<div class="input-group quick-ranges">
					<span class="label-text">Rangos rápidos:</span>
					<div class="quick-buttons">
						<button type="button" class="btn-chip" onclick={() => preset('hoy')}>Hoy</button>
						<button type="button" class="btn-chip" onclick={() => preset('7')}>Últimos 7 días</button>
						<button type="button" class="btn-chip" onclick={() => preset('mes')}>Este mes</button>
						<button type="button" class="btn-chip" onclick={() => preset('ano')}>Este año</button>
					</div>
				</div>
			</div>
		</section>

		<!-- SECCIÓN 2: Filtros Avanzados (Ocultos por defecto para limpiar la vista) -->
		<details class="form-card accordion-card" open={data.hasAdvancedFilters}>
			<summary class="card-header accordion-summary">
				<h2>2. Filtros Avanzados (Opcional)</h2>
				<span class="accordion-icon">▼</span>
			</summary>
			
			<div class="accordion-content">
				<div class="input-group search-group">
					<label>
						Búsqueda de texto general
						<input
							type="search"
							name="search"
							maxlength="100"
							value={data.spec?.filters.search ?? ''}
							placeholder="Ej. pérez juan, V-12.345.678, medicina"
							aria-describedby="search-help"
						/>
					</label>
					<small id="search-help">
						Busca por nombre, cédula o carrera. Varias palabras deben aparecer todas, en cualquier orden.
					</small>
				</div>

				<div class="input-grid multi-select-grid">
					<div class="input-group">
						<label>Proceso</label>
						<select name="filter_process" multiple class="multi-select">
							{#each data.options.processes as value (value)}
								<option {value} selected={has(data.spec?.filters.process, value)}>{value}</option>
							{/each}
						</select>
					</div>
					<div class="input-group">
						<label>Período</label>
						<select name="filter_period" multiple class="multi-select">
							{#each data.options.periods as value (value)}
								<option {value} selected={has(data.spec?.filters.period, value)}>{value}</option>
							{/each}
						</select>
					</div>
					<div class="input-group">
						<label>Modalidad</label>
						<select name="filter_modality" multiple class="multi-select">
							{#each data.options.modalities as value (value)}
								<option {value} selected={has(data.spec?.filters.modality, value)}>{value}</option>
							{/each}
						</select>
					</div>
					<div class="input-group">
						<label>Estado</label>
						<select name="filter_status" multiple class="multi-select">
							{#each data.options.statuses as value (value)}
								<option {value} selected={has(data.spec?.filters.status, value)}>{value}</option>
							{/each}
						</select>
					</div>
					<div class="input-group">
						<label>Facultad</label>
						<select name="filter_faculty" multiple class="multi-select">
							{#each data.options.faculties as value (value)}
								<option {value} selected={has(data.spec?.filters.faculty, value)}>{value}</option>
							{/each}
						</select>
					</div>
				</div>

				<!-- Subsección: Carreras -->
				<div class="careers-section mt-3">
					<h3>Filtrar por Carreras Específicas</h3>
					<div class="input-group search-career">
						<input type="search" bind:value={careerSearch} placeholder="Escribe para buscar una carrera..." />
					</div>
					<div class="checkbox-scroll-box">
						<div class="checkbox-grid-dense">
							<!-- Non-matching careers are hidden, not removed, so earlier selections still submit. -->
							{#each data.options.careers as value (value)}
								<label class="checkbox-chip" hidden={!careerMatches(value)}>
									<input type="checkbox" name="filter_career" {value} checked={has(data.spec?.filters.career, value)} />
									<span>{value}</span>
								</label>
							{/each}
						</div>
					</div>
				</div>
			</div>
		</details>

		<!-- SECCIÓN 3: Opciones Dinámicas de Visualización -->
		{#if reportMode === 'general' || reportMode === 'estadisticas' || reportMode === 'reconciliacion'}
		<section class="form-card dynamic-options">
			<div class="card-header">
				<h2>3. Opciones de Visualización</h2>
			</div>
			
			{#if reportMode === 'general'}
				<div class="checkbox-grid-dense">
					{#each data.generalColumns as column (column.key)}
						<label class="checkbox-chip">
							<input type="checkbox" name="col" value={column.key} checked={colChecked(column.key)} />
							<span>{column.label}</span>
						</label>
					{/each}
				</div>
			{:else if reportMode === 'estadisticas'}
				<div class="checkbox-grid-dense">
					{#each data.breakdownTitles as title (title)}
						<label class="checkbox-chip">
							<input type="checkbox" name="dim" value={title} checked={dimChecked(title)} />
							<span>{title}</span>
						</label>
					{/each}
				</div>
			{:else if reportMode === 'reconciliacion'}
				<div class="input-group max-w-sm">
					<label>Dimensión de filas para Matriz cruzada</label>
					<select name="matrixDimension">
						<option value="carrera" selected={(data.spec?.matrixDimension ?? 'carrera') === 'carrera'}>Carrera</option>
						<option value="facultad" selected={data.spec?.matrixDimension === 'facultad'}>Facultad</option>
						<option value="modalidad" selected={data.spec?.matrixDimension === 'modalidad'}>Modalidad</option>
					</select>
				</div>
			{/if}
		</section>
		{/if}

		<!-- Barra de Acciones Flotante -->
		<div class="form-actions-bar">
			<button type="submit" class="btn-primary" disabled={busy}>
				{busy ? 'Generando...' : 'Generar Vista Previa'}
			</button>
			<a class="btn-secondary" href={resolve('/digaipe/estadisticas')}>Limpiar Filtros</a>
			<div class="action-divider"></div>
			<button type="submit" class="btn-outline" formaction="/digaipe/estadisticas/pdf">PDF</button>
			<button type="submit" class="btn-outline" formaction="/digaipe/estadisticas/csv">CSV</button>
			<button type="button" class="btn-outline" onclick={copyLink}>{copied ? '✓ Copiado' : 'Copiar enlace'}</button>
		</div>
	</form>

	<!-- Resultados -->
	<div class="results-area">
		{#if data.errors.length}
			<section aria-live="polite" class="report-alert alert-error">
				<div class="alert-header"><h2>No se puede generar el reporte</h2></div>
				<ul class="alert-list">
					{#each data.errors as error, i (i)}<li>{error}</li>{/each}
				</ul>
			</section>

		{:else if data.report}
			<section class="report-card">
				<div class="report-header">
					<h2 class="report-title">Resultados del Reporte</h2>
					<p class="report-filters">
						{data.spec?.dateFrom} a {data.spec?.dateTo}
						· {data.spec?.dateBasis === 'digaipe' ? 'Fecha válida DIGAIPE' : 'Fecha de asignación origen'}
						{#if data.appliedFilters}· {data.appliedFilters}{:else}· Sin filtros adicionales{/if}
					</p>
					<div class="kpi-grid">
						<div class="kpi-card">
							<span class="kpi-label">{data.spec?.reportMode === 'reconciliacion' ? 'Asignados' : 'Admisiones'}</span>
							<span class="kpi-value-estadistica">{data.report.totalAdmissions.toLocaleString()}</span>
						</div>
						<div class="kpi-card">
							<span class="kpi-label">Estudiantes únicos</span>
							<span class="kpi-value-estadistica">{data.report.totalUniqueStudents.toLocaleString()}</span>
						</div>
					</div>
				</div>

				{#if data.report.totalAdmissions > 5000}
					<div role="alert" class="report-alert alert-warning">
						<span>⚠️ Este reporte incluye <strong>{data.report.totalAdmissions.toLocaleString()}</strong> admisiones; la exportación puede tardar.</span>
					</div>
				{/if}

				{#if data.report.totalAdmissions === 0}
					<div role="status" class="report-alert alert-warning">
						<span>No hay admisiones para este rango y filtros. Revise las fechas, la base de fecha o la búsqueda.</span>
					</div>
				{/if}
				{#if data.spec?.reportMode === 'general' && data.report.totalAdmissions > data.report.rows.length}
					<div role="status" class="report-alert alert-warning">
						<span>Vista previa: se muestran las primeras {data.report.rows.length.toLocaleString()} de {data.report.totalAdmissions.toLocaleString()} admisiones. Descargue CSV o PDF para el reporte completo.</span>
					</div>
				{/if}

				<!-- TABLAS DE RESULTADOS (Tu código original aquí) -->
				<div class="tables-wrapper">
					{#if data.spec?.reportMode === 'general'}
						<div class='table_container'>
							<table>
								<caption>Datos principales de admisiones</caption>
								<thead><tr><th>#</th>{#if data.spec.includeStudentData}<th>Cédula</th><th>Estudiante</th>{/if}<th>Fecha asignación origen</th><th>Fecha válida DIGAIPE</th><th>Estado</th><th>Carrera</th><th>Proceso</th><th>Modalidad</th><th>Período</th></tr></thead>
								<tbody>{#each data.report.rows as row, index (row.admissionId)}<tr><td>{index + 1}</td>{#if data.spec.includeStudentData}<td>{row.cedula}</td><td>{row.student}</td>{/if}<td>{row.assignmentDate}</td><td>{row.processingDate ?? ''}</td><td>{row.status ?? ''}</td><td>{row.career}</td><td>{row.process}</td><td>{row.modality} - {row.modalityName}</td><td>{row.period}</td></tr>{/each}</tbody>
							</table>
						</div>
						<div class='table_container mt-3'>
							<table>
								<caption>Datos complementarios de admisiones</caption>
								<thead><tr><th>#</th><th>Tipo OCRE</th><th>Código carrera</th><th>OFAE</th><th>OCRE carrera</th><th>Facultad</th><th>Núcleo</th><th>Clave</th><th>Año</th><th>Etapa</th><th>Género</th></tr></thead>
								<tbody>{#each data.report.rows as row, index (row.admissionId)}<tr><td>{index + 1}</td><td>{row.ocreType ?? ''}</td><td>{row.careerCode ?? ''}</td><td>{row.ofae}</td><td>{row.careerOcre ?? ''}</td><td>{row.faculty}</td><td>{row.nucleus}</td><td>{row.key}</td><td>{row.year}</td><td>{row.stage}</td><td>{row.gender ?? ''}</td></tr>{/each}</tbody>
							</table>
						</div>
					{:else if data.spec?.reportMode === 'consolidado'}
						<div class='table_container'>
							<table>
								<caption>Consolidado de revisión</caption>
								<thead><tr><th>Fecha válida</th><th>Estado</th><th>Carrera</th>{#if data.spec.includeStudentData}<th>Estudiante</th>{/if}<th>Cuenta</th></tr></thead>
								<tbody>{#each data.report.pivot as date (date.date)}{#each date.statuses as status (status.label)}{#each status.careers as career (career.label)}<tr><td>{date.date}</td><td>{status.label}</td><th scope="row">{career.label}</th>{#if data.spec.includeStudentData}<td></td>{/if}<td>{career.count}</td></tr>{#if data.spec.includeStudentData}{#each career.students as student (student.label)}<tr><td></td><td></td><td></td><td>{student.label}</td><td>{student.count}</td></tr>{/each}{/if}{/each}<tr><td></td><th scope="row">Total {status.label}</th><td></td>{#if data.spec.includeStudentData}<td></td>{/if}<td>{status.count}</td></tr>{/each}<tr><th scope="row">Total fecha {date.date}</th><td></td><td></td>{#if data.spec.includeStudentData}<td></td>{/if}<td>{date.count}</td></tr>{/each}<tr><th scope="row">Total general</th><td></td><td></td>{#if data.spec.includeStudentData}<td></td>{/if}<td>{data.report.totalAdmissions}</td></tr></tbody>
							</table>
						</div>
					{:else if data.spec?.reportMode === 'reconciliacion' && data.report.reconciliation}
						{@const r = data.report.reconciliation}
						<div class="grid-2-col mt-3">
							<div class='table_container'>
								<table>
									<caption>Etapas del embudo de admisión</caption>
									<thead><tr><th>Etapa</th><th>Cantidad</th></tr></thead>
									<tbody>
										<tr><th scope="row">Asignados</th><td>{r.asignados}</td></tr>
										<tr><th scope="row">No procesados</th><td>{r.noProcesados}</td></tr>
										<tr><th scope="row">Procesados</th><td>{r.procesados}</td></tr>
										<tr><th scope="row">Pendiente</th><td>{r.byStatus.pendiente}</td></tr>
										<tr><th scope="row">Matriculado</th><td>{r.byStatus.matriculado}</td></tr>
										<tr><th scope="row">Devuelto</th><td>{r.byStatus.devuelto}</td></tr>
									</tbody>
								</table>
							</div>
							<div class='table_container'>
								<table>
									<caption>Devoluciones</caption>
									<thead><tr><th>Concepto</th><th>Cantidad</th></tr></thead>
									<tbody>
										<tr><th scope="row">Devueltas (histórico)</th><td>{r.devoluciones.everDevueltas}</td></tr>
										<tr><th scope="row">Sin retornar</th><td>{r.devoluciones.sinRetornar}</td></tr>
										<tr><th scope="row">Reingresadas</th><td>{r.devoluciones.reingresadas}</td></tr>
										<tr><th scope="row">Reingresadas matriculadas</th><td>{r.devoluciones.reingresadasMatriculadas}</td></tr>
										<tr><th scope="row">Reingresadas pendientes</th><td>{r.devoluciones.reingresadasPendientes}</td></tr>
										<tr><th scope="row">Tasa de retorno</th><td>{pct(r.devoluciones.tasaRetorno)}</td></tr>
									</tbody>
								</table>
							</div>
							<div class='table_container'>
								<table>
									<caption>Tasas</caption>
									<thead><tr><th>Indicador</th><th>Valor</th></tr></thead>
									<tbody>
										{#if data.spec.dateBasis !== 'digaipe'}
											<tr><th scope="row">Matriculados / asignados</th><td>{pct(r.rates.matriculadosSobreAsignados)}</td></tr>
											<tr><th scope="row">No presentación</th><td>{pct(r.rates.noPresentacion)}</td></tr>
										{/if}
										<tr><th scope="row">Matriculados / procesados</th><td>{pct(r.rates.matriculadosSobreProcesados)}</td></tr>
									</tbody>
								</table>
							</div>
							<div class='table_container'>
								<table>
									<caption>Antigüedad (días)</caption>
									<thead><tr><th>Rango</th><th>Pendientes en revisión</th>{#if data.spec.dateBasis !== 'digaipe'}<th>No procesados</th>{/if}</tr></thead>
									<tbody>
										{#each r.agingPendientes as bucket, i (bucket.label)}
											<tr><th scope="row">{bucket.label}</th><td>{bucket.count}</td>{#if data.spec.dateBasis !== 'digaipe'}<td>{r.agingNoProcesados[i]?.count ?? 0}</td>{/if}</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
						<div class='table_container mt-3'>
							<table>
								<caption>Matriz por {r.matrix.dimensionLabel.toLowerCase()}</caption>
								<thead><tr><th>{r.matrix.dimensionLabel}</th><th>No procesado</th><th>Pendiente</th><th>Matriculado</th><th>Devuelto</th><th>Total</th><th>% matric.</th></tr></thead>
								<tbody>
									{#each r.matrix.rows as row (row.label)}
										<tr><th scope="row">{row.label}</th><td>{row.noProcesado}</td><td>{row.pendiente}</td><td>{row.matriculado}</td><td>{row.devuelto}</td><td>{row.total}</td><td>{pct(row.pctMatric)}</td></tr>
									{/each}
									<tr><th scope="row">Total</th><td>{r.matrix.totals.noProcesado}</td><td>{r.matrix.totals.pendiente}</td><td>{r.matrix.totals.matriculado}</td><td>{r.matrix.totals.devuelto}</td><td>{r.matrix.totals.total}</td><td>{pct(r.matrix.totals.pctMatric)}</td></tr>
								</tbody>
							</table>
						</div>
						{#if r.overduePendientes.length}
							<div class='table_container mt-3'>
								<table>
									<caption>Pendientes con más de 15 días en revisión</caption>
									<thead><tr><th>Cédula</th><th>Estudiante</th><th>Carrera</th><th>Días</th></tr></thead>
									<tbody>
										{#each r.overduePendientes as p (p.cedula + p.career)}
											<tr><td>{p.cedula}</td><td>{p.student}</td><td>{p.career}</td><td>{p.days}</td></tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					{:else if data.spec?.reportMode === 'estadisticas'}
						<div class='table_container'>
							<table>
								<caption>Indicadores principales</caption>
								<thead><tr><th>Indicador</th><th>Cuenta</th></tr></thead>
								<tbody>
									<tr><th scope="row">Admisiones procesadas</th><td>{data.report.totalAdmissions}</td></tr>
									<tr><th scope="row">Estudiantes únicos</th><td>{data.report.totalUniqueStudents}</td></tr>
									{#each data.report.statusCounts as row (row.label)}<tr><th scope="row">{row.label}</th><td>{row.count}</td></tr>{/each}
								</tbody>
							</table>
						</div>
						<div class="grid-2-col mt-3">
							{#each Object.entries(data.report.breakdowns) as [title, rows] (title)}
								<div class='table_container'>
									<table>
										<caption>{title}</caption>
										<thead><tr><th>Etiqueta</th><th>Admisiones</th><th>Est. únicos</th></tr></thead>
										<tbody>{#each rows as row (row.label)}<tr><td>{row.label}</td><td>{row.count}</td><td>{row.students}</td></tr>{/each}</tbody>
									</table>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</section>
		{/if}
	</div>
</div>


<style>

/* Layout principal */
.dashboard-layout {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    max-width: 1400px;
    margin: 0 auto;
    padding-bottom: var(--spacing-xxl);
}


/* Tarjetas de formulario */
.form-card {
    background: var(--color-bg-alt);
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: var(--spacing-lg);
    margin-bottom: var(--spacing-md);
}

.card-header h2 {
    font-size: var(--font-size-h5);
    color: var(--ula-blue);
    margin: 0 0 var(--spacing-md) 0;
    border-bottom: 2px solid var(--blue-second);
    padding-bottom: var(--spacing-sm);
    display: inline-block;
}

/* Sistema de Grid para inputs */
.input-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--spacing-md);
}

.dates-grid {
    grid-template-columns: 1fr 1fr 2fr;
}

.multi-select-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.grid-2-col {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: var(--spacing-lg);
}

/* Grupos de Inputs */
.input-group {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
}

.input-group label, .label-text {
    font-size: var(--font-size-small);
    font-weight: 600;
    color: var(--color-text-muted);
}

.input-group input, 
.input-group select {
    padding: var(--spacing-sm);
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: var(--font-size-base);
    background-color: var(--color-bg-main);
}

.input-group input:focus, 
.input-group select:focus {
    outline: none;
    border-color: var(--ula-blue);
    box-shadow: 0 0 0 2px rgba(0, 51, 160, 0.2);
}

select.multi-select {
    height: 120px;
}

/* Utilidades */
.self-center { justify-content: center; }
.mt-3 { margin-top: var(--spacing-lg); }
.max-w-sm { max-width: 300px; }
.divider { border: none; border-top: 1px dashed #cbd5e1; margin: var(--spacing-lg) 0; }

/* Acordeón para Filtros Avanzados */
.accordion-card {
    cursor: pointer;
    transition: all 0.3s ease;
}
.accordion-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    list-style: none; /* Quitar flecha nativa */
}
.accordion-summary::-webkit-details-marker { display: none; }
.accordion-content {
    margin-top: var(--spacing-md);
    cursor: default;
}
details[open] .accordion-icon {
    transform: rotate(180deg);
}

/* Botones y Rangos Rápidos */
.quick-ranges {
    justify-content: flex-end;
}
.quick-buttons {
    display: flex;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
}
.btn-chip {
    padding: 6px 12px;
    background: #e2e8f0;
    border: 1px solid #cbd5e1;
    border-radius: 16px;
    cursor: pointer;
    font-size: var(--font-size-small);
    transition: background 0.2s;
}
.btn-chip:hover { background: var(--blue-second); color: var(--ula-dark); }

/* Checkboxes y Scrollers */
.checkbox-grid-dense {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--spacing-sm);
}
.checkbox-chip {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--color-bg-main);
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    font-size: var(--font-size-small);
    cursor: pointer;
}
.checkbox-chip:hover { border-color: var(--blue-ford); }
.checkbox-scroll-box {
    max-height: 250px;
    overflow-y: auto;
    padding: var(--spacing-sm);
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    margin-top: var(--spacing-sm);
}

/* Barra de Acciones Fija/Sticky */
.form-actions-bar {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--color-bg-main);
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    position: sticky;
    bottom: var(--spacing-md);
    z-index: 10;
    flex-wrap: wrap;
}
.action-divider {
    height: 32px;
    width: 1px;
    background: #cbd5e1;
    margin: 0 var(--spacing-sm);
}

/* Estilos de Botones Globales */
button, .btn-primary, .btn-secondary, .btn-outline {
    padding: 10px 20px;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
    text-decoration: none;
    font-size: var(--font-size-small);
    transition: all 0.2s;
    border: none;
}
.btn-primary { background: var(--ula-blue); color: white; }
.btn-primary:hover { background: var(--ula-dark); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { background: #e2e8f0; color: var(--color-text-main); }
.btn-secondary:hover { background: #cbd5e1; }
.btn-outline { background: transparent; border: 1px solid var(--ula-blue); color: var(--ula-blue); }
.btn-outline:hover { background: var(--blue-second); color: var(--ula-dark); }

/* Resultados y KPIs */
.report-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
}
.kpi-grid { display: flex; gap: var(--spacing-lg); }
.kpi-card {
    background: var(--ula-blue);
    color: white;
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 4px 6px rgba(0,51,160,0.2);
}
.kpi-label { font-size: var(--font-size-small); opacity: 0.9; }
.kpi-value { font-size: var(--font-size-h3); font-weight: bold; }

/* Tablas */
.table_container {
    overflow-x: auto;
    background: var(--color-bg-main);
    border-radius: 8px;
    border: 1px solid #e2e8f0;
}
table { width: 100%; border-collapse: collapse; text-align: left; }
caption { text-align: left; font-weight: bold; padding: var(--spacing-md); color: var(--ula-dark); font-size: var(--font-size-h6); background: var(--color-bg-alt); }
th, td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
th { background: #f8fafc; color: var(--color-text-muted); font-size: var(--font-size-small); }
tr:hover { background-color: var(--color-bg-alt); }

/* Alertas */
.report-alert { padding: var(--spacing-md); border-radius: 6px; margin-bottom: var(--spacing-md); }
.alert-error { background: #fef2f2; color: #991b1b; border: 1px solid #f87171; }
.alert-warning { background: #fffbeb; color: #92400e; border: 1px solid #fbbf24; }



/* Toggle card — "Incluir datos del estudiante" */
.toggle-card {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 10px 18px;
    background: var(--color-bg-main);
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    user-select: none;
}
.toggle-card:hover {
    border-color: var(--ula-blue);
    background: var(--color-bg-alt);
}
.toggle-input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
}
.toggle-track {
    position: relative;
    width: 48px;
    height: 26px;
    background: #cbd5e1;
    border-radius: 13px;
    transition: background 0.25s;
    flex-shrink: 0;
}
.toggle-card:has(.toggle-input:checked) .toggle-track {
    background: var(--ula-blue);
}
.toggle-thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0,0,0,0.25);
    transition: transform 0.25s;
}
.toggle-card:has(.toggle-input:checked) .toggle-thumb {
    transform: translateX(22px);
}
.toggle-text {
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--color-text-main);
}
</style>