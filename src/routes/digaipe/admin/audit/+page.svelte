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

<h1>Audit ledger</h1>

<form method="get">
	<label>Action <input name="action" value={data.filters.action} /></label>
	<label>Source <input name="source" value={data.filters.source} /></label>
	<label>Actor ID <input name="actor" value={data.filters.actorUserId} /></label>
	<label>Entity type <input name="entityType" value={data.filters.entityType} /></label>
	<label>Entity ID <input name="entityId" value={data.filters.entityId} /></label>
	<label>From <input name="from" type="datetime-local" value={data.filters.from} /></label>
	<label>To <input name="to" type="datetime-local" value={data.filters.to} /></label>
	<button>Search</button>
</form>

<p>Showing page {data.page} of {data.totalPages} ({data.total} events).</p>

{#if data.filters.from && data.filters.to}
	<a href={exportUrl()}>Export matching events (maximum 10,000)</a>
{:else}
	<p>Set both From and To to enable a bounded audit export.</p>
{/if}

{#if data.page > 1}
	<a href={pageUrl(data.page - 1)}>Previous page</a>
{/if}

{#if data.page < data.totalPages}
	<a href={pageUrl(data.page + 1)}>Next page</a>
{/if}

{#if data.logs.length === 0}
	<p>No audit events match the selected filters.</p>
{:else}
	<table>
		<thead>
			<tr>
				<th scope="col">Sequence</th>
				<th scope="col">Occurred at</th>
				<th scope="col">Source / action / outcome</th>
				<th scope="col">Actor</th>
				<th scope="col">Correlation</th>
				<th scope="col">Target</th>
				<th scope="col">Before</th>
				<th scope="col">After</th>
				<th scope="col">Metadata</th>
				<th scope="col">Integrity</th>
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
