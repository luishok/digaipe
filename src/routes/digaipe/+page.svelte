<script lang="ts">
	import docIcon from '$lib/assets/icons/digaipe-doc.svg';
	import graphIcon from '$lib/assets/icons/digaipe-graph.svg';
	import listIcon from '$lib/assets/icons/digaipe-list.svg';
	import personPlusIcon from '$lib/assets/icons/digaipe-person-plus.svg';
	import { resolve } from '$app/paths';
	import { can, parseRoles } from '$lib/permissions';

	let { data } = $props();
</script>

<div class="container">
	<!-- Banner de Bienvenida -->
	<div class="welcome-banner">
		<h1>¡Bienvenido al Panel DIGAIPE!</h1>
		{#if parseRoles(data.user.role).length === 0}
			<p>Su cuenta no tiene roles asignados. Solicite acceso a un administrador.</p>
		{:else}
			<p>Sistema centralizado de admisiones y control académico.</p>
		{/if}
	</div>

	{#if parseRoles(data.user.role).length > 0}
		<!-- Layout Dividido -->
		<div class="dashboard-layout">
			
			<!-- COLUMNA IZQUIERDA: El Pulso del Sistema (Actividad reciente y Alertas) -->
			<div class="pulse-column">
				
				<!-- Tarjeta de Próximos Procesos de Admisión -->
				<div class="info-card">
					<div class="info-card-header">
						<h2>📅 Próximos Procesos de Admisión</h2>
						<span class="live-badge">Cronograma</span>
					</div>
					<div class="procesos-list">
						{#if data.proximosProcesos.length === 0}
							<p class="empty-text">No hay procesos de admisión programados próximamente.</p>
						{:else}
							<ul>
								{#each data.proximosProcesos as proc (proc.fullCode)}
									<li class="proceso-item">
										<div class="proceso-left">
											<span class="proceso-code">{proc.fullCode}</span>
											<span class="proceso-date">Fecha: {proc.formattedDate}</span>
										</div>
										<div class="proceso-status">
											{#if proc.isToday}
												<span class="badge-status badge-today">Hoy</span>
											{:else if proc.isUpcoming}
												<span class="badge-status badge-upcoming">{proc.daysLeftText}</span>
											{:else}
												<span class="badge-status badge-scheduled">Programado</span>
											{/if}
										</div>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
					{#if can(data.user, 'processes.view')}
						<div class="info-card-footer">
							<a href={resolve('/digaipe/procesos-adm')} class="text-link">Ver todos los procesos &rarr;</a>
						</div>
					{/if}
				</div>

				<!-- Alerta o Aviso del Departamento -->
				<div class="alert-box">
					<h3>📢 Aviso Importante</h3>
					<p>El proceso de validación de documentos para el periodo actual sigue abierto. Asegúrese de revisar la cola de pendientes.</p>
				</div>

			</div>

			<!-- COLUMNA DERECHA: Accesos de Acción Directa (Módulos y Tareas Frecuentes) -->
			<div class="actions-column">
				<h2 class="section-heading">Accesos Rápidos</h2>
				
				<div class="cards-grid">

					{#if can(data.user, 'planillas.view')}
					<a href={resolve('/digaipe/generacion-planilla')}><div class="card">
						<div class="card-body">
							<img src={docIcon} alt="Planillas" class="card-icon" />
							<h3 class="card-title">Generación de Planillas</h3>
						</div>
						<span  class="card-btn">Continuar</span>
					</div>
					</a>
					{/if}
					{#if can(data.user, 'statistics.view')}
					<a href={resolve('/digaipe/estadisticas')}>
						<div class="card">
							<div class="card-body">
								<img src={graphIcon} alt="Estadísticas" class="card-icon" />
								<h3 class="card-title">Estadísticas</h3>
							</div>
							<span class="card-btn">Continuar</span>
						</div>
					</a>
					{/if}

					{#if can(data.user, 'admissions.view')}
					<a href={resolve('/digaipe/admisiones')}>
						<div class="card">
							<div class="card-body">
								<img src={personPlusIcon} alt="Admisiones" class="card-icon" />
								<h3 class="card-title">Admisiones</h3>
							</div>
							<span class="card-btn">Continuar</span>
						</div>
					</a>
					{/if}

					<a href={resolve('/ayuda')}>
						<div class="card">
							<div class="card-body">
								<!-- <img src={listIcon} alt="Ayuda" class="card-icon" /> -->
								 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" height="45px" width="45px" style='margin-bottom:15px;' fill="#000"><path d="M25.33,34.5q0.46-0.47 0.46-1.13t-0.46-1.13T24.2,31.77t-1.14,0.47t-0.47,1.13t0.47,1.13t1.14,0.47t1.13-0.47Zm-2.51-6.4h2.28q0.02-1.22 0.38-2.2t1.85-2.24q1.49-1.32 2.12-2.49t0.63-2.58q0-2.47-1.62-3.99t-4.18-1.52q-2.22,0-3.93,1.14t-2.52,2.98l2.09,0.81q0.57-1.34 1.62-2.09t2.59-0.75q1.83,0 2.87,1t1.03,2.47q0,1.08-0.61,2.01t-1.77,1.92q-1.46,1.3-2.15,2.57T22.82,28.1ZM24,43q-3.91,0-7.37-1.5t-6.05-4.09T6.5,31.37T5,24q0-3.94 1.5-7.41t4.09-6.03T16.63,6.5T24,5q3.94,0 7.41,1.5t6.03,4.06t4.06,6.03T43,24q0,3.91-1.5,7.37t-4.06,6.05T31.41,41.5T24,43Zm-0-2.27q6.98,0 11.86-4.89T40.73,24q0-6.98-4.87-11.86T24,7.27q-6.95,0-11.84,4.87T7.27,24q0,6.95 4.89,11.84T24,40.73ZM24,24Z"/></svg>
								<h3 class="card-title">Ayuda</h3>
							</div>
							<span  class="card-btn">Continuar</span>
						</div>
					</a>
					
				</div>

			</div>

		</div>
	{/if}
</div>

<style>
	* {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
	}

	.container {
		max-width: 1250px;
		margin: 0 auto;
		padding: 20px;
		text-align: left;
	}

	.welcome-banner {
		background-color: #d1dcfd;
		color: #000;
		padding: 24px;
		border-radius: 12px;
		margin-bottom: 25px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
		text-align: center;
	}

	.welcome-banner h1 {
		font-size: 24px;
		font-weight: 700;
		margin-bottom: 4px;
	}

	.welcome-banner p {
		font-size: 14px;
		color: #333;
	}

	/* Layout de Panel Dividido */
	.dashboard-layout {
		display: grid;
		grid-template-columns: 1fr 1.2fr; /* Columna izquierda un poco más compacta, derecha para las cards */
		gap: 25px;
		align-items: start;
	}

	@media (max-width: 900px) {
		.dashboard-layout {
			grid-template-columns: 1fr; /* En pantallas pequeñas se apilan */
		}
	}

	/* Columna Izquierda (Pulso) */
	.pulse-column {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.info-card {
		background: #ffffff;
		border-radius: 12px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 15px;
	}

	.info-card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid #edf2f7;
		padding-bottom: 10px;
	}

	.info-card-header h2 {
		font-size: 16px;
		color: #1e293b;
		font-weight: 700;
	}

	.live-badge {
		background-color: #e0f2fe;
		color: #0369a1;
		font-size: 11px;
		font-weight: 600;
		padding: 3px 8px;
		border-radius: 20px;
	}

	.procesos-list ul {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-height: 250px;
		overflow-y: auto;
	}

	.proceso-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 14px;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		transition: background 0.2s, border-color 0.2s;
	}

	.proceso-item:hover {
		background: #f1f5f9;
		border-color: #cbd5e1;
	}

	.proceso-left {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.proceso-code {
		font-family: monospace, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 14px;
		font-weight: 700;
		color: var(--ula-blue);
		background: #eef2ff;
		padding: 3px 8px;
		border-radius: 6px;
		border: 1px solid #c7d2fe;
		display: inline-block;
		width: fit-content;
	}

	.proceso-date {
		font-size: 12px;
		color: #64748b;
		font-weight: 500;
	}

	.proceso-status {
		display: flex;
		align-items: center;
	}

	.badge-status {
		font-size: 11px;
		font-weight: 600;
		padding: 4px 10px;
		border-radius: 12px;
		display: inline-block;
		white-space: nowrap;
	}

	.badge-today {
		background-color: #dcfce7;
		color: #15803d;
		border: 1px solid #bbf7d0;
	}

	.badge-upcoming {
		background-color: #e0f2fe;
		color: #0369a1;
		border: 1px solid #bae6fd;
	}

	.badge-scheduled {
		background-color: #f1f5f9;
		color: #475569;
		border: 1px solid #e2e8f0;
	}

	.empty-text {
		font-size: 13px;
		color: #64748b;
		padding: 10px 0;
		text-align: center;
	}

	.info-card-footer {
		text-align: right;
		border-top: 1px solid #edf2f7;
		padding-top: 8px;
	}

	.text-link {
		font-size: 13px;
		color: var(--ula-blue);
		text-decoration: none;
		font-weight: 600;
	}

	.text-link:hover {
		text-decoration: underline;
	}

	.alert-box {
		background-color: #fffbeb;
		border-left: 4px solid #f59e0b;
		padding: 16px;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
	}

	.alert-box h3 {
		font-size: 14px;
		color: #b45309;
		margin-bottom: 6px;
		font-weight: 700;
	}

	.alert-box p {
		font-size: 13px;
		color: #78350f;
		line-height: 1.4;
	}

	/* Columna Derecha (Accesos) */
	.actions-column {
		display: flex;
		flex-direction: column;
		gap: 15px;
	}

	.section-heading {
		font-size: 16px;
		color: #1e293b;
		font-weight: 700;
		margin-bottom: 2px;
	}

	/* Grid de Tarjetas (Ajustado a 2 columnas internas para que luzca ordenado) */
	.cards-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 15px;
	}

	@media (max-width: 500px) {
		.cards-grid {
			grid-template-columns: 1fr;
		}
	}

	/* Estilo de la Tarjeta */
	.card {
		background: #ffffff;
		border-radius: 12px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		overflow: hidden;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
		min-height: 200px;
	}

	.card:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 18px rgba(0, 0, 0, 0.12);
	}

	.card-body {
		padding: 20px;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		text-align: left;
		flex-grow: 1;
	}

	.card-icon {
		width: 45px;
		height: 45px;
		margin-bottom: 15px;
		object-fit: contain;
	}

	.card-title {
		font-size: 16px;
		font-weight: 700;
		color: #1e293b;
		line-height: 1.3;
	}

	.card-btn {
		background-color: var(--ula-blue);
		color: #ffffff;
		text-decoration: none;
		padding: 10px;
		font-size: 13px;
		font-weight: 600;
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 8px;
		transition: background-color 0.2s ease;
		width: 100%;
	}

	.card-btn:hover {
		background-color: #002bb3;
	}

	.card-btn::after {
		content: '➔';
		font-size: 11px;
	}
</style>
