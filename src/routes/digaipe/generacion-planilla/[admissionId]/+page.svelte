<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const admission = $derived(data.admission);
	const planillaFields = $derived(data.planillaFields);
</script>
<p><a href={resolve('/digaipe/generacion-planilla')}>Volver a busqueda</a></p>
<h1>Detalle de admision</h1>



{#if form?.message}
	<p>{form.message}</p>
{/if}


<div class='div-card'>
<h2>Estudiante</h2>

<form method="POST" action="?/updateStudent" use:enhance>
	<div class='container-update-student'>
		<div class='label-input'>
			<label for="apellidosNombres">
			Nombre
			</label>
			<input style="width: fit-content;" name="apellidosNombres" type="text" id="apellidosNombres" value={admission.apellidosNombres} required maxlength="255" />
		
		</div>

		<div class='label-input'>
			<label for="telefono">
			Telefono
			</label>
			<input name="telefono" type='tel' id="telefono" value={admission.telefono ?? ''} maxlength="60" />
		</div>

		<div class='label-input'>
			<label for="correo">
			Correo
			</label>
			<input name="correo" type="email" id="correo" value={admission.correo ?? ''} maxlength="255" />
		</div>

		<div class='label-input'>
			<label for="genero">
				Genero
			</label>
			<select name="genero" id="genero">
				<option value="">Seleccione una opcion</option>
				<option value="M" selected={admission.genero === 'M'}>Masculino</option>
				<option value="F" selected={admission.genero === 'F'}>Femenino</option>
				<option value="O" selected={admission.genero === 'O'}>Otro</option>
			</select>
			<!-- <input name="genero" value={admission.genero ?? ''} maxlength="20" /> -->
		</div>

		<button type="submit">Guardar datos</button>
	</div>
</form>
</div>



<style>

.main-container-generacion-planilla{
	display: flex;
		gap: 2em;

}
.main-container-generacion-planilla .div-card{

	flex: 1;

}
.admision-details-flex, .admision-details-flex2{

	display: flex;
	flex-wrap: wrap;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
	justify-content: space-around;
}
.label-input input[readonly]{

	background-color: #f8fafc; /* Fondo gris claro limpio */
    color: #334155; /* Texto oscuro legible */
    border: 1px solid #cbd5e1; /* Borde suave */
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 0.95rem;
    font-weight: 500;
    font-family: inherit;
    cursor: default; /* Indica que no es editable al pasar el mouse */
    outline: none;
	width: fit-content;
}
.label-input input[readonly]:focus {
    border-color: #94a3b8;
    background-color: #f1f5f9;
}

a.btn-submit{

	padding: 1em;
    border: 1px solid;
    border-radius: 8px;
    background: var(--ula-blue);
    color: white;
}
.div-white h2{
	font-size: 20px;
    color: #1e293b;
    margin-top: 0;
    margin-bottom: 20px;
    font-weight: 700;
    border-left: 4px solid #0033a0;
    padding-left: 10px;
}
.div-blue{
	background-color: var(--ula-blue);


}
.div-blue-inside{

	    border-radius: 8px;
    background: white;
    padding: 1.5rem;
}
.div-blue h2{font-size: 20px;
    color: #ffffff;
    margin-top: 0;
    margin-bottom: 20px;
    font-weight: 700;
    border-left: 4px solid white;
    padding-left: 10px;
}
.div-card{
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	border-radius: 8px;
	padding: 20px;
	gap: 0.5rem;
}
.card-actions{
	text-align: center;
    margin-top: 1.5em;
}
</style>


<div class='main-container-generacion-planilla'>
<div class='div-card div-white' style='    align-content: baseline;'>
    <h2 style='width: 100%'>Admisión</h2>

    <div class='admision-details-flex'>
        <div class="label-input">
            <label for="cedula">Cédula</label>
            <input type="text" id="cedula" value="{admission.cedula}" readonly />
        </div>

        <div class="label-input">
            <label for="carrera">Carrera</label>
            <input type="text" id="carrera" value="{admission.careerName}" readonly />
        </div>

        <div class="label-input">
            <label for="facultad">Facultad</label>
            <input type="text" id="facultad" value="{admission.facultad}" readonly />
        </div>

        <div class="label-input">
            <label for="opcion">Opción</label>
            <input type="text" id="opcion" value="{admission.opcion}" readonly />
        </div>

        <div class="label-input">
            <label for="clave">Clave</label>
            <input type="text" id="clave" value="{admission.clave ?? ''}" readonly />
        </div>

        <div class="label-input">
            <label for="proceso-adm">Proceso de admisión</label>
            <input type="text" id="proceso-adm" value="{admission.processCode}" readonly />
        </div>

        <div class="label-input col-span-2">
            <label for="modalidad">Modalidad</label>
            <input type="text" id="modalidad" value="{admission.modalityCode} - {admission.modalityName}" readonly />
        </div>

        <div class="label-input col-span-2">
            <label for="ocre">OCRE</label>
            <input type="text" id="ocre" value="{admission.ocreCode ?? ''} {admission.ocreName ?? ''}" readonly />
        </div>

        <div class="label-input">
            <label for="periodo">Periodo de ingreso</label>
            <input type="text" id="periodo" value="{admission.periodoIngreso}" readonly />
        </div>

        <div class="label-input">
            <label for="fecha">Fecha de asignación</label>
            <input type="text" id="fecha" value="{new Date(admission.fechaAsignacion).toLocaleDateString()}" readonly />
        </div>

        <div class="label-input">
            <label for="ano">Año</label>
            <input type="text" id="ano" value="{admission.ano}" readonly />
        </div>

        <div class="label-input">
            <label for="proceso">Proceso</label>
            <input type="text" id="proceso" value="{admission.proceso}" readonly />
        </div>
    </div>
</div>



<div class='div-card div-blue'>
    <h2>Campos generados para planilla</h2>
	<div class='div-blue-inside'>
    <div class="admision-details-flex2 ">
        <div class="label-input">
            <label for="fecha-mat">Fecha Matrícula</label>
            <input type="text" id="fecha-mat" value="{planillaFields.fechaMat}" readonly />
        </div>

        <div class="label-input">
            <label for="propio">Propio</label>
            <input type="text" id="propio" value="{planillaFields.propio}" readonly />
        </div>

        <div class="label-input">
            <label for="planilla">Planilla</label>
            <input type="text" id="planilla" value="{planillaFields.planilla}" readonly />
        </div>

        <div class="label-input">
            <label for="mod">Modalidad (Mod)</label>
            <input type="text" id="mod" value="{planillaFields.mod}" readonly />
        </div>

        <div class="label-input">
            <label for="prog">Programa (Prog)</label>
            <input type="text" id="prog" value="{planillaFields.prog}" readonly />
        </div>

        <div class="label-input">
            <label for="estadisticas">Estadísticas</label>
            <input type="text" id="estadisticas" value="{planillaFields.estadisticas}" readonly />
        </div>

        <div class="label-input">
            <label for="activo">Activo</label>
            <input type="text" id="activo" value="{planillaFields.activo}" readonly />
        </div>

        <div class="label-input">
            <label for="condicion">Condición</label>
            <input type="text" id="condicion" value="{planillaFields.condicion}" readonly />
        </div>
    </div>

    <div class="card-actions">
        <a href={resolve(`/digaipe/generacion-planilla/${admission.id}/pdf`)}
           target="_blank"
           rel="noreferrer"
           class="btn-submit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Generar PDF
        </a>
    </div>
	</div>
</div>
</div>