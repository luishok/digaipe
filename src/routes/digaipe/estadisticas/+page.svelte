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
	const filteredCareers = $derived(
		careerSearch
			? data.options.careers.filter((c) => c.toLowerCase().includes(careerSearch.toLowerCase()))
			: data.options.careers
	);
</script>

<h1>Reportes y estadísticas de admisiones</h1>

<!-- Reports are server-rendered, so preview always reloads with the newly submitted query. -->
<form
	method="GET"
	action="/digaipe/estadisticas"
	data-sveltekit-reload
	onsubmit={() => (busy = true)}
>
	<fieldset class='filter-card'>
		<legend>Reporte y fechas</legend>
		<div class='filter-row-flex'>
			<div class='label-input'>
				<label
					>Tipo de reporte
					<select name="reportMode" bind:value={reportMode}>
						<option value="general">Análisis general (datos)</option>
						<option value="consolidado">Consolidado de revisión</option>
						<option value="estadisticas">Estadísticas</option>
						<option value="reconciliacion">Reconciliación (embudo)</option>
					</select>
				</label>
			</div>
			<div class='label-input'>
				<label
					>Base de fecha
					<select name="dateBasis">
						<option
							value="asignacion"
							selected={(data.spec?.dateBasis ?? 'asignacion') === 'asignacion'}
							>Fecha de asignación origen</option
						>
						<option value="digaipe" selected={data.spec?.dateBasis === 'digaipe'}
							>Fecha válida DIGAIPE</option
						>
					</select>
				</label>
			</div>
		</div>
		<div class='filter-row-flex'>
			<div class='label-input'>
				<label>Desde <input type="date" name="dateFrom" bind:value={dateFrom} required /></label>
			</div>
			<div class='label-input'>
				<label>Hasta <input type="date" name="dateTo" bind:value={dateTo} required /></label>
			</div>
			<!-- Cambiar esta sección dentro del filter-row-flex de fechas: -->
			<div class='quick-range-wrapper'>
				<p class='label-rangos'>Rangos rápidos</p>
				<div class="quick-buttons">
					<button type="button" onclick={() => preset('hoy')}>Hoy</button>
					<button type="button" onclick={() => preset('7')}>Últimos 7 días</button>
					<button type="button" onclick={() => preset('mes')}>Este mes</button>
					<button type="button" onclick={() => preset('ano')}>Este año</button>
				</div>
			</div>
		</div>
		<div class='filter-row-checkbox'>
			<label class='checkbox-label'>
				<input
					type="checkbox"
					name="includeStudentData"
					checked={data.spec?.includeStudentData ?? false}
				/> Incluir cédula y nombre del estudiante
			</label>
		</div>
	</fieldset>

	<!-- Filtros Múltiples Principal -->
