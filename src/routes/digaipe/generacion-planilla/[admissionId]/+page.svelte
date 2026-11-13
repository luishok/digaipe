<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { can } from '$lib/permissions';
	import { formatDate, formatDateTime } from '$lib/dates';

	let { data, form } = $props();
	const admission = $derived(data.admission);
	const planillaFields = $derived(data.planillaFields);
	const processing = $derived(data.processing);
</script>

<!-- <p><a href={resolve('/digaipe/generacion-planilla')}>Volver a busqueda</a></p> -->
<div class="div-back-links s-bPmSvMfu9Bqn">
	<a aria-label="Volver" href={resolve('/digaipe/generacion-planilla')} class="s-bPmSvMfu9Bqn">
		<svg id="back" width="40px" height="40px" data-name="Capa 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 490.66 490.64" class="s-bPmSvMfu9Bqn"><path class="cls-1 s-bPmSvMfu9Bqn" d="M0,259.65c0-9.58,0-19.16,0-28.74.28-1.38.72-2.74.81-4.13,2.39-34.22,11.44-66.63,28-96.6C66.96,61.08,124.92,18.79,202.55,3.87c9.36-1.8,18.9-2.6,28.36-3.87,9.58,0,19.16,0,28.74,0,1.23.27,2.46.7,3.7.79,34.23,2.33,66.77,11.15,96.67,27.89,80.62,45.14,124.38,114.13,130.17,206.38,2.49,39.68-4.99,78.12-22.75,113.76-43.53,87.36-114.43,134.94-211.86,141.33-44.23,2.9-86.44-6.99-125.34-28.38C61.06,423.71,18.78,365.65,3.87,287.98,2.07,278.63,1.27,269.1,0,259.65ZM245.05,459.9c118.28.2,214.45-95.65,214.85-214.14.4-118.39-95.78-214.89-214.38-215.09-118.28-.2-214.45,95.65-214.85,214.14-.4,118.39,95.78,214.89,214.38,215.09Z"></path><path class="cls-2 s-bPmSvMfu9Bqn" d="M190.26,229.95c18.19-18.18,35.35-35.32,52.5-52.47,3.84-3.84,7.86-7.52,11.4-11.62,7.34-8.5,3.39-21.66-7.34-24.6-6.69-1.83-12,.74-16.77,5.53-27.47,27.62-55.06,55.12-82.59,82.67-9.51,9.52-9.46,22.17.13,31.76,27.31,27.32,54.63,54.64,81.96,81.95,1.13,1.13,2.23,2.3,3.49,3.27,5.16,3.96,10.8,4.69,16.59,1.68,5.77-3,9.16-8.07,7.97-14.46-.76-4.08-3.04-8.48-5.95-11.46-18.84-19.31-38.03-38.27-57.11-57.36-1.16-1.16-2.27-2.36-4.07-4.24h6.4c50.45,0,100.89,0,151.34,0,1.76,0,3.52.06,5.27-.07,7.76-.57,13.82-6.57,14.37-14.16.55-7.59-4.61-14.5-12.19-16.05-2.16-.44-4.44-.36-6.67-.37-50.77-.02-101.53-.01-152.3-.01h-6.43Z"></path><path class="cls-1 s-bPmSvMfu9Bqn" d="M190.26,229.95h6.43c50.77,0,101.53,0,152.3.01,2.23,0,4.51-.08,6.67.37,7.59,1.55,12.74,8.46,12.19,16.05-.55,7.59-6.61,13.59-14.37,14.16-1.75.13-3.51.07-5.27.07-50.45,0-100.89,0-151.34,0h-6.4c1.8,1.88,2.91,3.09,4.07,4.24,19.07,19.08,38.27,38.04,57.11,57.36,2.91,2.98,5.19,7.38,5.95,11.46,1.19,6.39-2.21,11.47-7.97,14.46-5.78,3-11.42,2.27-16.59-1.68-1.26-.97-2.36-2.14-3.49-3.27-27.32-27.31-54.64-54.63-81.96-81.95-9.58-9.59-9.64-22.24-.13-31.76,27.54-27.55,55.12-55.05,82.59-82.67,4.77-4.8,10.07-7.37,16.77-5.53,10.73,2.94,14.68,16.09,7.34,24.6-3.54,4.1-7.56,7.78-11.4,11.62-17.15,17.15-34.31,34.3-52.5,52.47Z"></path></svg></a></div>

