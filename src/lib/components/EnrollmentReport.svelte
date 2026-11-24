<script lang="ts">
	import { enrollmentLabels, type EnrollmentReport } from '$lib/admission-outcomes';
	let {
		report,
		includeStudents = false,
		limit = 500
	}: {
		report: EnrollmentReport;
		includeStudents?: boolean;
		limit?: number;
	} = $props();
</script>

<p>
	Una asignación por estudiante, carrera y proceso. Las modalidades alternativas se cuentan como
	ofertas.
</p>
{#if report.totals.pendiente > 0}
	<p role="status">
		Resultado provisional: hay procesos abiertos. Los pendientes aún pueden matricularse.
	</p>
{/if}
<div class="table_container">
	<table>
		<caption>Resultado de matrícula por carrera y proceso</caption>
		<thead
			><tr
				><th>Proceso</th><th>Facultad</th><th>Carrera</th><th>Asignados</th><th>Ofertas</th><th
					>Matriculados</th
				><th>No matriculados</th><th>Pendientes</th></tr
			></thead
		>
		<tbody>
			{#each report.byCareer as row, i (i)}
				<tr
					><td>{row.process}</td><td>{row.faculty}</td><th scope="row">{row.career}</th><td
						>{row.assigned}</td
					><td>{row.offers}</td><td>{row.matriculado}</td><td>{row.no_matriculado}</td><td
						>{row.pendiente}</td
					></tr
				>
			{/each}
			<tr
				><th scope="row" colspan="3">Total</th><td>{report.totals.assigned}</td><td
					>{report.totals.offers}</td
				><td>{report.totals.matriculado}</td><td>{report.totals.no_matriculado}</td><td
					>{report.totals.pendiente}</td
				></tr
			>
		</tbody>
	</table>
</div>
<p>
	Las asignaciones sin matrícula no equivalen a cupos disponibles: estos requieren el cupo
	autorizado.
</p>
{#if includeStudents}
	{#if report.totals.assigned > limit}<p>
			Vista previa: {limit} de {report.totals.assigned} asignaciones. Exporte CSV o PDF para ver el listado
			completo.
		</p>{/if}
	<div class="table_container">
		<table>
			<caption>Detalle de asignaciones y resultado</caption>
			<thead
				><tr
					><th>Proceso</th><th>Cédula</th><th>Estudiante</th><th>Carrera</th><th
						>Modalidades ofrecidas</th
					><th>Modalidad matriculada</th><th>Resultado</th><th>Motivo</th></tr
				></thead
			>
			<tbody
				>{#each report.rows.slice(0, limit) as row (row.admissionId)}
					<tr
						><td>{row.process}</td><td>{row.cedula}</td><td>{row.student}</td><td>{row.career}</td
						><td>{row.modalities.join(', ')}</td><td
							>{row.outcome === 'matriculado' ? `${row.modality} - ${row.modalityName}` : '—'}</td
						><td>{enrollmentLabels[row.outcome]}</td><td>{row.reason}</td></tr
					>
				{/each}</tbody
			>
		</table>
	</div>
{/if}
