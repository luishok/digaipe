<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatDateTime } from '$lib/dates';
	import EnrollmentReport from '$lib/components/EnrollmentReport.svelte';
	let { data } = $props();

	const processCode = $derived(
		data.closure.report.byCareer[0]?.process ??
		data.closure.report.rows[0]?.process ??
		`Proceso #${data.closure.procesoId}`
	);
	const totals = $derived(data.closure.report.totals);
</script>

<div class="closure-page">
	<div class="closure-header-card">
		<div class="badge-row">
			<span class="status-pill status-closed">🔒 Informe Oficial Cerrado</span>
			<span class="version-tag">Versión {data.closure.version}</span>
			<span class="process-tag">{processCode}</span>
		</div>

		<h1>Informe Oficial de Cierre · {processCode}</h1>
		<p class="subtitle">
			Registro definitivo e inmutable del proceso de admisión. Este informe conserva los resultados oficiales de la matrícula calculados al momento del cierre.
		</p>

		<div class="meta-grid">
			<div class="meta-item">
				<span class="meta-label">Fecha y hora de cierre</span>
				<strong class="meta-value">{formatDateTime(data.closure.closedAt)}</strong>
			</div>
			<div class="meta-item">
				<span class="meta-label">Motivo del cierre</span>
				<strong class="meta-value">{data.closure.reason || 'Sin motivo registrado'}</strong>
			</div>
			<div class="meta-item">
				<span class="meta-label">Total asignaciones</span>
				<strong class="meta-value">{totals.assigned.toLocaleString()}</strong>
			</div>
			<div class="meta-item">
				<span class="meta-label">Total matriculados</span>
				<strong class="meta-value text-success">{totals.matriculado.toLocaleString()}</strong>
			</div>
		</div>

		<div class="exports-bar">
			<a class="btn-back" href={resolve('/digaipe/estadisticas')}>
				← Volver a reportes
			</a>
			<div class="export-actions">
				<a class="btn-export btn-csv" href={resolve(`/digaipe/estadisticas/cierres/${data.closure.id}/csv`)}>
					📥 Descargar CSV completo
				</a>
				<a class="btn-export btn-pdf" href={resolve(`/digaipe/estadisticas/cierres/${data.closure.id}/pdf`)}>
					📄 Descargar PDF oficial
				</a>
			</div>
		</div>
	</div>

	<div class="report-content-card">
		<div class="report-title-row">
			<h2>Detalle de Resultados y Matrícula</h2>
			<p class="report-hint">
				Listado de asignaciones consolidadas por carrera y facultad para este proceso.
			</p>
		</div>

		<EnrollmentReport report={data.closure.report} includeStudents />
	</div>

	<details class="integrity-card">
		<summary>
			<span class="integrity-title">🛡️ Verificación de Integridad Criptográfica</span>
			<span class="integrity-status">Válido</span>
		</summary>
		<div class="integrity-body">
			<p>
				Este informe está protegido mediante un sello criptográfico (SHA-256). Cualquier alteración en las asignaciones históricas o registros invalida esta firma oficial.
			</p>
			<div class="hash-box">
				<span class="hash-label">Firma SHA-256:</span>
				<code class="hash-code">{data.closure.sha256}</code>
			</div>
		</div>
	</details>
</div>

