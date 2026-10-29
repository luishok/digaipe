<script lang="ts">
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();

	function formatJson(value: unknown) {
		return JSON.stringify(value, null, 2) ?? '';
	}

	function pageUrl(page: number) {
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(data.filters)) {
			if (value) params.set(key, value);
		}
		params.set('page', String(page));
		return `/digaipe/admin/audit?${params.toString()}`;
	}

	function exportUrl() {
		const params = new URLSearchParams();
		for (const [key, value] of Object.entries(data.filters)) {
			if (value) params.set(key, value);
		}
		return `/digaipe/admin/audit/export?${params.toString()}`;
	}
</script>

<h1>Registro de auditoría</h1>

<form method="get">
	<label>Acción <input name="action" value={data.filters.action} /></label>
	<label>Origen <input name="source" value={data.filters.source} /></label>
	<label>ID del usuario <input name="actor" value={data.filters.actorUserId} /></label>
	<label>Tipo de entidad <input name="entityType" value={data.filters.entityType} /></label>
	<label>ID de entidad <input name="entityId" value={data.filters.entityId} /></label>
	<label>Desde <input name="from" type="datetime-local" value={data.filters.from} /></label>
	<label>Hasta <input name="to" type="datetime-local" value={data.filters.to} /></label>
	<button>Buscar</button>
</form>

<p>Página {data.page} de {data.totalPages} ({data.total} eventos).</p>

{#if data.filters.from && data.filters.to}
	<a href={exportUrl()}>Exportar los eventos filtrados (máximo 10.000)</a>
{:else}
	<p>Indique las fechas Desde y Hasta para habilitar la exportación.</p>
{/if}

{#if data.page > 1}
	<a href={pageUrl(data.page - 1)}>Página anterior</a>
{/if}

{#if data.page < data.totalPages}
	<a href={pageUrl(data.page + 1)}>Página siguiente</a>
{/if}

{#if data.logs.length === 0}
	<p>No hay eventos de auditoría que coincidan con los filtros.</p>
{:else}
	<table>
		<thead>
			<tr>
				<th scope="col">Secuencia</th>
				<th scope="col">Fecha y hora</th>
				<th scope="col">Origen / acción / resultado</th>
				<th scope="col">Usuario</th>
				<th scope="col">Correlación</th>
				<th scope="col">Entidad</th>
				<th scope="col">Antes</th>
				<th scope="col">Después</th>
				<th scope="col">Metadatos</th>
				<th scope="col">Integridad</th>
			</tr>
		</thead>
		<tbody>
			{#each data.logs as log}
				<tr>
					<td>{log.sequence}</td>
					<td>{log.occurredAt.toISOString()}</td>
					<td>{log.source}<br />{log.action}<br />{log.outcome}</td>
					<td>{log.actorName ?? ''}<br />{log.actorEmail ?? ''}<br />{log.actorUserId ?? ''}</td>
					<td>{log.correlationId ?? ''}</td>
					<td>{log.entityType}<br />{log.entityId}</td>
					<td><pre>{formatJson(log.beforeValue)}</pre></td>
					<td><pre>{formatJson(log.afterValue)}</pre></td>
					<td><pre>{formatJson(log.metadata)}</pre></td>
					<td><pre>{log.previousHash}{'\n'}{log.eventHash}</pre></td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}
