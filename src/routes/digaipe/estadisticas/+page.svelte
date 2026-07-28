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
	<fieldset>
		<legend>Reporte y fechas</legend>
		<p>
			<label
				>Tipo de reporte
				<select name="reportMode" bind:value={reportMode}>
					<option value="general">Análisis general (datos)</option>
					<option value="consolidado">Consolidado de revisión</option>
					<option value="estadisticas">Estadísticas</option>
					<option value="reconciliacion">Reconciliación (embudo)</option>
				</select>
			</label>
		</p>
		<p>
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
		</p>
		<p>
			<label>Desde <input type="date" name="dateFrom" bind:value={dateFrom} required /></label>
			<label>Hasta <input type="date" name="dateTo" bind:value={dateTo} required /></label>
		</p>
		<p>
			<span>Rangos rápidos:</span>
			<button type="button" onclick={() => preset('hoy')}>Hoy</button>
			<button type="button" onclick={() => preset('7')}>Últimos 7 días</button>
			<button type="button" onclick={() => preset('mes')}>Este mes</button>
			<button type="button" onclick={() => preset('ano')}>Este año</button>
		</p>
		<p>
			<label>
				<input
					type="checkbox"
					name="includeStudentData"
					checked={data.spec?.includeStudentData ?? false}
				/> Incluir cédula y nombre del estudiante
			</label>
		</p>
	</fieldset>

	<fieldset>
		<legend>Filtros (selección múltiple)</legend>
		<p>
			<label
				>Proceso
				<select name="filter_process" multiple>
					{#each data.options.processes as value (value)}<option
							{value}
							selected={has(data.spec?.filters.process, value)}>{value}</option
						>{/each}
				</select>
			</label>
		</p>
		<p>
			<label
				>Período
				<select name="filter_period" multiple>
					{#each data.options.periods as value (value)}<option
							{value}
							selected={has(data.spec?.filters.period, value)}>{value}</option
						>{/each}
				</select>
			</label>
		</p>
		<p>
			<label
				>Modalidad
				<select name="filter_modality" multiple>
					{#each data.options.modalities as value (value)}<option
							{value}
							selected={has(data.spec?.filters.modality, value)}>{value}</option
						>{/each}
				</select>
			</label>
		</p>
		<p>
			<label
				>Estado
				<select name="filter_status" multiple>
					{#each data.options.statuses as value (value)}<option
							{value}
							selected={has(data.spec?.filters.status, value)}>{value}</option
						>{/each}
				</select>
			</label>
		</p>
		<p>
			<label
				>Facultad
				<select name="filter_faculty" multiple>
					{#each data.options.faculties as value (value)}<option
							{value}
							selected={has(data.spec?.filters.faculty, value)}>{value}</option
						>{/each}
				</select>
			</label>
		</p>
		<fieldset>
			<legend>Carrera</legend>
			<p>
				<label>Buscar carrera <input type="search" bind:value={careerSearch} /></label>
			</p>
			<ul>
				{#each filteredCareers as value (value)}
					<li>
						<label
							><input
								type="checkbox"
								name="filter_career"
								{value}
								checked={has(data.spec?.filters.career, value)}
							/>
							{value}</label
						>
					</li>
				{/each}
			</ul>
		</fieldset>
		<p><label>Buscar <input name="search" value={data.spec?.filters.search ?? ''} /></label></p>
	</fieldset>

	{#if reportMode === 'general'}
		<fieldset>
			<legend>Columnas a incluir</legend>
			<ul>
				{#each data.generalColumns as column (column.key)}
					<li>
						<label
							><input
								type="checkbox"
								name="col"
								value={column.key}
								checked={colChecked(column.key)}
							/>
							{column.label}</label
						>
					</li>
				{/each}
			</ul>
		</fieldset>
	{:else if reportMode === 'estadisticas'}
		<fieldset>
			<legend>Desgloses a incluir</legend>
			<ul>
				{#each data.breakdownTitles as title (title)}
					<li>
						<label
							><input type="checkbox" name="dim" value={title} checked={dimChecked(title)} />
							{title}</label
						>
					</li>
				{/each}
			</ul>
		</fieldset>
	{:else if reportMode === 'reconciliacion'}
		<fieldset>
			<legend>Matriz cruzada</legend>
			<p>
				<label
					>Dimensión de filas
					<select name="matrixDimension">
						<option
							value="carrera"
							selected={(data.spec?.matrixDimension ?? 'carrera') === 'carrera'}>Carrera</option
						>
						<option value="facultad" selected={data.spec?.matrixDimension === 'facultad'}
							>Facultad</option
						>
						<option value="modalidad" selected={data.spec?.matrixDimension === 'modalidad'}
							>Modalidad</option
						>
					</select>
				</label>
			</p>
		</fieldset>
	{/if}

	<p>
		<button type="submit" disabled={busy}>Vista previa</button>
		<button type="submit" formaction="/digaipe/estadisticas/pdf">Descargar PDF</button>
		<button type="submit" formaction="/digaipe/estadisticas/csv">Descargar CSV</button>
		<button type="button" onclick={copyLink}>{copied ? 'Enlace copiado' : 'Copiar enlace'}</button>
		<a href={resolve('/digaipe/estadisticas')}>Limpiar</a>
	</p>
</form>

{#if data.errors.length}
	<section aria-live="polite">
		<h2>No se puede generar el reporte</h2>
		<ul>
			{#each data.errors as error, i (i)}<li>{error}</li>{/each}
		</ul>
	</section>
{:else if data.report}
	<section>
		<h2>Resultado</h2>
		<p>
			{data.spec?.reportMode === 'reconciliacion' ? 'Total de asignados' : 'Total de admisiones'}:
			{data.report.totalAdmissions}
		</p>
		<p>Total de estudiantes únicos: {data.report.totalUniqueStudents}</p>
		{#if data.report.totalAdmissions > 5000}
			<p role="alert">
				Este reporte incluye {data.report.totalAdmissions} admisiones; la exportación puede tardar y generar
				un archivo grande.
			</p>
		{/if}
		<!-- Query-carrying download links: resolve() takes no query string, so the rule is scoped off. -->
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<p>
			<a href={`${resolve('/digaipe/estadisticas/csv')}?${data.exportQuery}`}>Exportar CSV</a>
			<a href={`${resolve('/digaipe/estadisticas/pdf')}?${data.exportQuery}`}>Exportar PDF</a>
		</p>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</section>

	{#if data.spec?.reportMode === 'general'}
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
	{:else if data.spec?.reportMode === 'consolidado'}
		<section>
			<h2>Consolidado de revisión</h2>
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
		</section>
	{:else if data.spec?.reportMode === 'reconciliacion' && data.report.reconciliation}
		{@const r = data.report.reconciliation}
		<section>
			<h2>Reconciliación — embudo</h2>
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
			<table>
				<caption>Devoluciones</caption>
				<thead><tr><th>Concepto</th><th>Cantidad</th></tr></thead>
				<tbody>
					<tr><th scope="row">Devueltas (histórico)</th><td>{r.devoluciones.everDevueltas}</td></tr>
					<tr><th scope="row">Sin retornar</th><td>{r.devoluciones.sinRetornar}</td></tr>
					<tr><th scope="row">Reingresadas</th><td>{r.devoluciones.reingresadas}</td></tr>
				</tbody>
			</table>
		</section>
	{:else if data.spec?.reportMode === 'estadisticas'}
		<section>
			<h2>Estadísticas</h2>
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
			{#each Object.entries(data.report.breakdowns) as [title, rows] (title)}<table>
					<caption>{title}</caption>
					<thead><tr><th>Etiqueta</th><th>Admisiones</th><th>Estudiantes únicos</th></tr></thead>
					<tbody
						>{#each rows as row (row.label)}<tr
								><td>{row.label}</td><td>{row.count}</td><td>{row.students}</td></tr
							>{/each}</tbody
					>
				</table>{/each}
		</section>
	{/if}
{/if}
