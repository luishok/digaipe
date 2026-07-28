<script lang="ts">
	let { data, form } = $props();
</script>

<h1>Revisión de documentos</h1>
{#if form?.message}<p aria-live="polite">{form.message}</p>{/if}

<form method="GET">
	<fieldset>
		<legend>Filtros</legend>
		<p><label>Desde <input type="date" name="dateFrom" value={data.filters.dateFrom} /></label></p>
		<p><label>Hasta <input type="date" name="dateTo" value={data.filters.dateTo} /></label></p>
		<p>
			<label
				>Estado <select name="status"
					><option value="">Todos</option><option
						value="pendiente"
						selected={data.filters.status === 'pendiente'}>Pendiente</option
					><option value="matriculado" selected={data.filters.status === 'matriculado'}
						>Matriculado</option
					><option value="devuelto" selected={data.filters.status === 'devuelto'}>Devuelto</option
					></select
				></label
			>
		</p>
		<p>
			<label
				>Proceso <select name="process"
					><option value="">Todos</option>{#each data.processes as process}<option
							value={process.code}
							selected={data.filters.process === process.code}>{process.code}</option
						>{/each}</select
				></label
			>
		</p>
		<p><label>Buscar <input name="search" value={data.filters.search} /></label></p>
		<button type="submit">Filtrar</button> <a href="/digaipe/revision-documentos">Limpiar</a>
	</fieldset>
</form>

<form method="POST" action="?/review">
	<h2>Admisiones con planilla generada</h2>
	<p>{data.rows.length} admisión(es)</p>
	<table>
		<thead
			><tr
				><th>Seleccionar</th><th>Fecha válida</th><th>Estado</th><th>Proceso</th><th>Carrera</th><th
					>Cédula</th
				><th>Estudiante</th><th>Motivo</th>{#if data.isAdmin}<th>Administración</th>{/if}</tr
			></thead
		>
		<tbody
			>{#each data.rows as row}<tr>
					<td><input type="checkbox" name="processingId" value={row.id} /></td><td
						>{String(row.processingDate).slice(0, 10)}</td
					><td>{row.status}</td><td>{row.processCode}</td><td>{row.career ?? ''}</td><td
						>{row.cedula}</td
					><td>{row.student}</td><td>{row.returnReason ?? ''}</td>
					{#if data.isAdmin}<td
							><label>Motivo <input name={`unlockReason_${row.id}`} maxlength="500" /></label
							><button
								formmethod="POST"
								formaction="?/unlock"
								name="unlockProcessingId"
								value={row.id}>Desbloquear</button
							></td
						>{/if}
				</tr>{/each}</tbody
		>
	</table>
	<fieldset>
		<legend>Decisión para las seleccionadas</legend>
		<p>
			<label
				>Estado <select name="status"
					><option value="matriculado">Matriculado</option><option value="devuelto">Devuelto</option
					></select
				></label
			>
		</p>
		<p><label>Motivo de devolución <input name="reason" maxlength="500" /></label></p>
		<button type="submit">Guardar decisión</button>
	</fieldset>
</form>
