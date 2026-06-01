<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const admission = $derived(data.admission);
	const planillaFields = $derived(data.planillaFields);
</script>

<h1>Detalle de admision</h1>

<p><a href={resolve('/digaipe/generacion-planilla')}>Volver a busqueda</a></p>

{#if form?.message}
	<p>{form.message}</p>
{/if}

<h2>Estudiante</h2>

<form method="POST" action="?/updateStudent" use:enhance>
	<label>
		Nombre
		<input name="apellidosNombres" value={admission.apellidosNombres} required maxlength="255" />
	</label>

	<label>
		Telefono
		<input name="telefono" value={admission.telefono ?? ''} maxlength="60" />
	</label>

	<label>
		Correo
		<input name="correo" type="email" value={admission.correo ?? ''} maxlength="255" />
	</label>

	<label>
		Genero
		<input name="genero" value={admission.genero ?? ''} maxlength="20" />
	</label>

	<button type="submit">Guardar datos</button>
</form>

<h2>Admision</h2>

<dl>
	<dt>Cedula</dt>
	<dd>{admission.cedula}</dd>

	<dt>Carrera</dt>
	<dd>{admission.careerName}</dd>

	<dt>Facultad</dt>
	<dd>{admission.facultad}</dd>

	<dt>Opcion</dt>
	<dd>{admission.opcion}</dd>

	<dt>Clave</dt>
	<dd>{admission.clave ?? ''}</dd>

	<dt>Proceso de admision</dt>
	<dd>{admission.processCode}</dd>

	<dt>Modalidad</dt>
	<dd>{admission.modalityCode} - {admission.modalityName}</dd>

	<dt>OCRE</dt>
	<dd>{admission.ocreCode ?? ''} {admission.ocreName ?? ''}</dd>

	<dt>Periodo de ingreso</dt>
	<dd>{admission.periodoIngreso}</dd>

	<dt>Fecha de asignacion</dt>
	<dd>{new Date(admission.fechaAsignacion).toLocaleDateString()}</dd>

	<dt>Ano</dt>
	<dd>{admission.ano}</dd>

	<dt>Proceso</dt>
	<dd>{admission.proceso}</dd>
</dl>

<h2>Campos generados para planilla</h2>

<dl>
	<dt>Fecha_mat</dt>
	<dd>{planillaFields.fechaMat}</dd>

	<dt>Propio</dt>
	<dd>{planillaFields.propio}</dd>

	<dt>Planilla</dt>
	<dd>{planillaFields.planilla}</dd>

	<dt>Mod</dt>
	<dd>{planillaFields.mod}</dd>

	<dt>Prog</dt>
	<dd>{planillaFields.prog}</dd>

	<dt>Estadisticas</dt>
	<dd>{planillaFields.estadisticas}</dd>

	<dt>Activo</dt>
	<dd>{planillaFields.activo}</dd>

	<dt>Condicion</dt>
	<dd>{planillaFields.condicion}</dd>
</dl>

<p>
	<a href={resolve(`/digaipe/generacion-planilla/${admission.id}/pdf`)}
	   target="_blank"
	   rel="noreferrer"
		>Generar PDF</a>
</p>
