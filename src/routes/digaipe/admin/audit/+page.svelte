<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatDate } from '$lib/dates';
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	function formatJson(value: unknown) {
		return JSON.stringify(value, null, 2) ?? '';
	}

	// Query strings for the pagination and export links (the links themselves use resolve()).
	function filterQuery(extra: Record<string, string> = {}) {
		const entries = Object.entries({ ...data.filters, ...extra }).filter(([, value]) => value);
		return entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
	}
</script>

<style>
	/* Pre dentro de celdas: limita ancho y hace scroll interno */
	.audit-pre {
		margin: 0;
		font-size: 0.72rem;
		font-family: monospace;
		white-space: pre-wrap;
		word-break: break-all;
		max-width: 220px;
		max-height: 120px;
		overflow: auto;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 4px;
		padding: 4px 6px;
		color: #334155;
	}

	/* Columnas angostas fijas */
	.col-seq    { width: 70px;  min-width: 60px; }
	.col-date   { width: 140px; min-width: 120px; white-space: nowrap; }
	.col-action { width: 180px; min-width: 150px; }
	.col-user   { width: 160px; min-width: 130px; }
	.col-corr   { width: 90px;  min-width: 80px;  font-family: monospace; font-size: 0.7rem; word-break: break-all; }
	.col-entity { width: 130px; min-width: 110px; }
	.col-json   { width: 240px; min-width: 180px; }
	.col-hash   { width: 130px; min-width: 110px; }

	/* Badge resultado */
	.outcome-badge {
		display: inline-block;
		padding: 1px 7px;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.outcome-ok      { background: #dcfce7; color: #166534; }
	.outcome-denied  { background: #fee2e2; color: #991b1b; }
	.outcome-default { background: #f1f5f9; color: #475569; }

	/* Paginación */
	.pagination {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	.pagination a {
		display: inline-flex;
		align-items: center;
		padding: 6px 14px;
		border: 1px solid #003399;
		border-radius: 4px;
		color: #003399;
		font-size: 0.875rem;
		font-weight: 500;
		text-decoration: none;
		transition: background-color 0.15s;
	}
	.pagination a:hover { background-color: #f0f4ff; }

	.page-info {
		font-size: 0.875rem;
		color: var(--color-text-muted);
	}

	/* Bloque de exportación */
	.export-bar {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	.export-note {
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	/* Stack de líneas dentro de celdas de acción/usuario */
	.cell-stack {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 0.82rem;
	}
	.cell-stack .primary   { font-weight: 600; color: #1e293b; }
	.cell-stack .secondary { color: #64748b; font-size: 0.75rem; }
	.cell-stack .tertiary  { font-family: monospace; color: #94a3b8; font-size: 0.7rem; word-break: break-all; }
</style>

<!-- Botón volver -->
<div class="div-back-links">
	<a aria-label="Volver" href={resolve('/digaipe/admin')}>
		<svg id="back" width="40px" height="40px" data-name="Capa 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 490.66 490.64">
			<path class="cls-1" d="M0,259.65c0-9.58,0-19.16,0-28.74.28-1.38.72-2.74.81-4.13,2.39-34.22,11.44-66.63,28-96.6C66.96,61.08,124.92,18.79,202.55,3.87c9.36-1.8,18.9-2.6,28.36-3.87,9.58,0,19.16,0,28.74,0,1.23.27,2.46.7,3.7.79,34.23,2.33,66.77,11.15,96.67,27.89,80.62,45.14,124.38,114.13,130.17,206.38,2.49,39.68-4.99,78.12-22.75,113.76-43.53,87.36-114.43,134.94-211.86,141.33-44.23,2.9-86.44-6.99-125.34-28.38C61.06,423.71,18.78,365.65,3.87,287.98,2.07,278.63,1.27,269.1,0,259.65ZM245.05,459.9c118.28.2,214.45-95.65,214.85-214.14.4-118.39-95.78-214.89-214.38-215.09-118.28-.2-214.45,95.65-214.85,214.14-.4,118.39,95.78,214.89,214.38,215.09Z"/>
			<path class="cls-2" d="M190.26,229.95c18.19-18.18,35.35-35.32,52.5-52.47,3.84-3.84,7.86-7.52,11.4-11.62,7.34-8.5,3.39-21.66-7.34-24.6-6.69-1.83-12,.74-16.77,5.53-27.47,27.62-55.06,55.12-82.59,82.67-9.51,9.52-9.46,22.17.13,31.76,27.31,27.32,54.63,54.64,81.96,81.95,1.13,1.13,2.23,2.3,3.49,3.27,5.16,3.96,10.8,4.69,16.59,1.68,5.77-3,9.16-8.07,7.97-14.46-.76-4.08-3.04-8.48-5.95-11.46-18.84-19.31-38.03-38.27-57.11-57.36-1.16-1.16-2.27-2.36-4.07-4.24h6.4c50.45,0,100.89,0,151.34,0,1.76,0,3.52.06,5.27-.07,7.76-.57,13.82-6.57,14.37-14.16.55-7.59-4.61-14.5-12.19-16.05-2.16-.44-4.44-.36-6.67-.37-50.77-.02-101.53-.01-152.3-.01h-6.43Z"/>
			<path class="cls-1" d="M190.26,229.95h6.43c50.77,0,101.53,0,152.3.01,2.23,0,4.51-.08,6.67.37,7.59,1.55,12.74,8.46,12.19,16.05-.55,7.59-6.61,13.59-14.37,14.16-1.75.13-3.51.07-5.27.07-50.45,0-100.89,0-151.34,0h-6.4c1.8,1.88,2.91,3.09,4.07,4.24,19.07,19.08,38.27,38.04,57.11,57.36,2.91,2.98,5.19,7.38,5.95,11.46,1.19,6.39-2.21,11.47-7.97,14.46-5.78,3-11.42,2.27-16.59-1.68-1.26-.97-2.36-2.14-3.49-3.27-27.32-27.31-54.64-54.63-81.96-81.95-9.58-9.59-9.64-22.24-.13-31.76,27.54-27.55,55.12-55.05,82.59-82.67,4.77-4.8,10.07-7.37,16.77-5.53,10.73,2.94,14.68,16.09,7.34,24.6-3.54,4.1-7.56,7.78-11.4,11.62-17.15,17.15-34.31,34.3-52.5,52.47Z"/>
		</svg>
	</a>
</div>

<h1>Registro de auditoría</h1>

<!-- Filtros -->
<form method="get">
	<fieldset class="filter-card">
		<legend>Filtros</legend>

		<div class="filter-row-flex">
			<div class="label-input">
				<label>Acción <input name="action" value={data.filters.action} placeholder="ej. user.login" /></label>
			</div>
			<div class="label-input">
				<label>Origen <input name="source" value={data.filters.source} placeholder="ej. web" /></label>
			</div>
			<div class="label-input">
				<label>ID del usuario <input name="actor" value={data.filters.actorUserId} placeholder="UUID" /></label>
			</div>
		</div>

		<div class="filter-row-flex">
			<div class="label-input">
				<label>Tipo de entidad <input name="entityType" value={data.filters.entityType} placeholder="ej. admission" /></label>
			</div>
			<div class="label-input">
				<label>ID de entidad <input name="entityId" value={data.filters.entityId} /></label>
			</div>
			<div class="label-input">
				<label>Desde <input name="from" type="datetime-local" value={data.filters.from} /></label>
			</div>
			<div class="label-input">
				<label>Hasta <input name="to" type="datetime-local" value={data.filters.to} /></label>
			</div>
		</div>

		<div class="filter-actions">
			<button type="submit" class="btn-submit">Buscar</button>
			<a href={resolve('/digaipe/admin/audit')} class="btn-secondary">Limpiar</a>
		</div>
	</fieldset>
</form>

<!-- Barra de exportación y paginación superior -->
<div class="data-section">
	<div class="section-header">
		<div>
			<h2>Eventos de auditoría</h2>
			<span class="count-badge">{data.total} evento(s) · página {data.page} de {data.totalPages}</span>
		</div>
		<div class="export-bar">
			{#if data.filters.from && data.filters.to}
				<a href={resolve(`/digaipe/admin/audit/export?${filterQuery()}`)} class="btn-secondary">
					<i class="fa fa-download"></i> Exportar (máx. 10.000)
				</a>
			{:else}
				<span class="export-note">Indique Desde y Hasta para exportar.</span>
			{/if}
		</div>
	</div>

	<!-- Paginación -->
	{#if data.totalPages > 1}
		<div class="pagination" style="margin-bottom: 1rem;">
			{#if data.page > 1}
				<a href={resolve(`/digaipe/admin/audit?${filterQuery({ page: String(data.page - 1) })}`)}>← Anterior</a>
			{/if}
			<span class="page-info">Página {data.page} de {data.totalPages}</span>
			{#if data.page < data.totalPages}
				<a href={resolve(`/digaipe/admin/audit?${filterQuery({ page: String(data.page + 1) })}`)}>Siguiente →</a>
			{/if}
		</div>
	{/if}

	<!-- Tabla -->
	{#if data.logs.length === 0}
		<p>No hay eventos de auditoría que coincidan con los filtros.</p>
	{:else}
		<div class="table-container">
			<table class="custom-table">
				<thead>
					<tr>
						<th scope="col" class="col-seq">Seq.</th>
						<th scope="col" class="col-date">Fecha y hora</th>
						<th scope="col" class="col-action">Origen / Acción / Resultado</th>
						<th scope="col" class="col-user">Usuario</th>
						<th scope="col" class="col-corr">Correlación</th>
						<th scope="col" class="col-entity">Entidad</th>
						<th scope="col" class="col-json">Antes</th>
						<th scope="col" class="col-json">Después</th>
						<th scope="col" class="col-json">Metadatos</th>
						<th scope="col" class="col-hash">Integridad</th>
					</tr>
				</thead>
				<tbody>
					{#each data.logs as log (log.sequence)}
						<tr>
							<td class="col-seq font-mono">{log.sequence}</td>

							<td class="col-date">
								<div class="cell-stack">
									<span class="primary">{formatDate(log.occurredAt)}</span>
									<span class="secondary">{log.occurredAt.toISOString().slice(11, 19)} UTC</span>
								</div>
							</td>

							<td class="col-action">
								<div class="cell-stack">
									<span class="secondary">{log.source}</span>
									<code class="code-tag">{log.action}</code>
									{#if log.outcome}
										<span
											class="outcome-badge {log.outcome === 'ok' || log.outcome === 'success'
												? 'outcome-ok'
												: log.outcome === 'denied' || log.outcome === 'error'
												? 'outcome-denied'
												: 'outcome-default'}"
										>{log.outcome}</span>
									{/if}
								</div>
							</td>

							<td class="col-user">
								<div class="cell-stack">
									<span class="primary">{log.actorName ?? '—'}</span>
									<span class="secondary">{log.actorEmail ?? ''}</span>
									<span class="tertiary">{log.actorUserId ?? ''}</span>
								</div>
							</td>

							<td class="col-corr">{log.correlationId ?? '—'}</td>

							<td class="col-entity">
								<div class="cell-stack">
									<span class="secondary">{log.entityType}</span>
									<span class="primary">{log.entityId}</span>
								</div>
							</td>

							<td class="col-json">
								{#if log.beforeValue != null}
									<pre class="audit-pre">{formatJson(log.beforeValue)}</pre>
								{:else}
									<span class="text-muted">—</span>
								{/if}
							</td>

							<td class="col-json">
								{#if log.afterValue != null}
									<pre class="audit-pre">{formatJson(log.afterValue)}</pre>
								{:else}
									<span class="text-muted">—</span>
								{/if}
							</td>

							<td class="col-json">
								{#if log.metadata != null}
									<pre class="audit-pre">{formatJson(log.metadata)}</pre>
								{:else}
									<span class="text-muted">—</span>
								{/if}
							</td>

							<td class="col-hash">
								<div class="cell-stack">
									<span class="tertiary" title="Hash anterior">{log.previousHash ?? '—'}</span>
									<span class="tertiary" title="Hash del evento">{log.eventHash}</span>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Paginación inferior -->
		{#if data.totalPages > 1}
			<div class="pagination" style="margin-top: 1rem;">
				{#if data.page > 1}
					<a href={resolve(`/digaipe/admin/audit?${filterQuery({ page: String(data.page - 1) })}`)}>← Anterior</a>
				{/if}
				<span class="page-info">Página {data.page} de {data.totalPages}</span>
				{#if data.page < data.totalPages}
					<a href={resolve(`/digaipe/admin/audit?${filterQuery({ page: String(data.page + 1) })}`)}>Siguiente →</a>
				{/if}
			</div>
		{/if}
	{/if}
</div>