<h1>Detalle de admision</h1>

{#if form?.message}
	<p>{form.message}</p>
{/if}

<div class="div-card">
	<h2>Estudiante</h2>

	<form
		method="POST"
		action="?/updateStudent"
		use:enhance={() =>
			async ({ update }) =>
				update({ reset: false })}
	>
		<div class="container-update-student">
			<div class="label-input">
				<label for="apellidosNombres"> Nombre </label>
				<input
					style="width: fit-content;"
					name="apellidosNombres"
					type="text"
					id="apellidosNombres"
					value={admission.apellidosNombres}
					required
					maxlength="255"
				/>
			</div>

			<div class="label-input">
				<label for="telefono"> Telefono </label>
				<input
					name="telefono"
					type="tel"
					id="telefono"
					value={admission.telefono ?? ''}
					maxlength="60"
				/>
			</div>

			<div class="label-input">
				<label for="correo"> Correo </label>
				<input
					name="correo"
					type="email"
					id="correo"
					value={admission.correo ?? ''}
					maxlength="255"
				/>
			</div>

			<div class="label-input">
				<label for="genero"> Genero </label>
				<select name="genero" id="genero">
					<option value="">Seleccione una opcion</option>
					<option value="M" selected={admission.genero === 'M'}>Masculino</option>
					<option value="F" selected={admission.genero === 'F'}>Femenino</option>
					<option value="O" selected={admission.genero === 'O'}>Otro</option>
				</select>
				<!-- <input name="genero" value={admission.genero ?? ''} maxlength="20" /> -->
			</div>

			{#if can(data.user, 'students.edit')}
				<button type="submit">Guardar datos</button>
			{/if}
		</div>
	</form>
</div>

<div class="main-container-generacion-planilla">
	<div class="div-card div-white" style="    align-content: baseline;">
		<h2 style="width: 100%">Admisión</h2>

		{#if processing}
			<section
				class="report-alert {processing.status === 'devuelto'
					? 'alert-error'
					: processing.status === 'matriculado'
						? 'alert-success'
						: 'alert-warning'}"
				role={processing.status === 'devuelto' ? 'alert' : 'status'}
				style="width: 100%"
			>
				<div>
					<span class="status-badge status-{processing.status}">{processing.status}</span>
					<ul class="alert-list">
						<li>
							Planilla generada el {formatDate(processing.processingDate)}
						</li>
						{#if processing.reviewedAt}
							<li>
								Revisada el {formatDateTime(processing.reviewedAt)}
								{#if processing.reviewedBy}por {processing.reviewedBy}{/if}
							</li>
						{/if}
						{#if processing.status === 'devuelto'}
							<li><strong>Motivo de devolución:</strong> {processing.returnReason ?? 'No indicado'}</li>
						{/if}
						{#if processing.unlockedAt}
							<li>
								Desbloqueada el {formatDateTime(processing.unlockedAt)}{#if processing.unlockReason}:
									{processing.unlockReason}{/if}
							</li>
						{/if}
					</ul>
				</div>
			</section>
		{/if}

		<div class="admision-details-flex">
			<div class="label-input">
				<label for="cedula">Cédula</label>
				<input type="text" id="cedula" value={admission.cedula} readonly />
			</div>

			<div class="label-input">
				<label for="carrera">Carrera</label>
				<input type="text" id="carrera" value={admission.careerName} readonly />
			</div>

			<div class="label-input">
				<label for="facultad">Facultad</label>
				<input type="text" id="facultad" value={admission.facultad} readonly />
			</div>

			<div class="label-input">
				<label for="opcion">Opción</label>
				<input type="text" id="opcion" value={admission.opcion} readonly />
			</div>

			<div class="label-input">
				<label for="clave">Clave</label>
				<input type="text" id="clave" value={admission.clave ?? ''} readonly />
			</div>

			<div class="label-input">
				<label for="proceso-adm">Proceso de admisión</label>
				<input type="text" id="proceso-adm" value={admission.processCode} readonly />
			</div>

			<div class="label-input col-span-2">
				<label for="modalidad">Modalidad</label>
				<input
					type="text"
					id="modalidad"
					value="{admission.modalityCode} - {admission.modalityName}"
					readonly
				/>
			</div>

			<div class="label-input col-span-2">
				<label for="ocre">OCRE</label>
				<input
					type="text"
					id="ocre"
					value="{admission.ocreCode ?? ''} {admission.ocreName ?? ''}"
					readonly
				/>
			</div>

			<div class="label-input">
				<label for="periodo">Periodo de ingreso</label>
				<input type="text" id="periodo" value={admission.periodoIngreso} readonly />
			</div>

			<div class="label-input">
				<label for="fecha">Fecha de asignación</label>
				<input
					type="text"
					id="fecha"
					value={formatDate(admission.fechaAsignacion)}
					readonly
				/>
			</div>

			<div class="label-input">
				<label for="ano">Año</label>
				<input type="text" id="ano" value={admission.ano} readonly />
			</div>

			<div class="label-input">
				<label for="proceso">Proceso</label>
				<input type="text" id="proceso" value={admission.proceso} readonly />
			</div>
		</div>
	</div>

	<div class="div-card div-blue">
		<h2>Campos generados para planilla</h2>
		<div class="div-blue-inside">
			<div class="admision-details-flex2">
				<div class="label-input">
					<label for="fecha-mat">Fecha Matrícula</label>
					<input type="text" id="fecha-mat" value={planillaFields.fechaMat} readonly />
				</div>

				<div class="label-input">
					<label for="propio">Propio</label>
					<input type="text" id="propio" value={planillaFields.propio} readonly />
				</div>

				<div class="label-input">
					<label for="planilla">Planilla</label>
					<input type="text" id="planilla" value={planillaFields.planilla} readonly />
				</div>

				<div class="label-input">
					<label for="mod">Modalidad (Mod)</label>
					<input type="text" id="mod" value={planillaFields.mod} readonly />
				</div>

				<div class="label-input">
					<label for="prog">Programa (Prog)</label>
					<input type="text" id="prog" value={planillaFields.prog} readonly />
				</div>

				<div class="label-input">
					<label for="estadisticas">Estadísticas</label>
					<input type="text" id="estadisticas" value={planillaFields.estadisticas} readonly />
				</div>

				<div class="label-input">
					<label for="activo">Activo</label>
					<input type="text" id="activo" value={planillaFields.activo} readonly />
				</div>

				<div class="label-input">
					<label for="condicion">Condición</label>
					<input type="text" id="condicion" value={planillaFields.condicion} readonly />
				</div>
			</div>

			<div class="card-actions">
				{#if can(data.user, 'planillas.generate') && !processing}
					<form
						method="POST"
						action={resolve(`/digaipe/generacion-planilla/${admission.id}/pdf`)}
						target="_blank"
					>
						<button type="submit">Generar planilla PDF</button>
					</form>
					{:else}
					<a
					href={resolve(`/digaipe/generacion-planilla/${admission.id}/pdf`)}
					target="_blank"
					rel="noreferrer" class='btn-secondary'>Reimprimir PDF</a
				>
				{/if}
				
			</div>
		</div>
	</div>
</div>

<style>
	.main-container-generacion-planilla {
		display: flex;
		gap: 2em;
	}
	.main-container-generacion-planilla .div-card {
		flex: 1;
	}
	.admision-details-flex,
	.admision-details-flex2 {
		display: flex;
		flex-wrap: wrap;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 10px;
		justify-content: space-around;
	}
	.label-input input[readonly] {
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

	a.btn-submit {
		padding: 1em;
		border: 1px solid;
		border-radius: 8px;
		background: var(--ula-blue);
		color: white;
	}
	.div-white h2 {
		font-size: 20px;
		color: #1e293b;
		margin-top: 0;
		margin-bottom: 20px;
		font-weight: 700;
		border-left: 4px solid #0033a0;
		padding-left: 10px;
	}
	.div-blue {
		background-color: var(--ula-blue);
	}
	.div-blue-inside {
		border-radius: 8px;
		background: white;
		padding: 1.5rem;
	}
	.div-blue h2 {
		font-size: 20px;
		color: #ffffff;
		margin-top: 0;
		margin-bottom: 20px;
		font-weight: 700;
		border-left: 4px solid white;
		padding-left: 10px;
	}
	.div-card {
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		border-radius: 8px;
		padding: 20px;
		gap: 0.5rem;
	}
	.card-actions {
		text-align: center;
		margin-top: 1.5em;
	}
</style>