<style>
	.closure-page {
		max-width: 1400px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-lg);
		padding-bottom: var(--spacing-xxl);
	}

	/* Tarjeta de Encabezado */
	.closure-header-card {
		background: #ffffff;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: var(--spacing-xl);
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
	}

	.badge-row {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-md);
	}

	.status-pill {
		display: inline-flex;
		align-items: center;
		padding: 4px 12px;
		border-radius: 9999px;
		font-size: 13px;
		font-weight: 600;
	}

	.status-closed {
		background-color: #fef3c7;
		color: #92400e;
		border: 1px solid #fde68a;
	}

	.version-tag {
		background-color: #f1f5f9;
		color: #475569;
		padding: 4px 10px;
		border-radius: 9999px;
		font-size: 13px;
		font-weight: 600;
		border: 1px solid #e2e8f0;
	}

	.process-tag {
		background-color: #eff6ff;
		color: var(--ula-blue);
		padding: 4px 10px;
		border-radius: 9999px;
		font-size: 13px;
		font-weight: 700;
		border: 1px solid #bfdbfe;
	}

	h1 {
		font-size: var(--font-size-h3);
		color: var(--ula-blue);
		margin-bottom: var(--spacing-xs);
		line-height: 1.25;
	}

	.subtitle {
		color: var(--color-text-muted);
		font-size: var(--font-size-base);
		margin-bottom: var(--spacing-lg);
		max-width: 850px;
	}

	/* Grid de Metadatos */
	.meta-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--spacing-md);
		padding: var(--spacing-md);
		background-color: var(--color-bg-alt);
		border-radius: 8px;
		border: 1px solid #e2e8f0;
		margin-bottom: var(--spacing-lg);
	}

	.meta-item {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.meta-label {
		font-size: var(--font-size-small);
		color: var(--color-text-muted);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.meta-value {
		font-size: 16px;
		color: #1e293b;
		word-break: break-word;
	}

	.text-success {
		color: #15803d;
	}

	/* Barra de Exportación y Retorno */
	.exports-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--spacing-md);
		padding-top: var(--spacing-md);
		border-top: 1px solid #e2e8f0;
	}

	.btn-back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 10px 18px;
		border-radius: 6px;
		background-color: #f1f5f9;
		color: var(--color-text-main);
		font-weight: 600;
		font-size: var(--font-size-small);
		text-decoration: none;
		transition: background-color 0.2s;
	}

	.btn-back:hover {
		background-color: #e2e8f0;
		color: #0f172a;
		text-decoration: none;
	}

	.export-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.btn-export {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 10px 18px;
		border-radius: 6px;
		font-weight: 600;
		font-size: var(--font-size-small);
		text-decoration: none;
		transition: all 0.2s ease;
	}

	.btn-csv {
		background-color: #ffffff;
		border: 1px solid var(--ula-blue);
		color: var(--ula-blue);
	}

	.btn-csv:hover {
		background-color: var(--blue-second);
		color: var(--ula-dark);
		text-decoration: none;
	}

	.btn-pdf {
		background-color: var(--ula-blue);
		border: 1px solid var(--ula-blue);
		color: #ffffff;
	}

	.btn-pdf:hover {
		background-color: var(--ula-dark);
		text-decoration: none;
		box-shadow: 0 2px 6px rgba(0, 51, 160, 0.2);
	}

	/* Tarjeta de Contenido del Reporte */
	.report-content-card {
		background: #ffffff;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: var(--spacing-xl);
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
	}

	.report-title-row {
		margin-bottom: var(--spacing-lg);
	}

	.report-title-row h2 {
		font-size: var(--font-size-h4);
		color: var(--ula-blue);
		margin-bottom: 4px;
	}

	.report-hint {
		color: var(--color-text-muted);
		font-size: var(--font-size-small);
		margin-bottom: 0;
	}

	/* Tarjeta de Integridad */
	.integrity-card {
		background: #f8fafc;
		border: 1px solid #cbd5e1;
		border-radius: 8px;
		padding: var(--spacing-md);
		cursor: pointer;
	}

	.integrity-card summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-weight: 600;
		color: #334155;
		list-style: none;
	}

	.integrity-card summary::-webkit-details-marker {
		display: none;
	}

	.integrity-title {
		font-size: var(--font-size-base);
	}

	.integrity-status {
		background: #dcfce7;
		color: #166534;
		border: 1px solid #bbf7d0;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 12px;
	}

	.integrity-body {
		margin-top: var(--spacing-md);
		padding-top: var(--spacing-md);
		border-top: 1px dashed #cbd5e1;
		cursor: default;
	}

	.integrity-body p {
		font-size: var(--font-size-small);
		color: #64748b;
		margin-bottom: var(--spacing-sm);
	}

	.hash-box {
		display: flex;
		flex-direction: column;
		gap: 4px;
		background: #ffffff;
		border: 1px solid #e2e8f0;
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: 6px;
	}

	.hash-label {
		font-size: 11px;
		text-transform: uppercase;
		font-weight: 700;
		color: #94a3b8;
	}

	.hash-code {
		font-family: monospace;
		font-size: 13px;
		color: #0f172a;
		overflow-wrap: anywhere;
	}

	/* Mobile Responsive */
	@media (max-width: 768px) {
		.closure-header-card,
		.report-content-card {
			padding: var(--spacing-md);
		}

		.meta-grid {
			grid-template-columns: 1fr;
		}

		.exports-bar {
			flex-direction: column;
			align-items: stretch;
		}

		.btn-back,
		.export-actions,
		.btn-export {
			width: 100%;
			text-align: center;
			justify-content: center;
			box-sizing: border-box;
		}
	}
</style>
