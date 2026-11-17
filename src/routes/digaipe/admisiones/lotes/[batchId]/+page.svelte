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
	<a aria-label="Volver" href={resolve('/digaipe/admisiones/lotes')}>
		<svg id="back" width="40px" height="40px" data-name="Capa 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 490.66 490.64"><path class="cls-1" d="M0,259.65c0-9.58,0-19.16,0-28.74.28-1.38.72-2.74.81-4.13,2.39-34.22,11.44-66.63,28-96.6C66.96,61.08,124.92,18.79,202.55,3.87c9.36-1.8,18.9-2.6,28.36-3.87,9.58,0,19.16,0,28.74,0,1.23.27,2.46.7,3.7.79,34.23,2.33,66.77,11.15,96.67,27.89,80.62,45.14,124.38,114.13,130.17,206.38,2.49,39.68-4.99,78.12-22.75,113.76-43.53,87.36-114.43,134.94-211.86,141.33-44.23,2.9-86.44-6.99-125.34-28.38C61.06,423.71,18.78,365.65,3.87,287.98,2.07,278.63,1.27,269.1,0,259.65ZM245.05,459.9c118.28.2,214.45-95.65,214.85-214.14.4-118.39-95.78-214.89-214.38-215.09-118.28-.2-214.45,95.65-214.85,214.14-.4,118.39,95.78,214.89,214.38,215.09Z"></path><path class="cls-2" d="M190.26,229.95c18.19-18.18,35.35-35.32,52.5-52.47,3.84-3.84,7.86-7.52,11.4-11.62,7.34-8.5,3.39-21.66-7.34-24.6-6.69-1.83-12,.74-16.77,5.53-27.47,27.62-55.06,55.12-82.59,82.67-9.51,9.52-9.46,22.17.13,31.76,27.31,27.32,54.63,54.64,81.96,81.95,1.13,1.13,2.23,2.3,3.49,3.27,5.16,3.96,10.8,4.69,16.59,1.68,5.77-3,9.16-8.07,7.97-14.46-.76-4.08-3.04-8.48-5.95-11.46-18.84-19.31-38.03-38.27-57.11-57.36-1.16-1.16-2.27-2.36-4.07-4.24h6.4c50.45,0,100.89,0,151.34,0,1.76,0,3.52.06,5.27-.07,7.76-.57,13.82-6.57,14.37-14.16.55-7.59-4.61-14.5-12.19-16.05-2.16-.44-4.44-.36-6.67-.37-50.77-.02-101.53-.01-152.3-.01h-6.43Z"></path><path class="cls-1" d="M190.26,229.95h6.43c50.77,0,101.53,0,152.3.01,2.23,0,4.51-.08,6.67.37,7.59,1.55,12.74,8.46,12.19,16.05-.55,7.59-6.61,13.59-14.37,14.16-1.75.13-3.51.07-5.27.07-50.45,0-100.89,0-151.34,0h-6.4c1.8,1.88,2.91,3.09,4.07,4.24,19.07,19.08,38.27,38.04,57.11,57.36,2.91,2.98,5.19,7.38,5.95,11.46,1.19,6.39-2.21,11.47-7.97,14.46-5.78,3-11.42,2.27-16.59-1.68-1.26-.97-2.36-2.14-3.49-3.27-27.32-27.31-54.64-54.63-81.96-81.95-9.58-9.59-9.64-22.24-.13-31.76,27.54-27.55,55.12-55.05,82.59-82.67,4.77-4.8,10.07-7.37,16.77-5.53,10.73,2.94,14.68,16.09,7.34,24.6-3.54,4.1-7.56,7.78-11.4,11.62-17.15,17.15-34.31,34.3-52.5,52.47Z"></path></svg>
	</a>
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
