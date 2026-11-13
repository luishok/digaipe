<script lang="ts">
	import { resolve } from '$app/paths';
	import { batchStatusLabel } from '$lib';
	import { formatDateTime } from '$lib/dates';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const fileUrl = (batchId: number, role: string) =>
		resolve(`/digaipe/admisiones/lotes/${batchId}/archivo/${role}`);
</script>

<svelte:head><title>Documentos cargados | DIGAIPE</title></svelte:head>

<div class="div-back-links">
	<a href={resolve('/digaipe/admisiones')}>Volver a admisiones</a>
</div>

<h1>Documentos cargados</h1>
<p class="subtitle">
	Los archivos con los que se cargó cada lote de admisiones: el listado de asignados (Excel), la
	estadística firmada y el manifiesto. Cada archivo se verifica contra su huella SHA-256 antes de
	mostrarse.
</p>

<section class="data-section" aria-labelledby="batches-title">
	<div class="section-header">
		<h2 id="batches-title">Lotes <span class="count-badge">{data.total}</span></h2>
	</div>

	<div class="table-container">
		<table class="custom-table">
			<thead>
				<tr>
					<th scope="col">Lote</th>
					<th scope="col">Estado</th>
					<th scope="col">Filas</th>
					<th scope="col">Cargado por</th>
					<th scope="col">Cargado el</th>
					<th scope="col">Guardado el</th>
					<th scope="col">Documentos</th>
				</tr>
			</thead>
			<tbody>
				{#each data.batches as batch (batch.id)}
					<tr>
						<td><a href={resolve(`/digaipe/admisiones/lotes/${batch.id}`)}>#{batch.id}</a></td>
						<td>{batchStatusLabel(batch.status)}</td>
						<td>{batch.rowCount}</td>
						<td>{batch.uploadedByName}</td>
						<td>{formatDateTime(batch.createdAt)}</td>
						<td>{formatDateTime(batch.savedAt)}</td>
						<td>
							<ul>
								<li>
									<a href={resolve(`/digaipe/admisiones/lotes/${batch.id}`)}>Ver listado</a>
									({batch.sourceFileName})
								</li>
								<li>
									<a href={fileUrl(batch.id, 'estadistica')} target="_blank" rel="noopener">Estadística</a>
									({batch.estadisticaFileName})
								</li>
								<li>
									<a href={fileUrl(batch.id, 'manifest')} target="_blank" rel="noopener">Manifiesto</a>
									({batch.manifestFileName})
								</li>
							</ul>
						</td>
					</tr>
				{:else}
					<tr><td colspan="7">Todavía no hay lotes cargados.</td></tr>
				{/each}
			</tbody>
		</table>
	</div>

	<nav class="filter-actions" aria-label="Paginación de lotes">
		{#if data.page > 1}
			<a class="btn-secondary" href={resolve(`/digaipe/admisiones/lotes?page=${data.page - 1}`)}>Anterior</a>
		{/if}
		<span>Página {data.page} de {data.totalPages}</span>
		{#if data.page < data.totalPages}
			<a class="btn-secondary" href={resolve(`/digaipe/admisiones/lotes?page=${data.page + 1}`)}>Siguiente</a>
		{/if}
	</nav>
</section>