<fieldset class="filter-card">
    <legend>Filtros (selección múltiple)</legend>

    <!-- Fila 1: Selects Múltiples en Grid -->
    <div class="filter-row-flex">
        <div class="label-input">
            <label>
                Proceso
                <select name="filter_process" multiple class="multi-select">
                    {#each data.options.processes as value (value)}
                        <option {value} selected={has(data.spec?.filters.process, value)}>{value}</option>
                    {/each}
                </select>
            </label>
        </div>

        <div class="label-input">
            <label>
                Período
                <select name="filter_period" multiple class="multi-select">
                    {#each data.options.periods as value (value)}
                        <option {value} selected={has(data.spec?.filters.period, value)}>{value}</option>
                    {/each}
                </select>
            </label>
        </div>

        <div class="label-input">
            <label>
                Modalidad
                <select name="filter_modality" multiple class="multi-select">
                    {#each data.options.modalities as value (value)}
                        <option {value} selected={has(data.spec?.filters.modality, value)}>{value}</option>
                    {/each}
                </select>
            </label>
        </div>

        <div class="label-input">
            <label>
                Estado
                <select name="filter_status" multiple class="multi-select">
                    {#each data.options.statuses as value (value)}
                        <option {value} selected={has(data.spec?.filters.status, value)}>{value}</option>
                    {/each}
                </select>
            </label>
        </div>

        <div class="label-input">
            <label>
                Facultad
                <select name="filter_faculty" multiple class="multi-select">
                    {#each data.options.faculties as value (value)}
                        <option {value} selected={has(data.spec?.filters.faculty, value)}>{value}</option>
                    {/each}
                </select>
            </label>
        </div>
    </div>

    <!-- Búsqueda General de Texto -->
    <div class="filter-row-flex">
        <div class="label-input full-width text-search">
            <label>
                Buscar
                <input name="search" value={data.spec?.filters.search ?? ''} placeholder="Búsqueda por texto..." />
            </label>
        </div>
    </div>

    <!-- Sub-fieldset: Selección de Carrera con buscador -->
    <fieldset class="sub-fieldset">
        <legend>Carreras</legend>
        <div class="label-input mb-3">
            <label>
                Buscar carrera
                <input type="search" bind:value={careerSearch} placeholder="Filtrar carreras..." />
            </label>
        </div>

        <div class="checkbox-scroll-box">
            <div class="checkbox-grid">
                {#each filteredCareers as value (value)}
                    <label class="checkbox-chip">
                        <input
                            type="checkbox"
                            name="filter_career"
                            {value}
                            checked={has(data.spec?.filters.career, value)}
                        />
                        <span>{value}</span>
                    </label>
                {/each}
            </div>
        </div>
    </fieldset>
</fieldset>

<!-- Opciones dinámicas según el tipo de reporte -->
{#if reportMode === 'general'}
    <fieldset class="filter-card mt-4">
        <legend>Columnas a incluir</legend>
        <div class="checkbox-grid">
            {#each data.generalColumns as column (column.key)}
                <label class="checkbox-chip">
                    <input
                        type="checkbox"
                        name="col"
                        value={column.key}
                        checked={colChecked(column.key)}
                    />
                    <span>{column.label}</span>
                </label>
            {/each}
        </div>
    </fieldset>

{:else if reportMode === 'estadisticas'}
    <fieldset class="filter-card mt-4">
        <legend>Desgloses a incluir</legend>
        <div class="checkbox-grid">
            {#each data.breakdownTitles as title (title)}
                <label class="checkbox-chip">
                    <input type="checkbox" name="dim" value={title} checked={dimChecked(title)} />
                    <span>{title}</span>
                </label>
            {/each}
        </div>
    </fieldset>

{:else if reportMode === 'reconciliacion'}
    <fieldset class="filter-card mt-4">
        <legend>Matriz cruzada</legend>
        <div class="filter-row-flex">
            <div class="label-input">
                <label>
                    Dimensión de filas
                    <select name="matrixDimension">
                        <option value="carrera" selected={(data.spec?.matrixDimension ?? 'carrera') === 'carrera'}>Carrera</option>
                        <option value="facultad" selected={data.spec?.matrixDimension === 'facultad'}>Facultad</option>
                        <option value="modalidad" selected={data.spec?.matrixDimension === 'modalidad'}>Modalidad</option>
                    </select>
                </label>
            </div>
        </div>
    </fieldset>
{/if}



	<div class="filter-actions">
		<button type="submit" disabled={busy}>Vista previa</button>
		<button type="submit" formaction="/digaipe/estadisticas/pdf">Descargar PDF</button>
		<button type="submit" formaction="/digaipe/estadisticas/csv">Descargar CSV</button>
		<button type="button" onclick={copyLink}>{copied ? 'Enlace copiado' : 'Copiar enlace'}</button>
		<a href={resolve('/digaipe/estadisticas')}>Limpiar</a>
	</div>
</form>

{#if data.errors.length}
    <!-- Alerta de Errores -->
    <section aria-live="polite" class="report-alert alert-error">
        <div class="alert-header">
            <svg class="alert-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
            </svg>
            <h2>No se puede generar el reporte</h2>
        </div>
        <ul class="alert-list">
            {#each data.errors as error, i (i)}
                <li>{error}</li>
            {/each}
        </ul>
    </section>

{:else if data.report}
    <!-- Tarjeta de Resultados -->
    <section class="report-card">
        <h2 class="report-title">Resultado</h2>

        <!-- Grilla de Métricas / KPIs -->
        <div class="kpi-grid">
            <div class="kpi-card">
                <span class="kpi-label">
                    {data.spec?.reportMode === 'reconciliacion' ? 'Total de asignados' : 'Total de admisiones'}
                </span>
                <span class="kpi-value">{data.report.totalAdmissions.toLocaleString()}</span>
            </div>

            <div class="kpi-card">
                <span class="kpi-label">Total de estudiantes únicos</span>
                <span class="kpi-value">{data.report.totalUniqueStudents.toLocaleString()}</span>
            </div>
        </div>

        <!-- Advertencia de volumen de datos altos -->
        {#if data.report.totalAdmissions > 5000}
            <div role="alert" class="report-alert alert-warning">
                <svg class="alert-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                </svg>
                <span>
                    Este reporte incluye <strong>{data.report.totalAdmissions.toLocaleString()}</strong> admisiones; 
                    la exportación puede tardar y generar un archivo grande.
                </span>
            </div>
        {/if}

        <!-- Botones de Exportación -->
        <!-- eslint-disable svelte/no-navigation-without-resolve -->
        <div class="export-actions">
            <a href={`${resolve('/digaipe/estadisticas/csv')}?${data.exportQuery}`} class="btn-export btn-csv">
                📊 Exportar CSV
            </a>
            <a href={`${resolve('/digaipe/estadisticas/pdf')}?${data.exportQuery}`} class="btn-export btn-pdf">
                📄 Exportar PDF
            </a>
        </div>
        <!-- eslint-enable svelte/no-navigation-without-resolve -->
    </section>


	{#if data.spec?.reportMode === 'general'}
	<div class='table_container'>
		<table>
			<caption>Datos principales de admisiones</caption>
			<thead
				><tr
					><th>#</th>{#if data.spec.includeStudentData}<th>Cédula</th><th>Estudiante</th>{/if}<th
						>Fecha asignación origen</th
					><th>Fecha válida DIGAIPE</th><th>Estado</th><th>Carrera</th><th>Proceso</th><th
						>Modalidad</th
					><th>Período</th></tr
				></thead
			>
			<tbody
				>{#each data.report.rows as row, index (row.admissionId)}<tr
						><td>{index + 1}</td>{#if data.spec.includeStudentData}<td>{row.cedula}</td><td
								>{row.student}</td
							>{/if}<td>{row.assignmentDate}</td><td>{row.processingDate ?? ''}</td><td
							>{row.status ?? ''}</td
						><td>{row.career}</td><td>{row.process}</td><td>{row.modality} - {row.modalityName}</td
						><td>{row.period}</td></tr
					>{/each}</tbody
			>
		</table>
		</div>
		<div class='table_container'>
		<table>
			<caption>Datos complementarios de admisiones</caption>
			<thead
				><tr
					><th>#</th><th>Tipo OCRE</th><th>Código carrera</th><th>OFAE</th><th>OCRE carrera</th><th
						>Facultad</th
					><th>Núcleo</th><th>Clave</th><th>Año</th><th>Etapa</th><th>Género</th></tr
				></thead
			>
			<tbody
				>{#each data.report.rows as row, index (row.admissionId)}<tr
						><td>{index + 1}</td><td>{row.ocreType ?? ''}</td><td>{row.careerCode ?? ''}</td><td
							>{row.ofae}</td
						><td>{row.careerOcre ?? ''}</td><td>{row.faculty}</td><td>{row.nucleus}</td><td
							>{row.key}</td
						><td>{row.year}</td><td>{row.stage}</td><td>{row.gender ?? ''}</td></tr
					>{/each}</tbody
			>
		</table>
	</div>
	{:else if data.spec?.reportMode === 'consolidado'}
		<section>
			<h2>Consolidado de revisión</h2>
			<div class='table_container'>
				<table>
					<caption>Fecha válida, estado, carrera y estudiante</caption>
					<thead
						><tr
							><th>Fecha válida</th><th>Estado</th><th>Carrera</th
							>{#if data.spec.includeStudentData}<th>Estudiante</th>{/if}<th>Cuenta</th></tr
						></thead
					>
					<tbody
						>{#each data.report.pivot as date (date.date)}{#each date.statuses as status (status.label)}{#each status.careers as career (career.label)}<tr
										><td>{date.date}</td><td>{status.label}</td><th scope="row">{career.label}</th
										>{#if data.spec.includeStudentData}<td></td>{/if}<td>{career.count}</td></tr
									>{#if data.spec.includeStudentData}{#each career.students as student (student.label)}<tr
												><td></td><td></td><td></td><td>{student.label}</td><td>{student.count}</td
												></tr
											>{/each}{/if}{/each}<tr
									><td></td><th scope="row">Total {status.label}</th><td
									></td>{#if data.spec.includeStudentData}<td></td>{/if}<td>{status.count}</td></tr
								>{/each}<tr
								><th scope="row">Total fecha {date.date}</th><td></td><td
								></td>{#if data.spec.includeStudentData}<td></td>{/if}<td>{date.count}</td></tr
							>{/each}<tr
							><th scope="row">Total general</th><td></td><td
							></td>{#if data.spec.includeStudentData}<td></td>{/if}<td
								>{data.report.totalAdmissions}</td
							></tr
						></tbody
					>
				</table>
		</div>
		</section>
	{:else if data.spec?.reportMode === 'reconciliacion' && data.report.reconciliation}
		{@const r = data.report.reconciliation}
		<section>
			<h2>Reconciliación — embudo</h2>
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
				</tbody>
			</table>
			</div>
		</section>
	{:else if data.spec?.reportMode === 'estadisticas'}
		<section>
			<h2>Estadísticas</h2>
			<div class='table_container'>
				<table>
					<caption>Indicadores principales</caption>
					<thead><tr><th>Indicador</th><th>Cuenta</th></tr></thead>
					<tbody
						><tr><th scope="row">Admisiones procesadas</th><td>{data.report.totalAdmissions}</td></tr
						><tr><th scope="row">Estudiantes únicos</th><td>{data.report.totalUniqueStudents}</td></tr
						>{#each data.report.breakdowns['Estado'] ?? [] as row (row.label)}<tr
								><th scope="row">{row.label}</th><td>{row.count}</td></tr
							>{/each}</tbody
					>
				</table>
			</div>
			{#each Object.entries(data.report.breakdowns) as [title, rows] (title)}
			<div class='table_container'>
			<table>
					<caption>{title}</caption>
					<thead><tr><th>Etiqueta</th><th>Admisiones</th><th>Estudiantes únicos</th></tr></thead>
					<tbody
						>{#each rows as row (row.label)}<tr
								><td>{row.label}</td><td>{row.count}</td><td>{row.students}</td></tr
							>{/each}</tbody
					>
				</table></div>{/each}
		</section>
	{/if}
{/if}
