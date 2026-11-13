<script lang="ts">
	import { resolve } from '$app/paths';
	import { batchStatusLabel } from '$lib';
	import { formatDate, formatDateTime } from '$lib/dates';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const fileUrl = (role: string, download = false) =>
		resolve(`/digaipe/admisiones/lotes/${data.batch.id}/archivo/${role}${download ? '?descargar=1' : ''}`);
</script>

<svelte:head><title>Lote #{data.batch.id} | DIGAIPE</title></svelte:head>

<div class="div-back-links">
	<a href={resolve('/digaipe/admisiones/lotes')}>Volver a documentos cargados</a>
</div>

<h1>Lote #{data.batch.id}</h1>
<p class="subtitle">
	{batchStatusLabel(data.batch.status)} · {data.batch.rowCount} filas · cargado por
	{data.batch.uploadedByName} el {formatDateTime(data.batch.createdAt)}{#if data.batch.savedAt}
		· guardado el {formatDateTime(data.batch.savedAt)}{/if}
</p>

{#if data.integrityError}
	<div class="report-alert alert-error mt-4" role="alert">{data.integrityError}</div>
{/if}

<section class="report-card" aria-labelledby="files-title">
	<h2 id="files-title" class="report-title">Documentos</h2>
	<div class="table-container">
		<table class="custom-table">
			<thead>
				<tr>
					<th scope="col">Documento</th>
					<th scope="col">Archivo original</th>
					<th scope="col">SHA-256</th>
					<th scope="col">Acciones</th>
				</tr>
			</thead>
			<tbody>
				{#each data.files as file (file.role)}
					<tr>
						<td>{file.label}</td>
						<td>{file.fileName}</td>
						<td><code>{file.sha256}</code></td>
						<td>
							{#if file.viewable}
								<a href={fileUrl(file.role)} target="_blank" rel="noopener">Abrir</a> ·
							{:else}
								<a href="#listado">Ver abajo</a> ·
							{/if}
							<a href={fileUrl(file.role, true)}>Descargar</a>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

{#if data.sheet}
	<section class="data-section" id="listado" aria-labelledby="sheet-title">
		<div class="section-header">
			<h2 id="sheet-title">
				Listado de asignados <span class="count-badge">{data.sheet.totalRows}</span>
			</h2>
		</div>
		<p>
			<small>
				Hoja «{data.sheet.sheetName}» del Excel, tal como se cargó.
				{#if data.sheet.sheetCount > 1}El archivo tiene {data.sheet.sheetCount} hojas; la carga solo usa la primera.{/if}
				{#if data.sheet.totalRows > data.sheet.rows.length}
					Se muestran las primeras {data.sheet.rows.length} de {data.sheet.totalRows} filas; descargue el
					Excel para verlas todas.
				{/if}
			</small>
		</p>
		<div class="table-container">
			<table class="custom-table">
				<thead>
					<tr>
						<th scope="col">Fila</th>
						{#each data.sheet.header as heading, i (i)}<th scope="col">{heading}</th>{/each}
					</tr>
				</thead>
				<tbody>
					{#each data.sheet.rows as row, r (r)}
						<tr>
							<td>{r + 2}</td>
							{#each row as cell, c (c)}<td>{cell.isDate ? formatDate(cell.text) : cell.text}</td>{/each}
						</tr>
					{:else}
						<tr><td colspan={data.sheet.header.length + 1}>La hoja no tiene filas de datos.</td></tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{/if}
