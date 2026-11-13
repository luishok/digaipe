<script lang="ts">
	import docIcon from '$lib/assets/icons/digaipe-doc.svg';
	import graphIcon from '$lib/assets/icons/digaipe-graph.svg';
	import listIcon from '$lib/assets/icons/digaipe-list.svg';
	import personPlusIcon from '$lib/assets/icons/digaipe-person-plus.svg';
	import { resolve } from '$app/paths';
	import { formatDate } from '$lib/dates';
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
				
				<!-- Tarjeta de Actividad Reciente / Últimos Aspirantes -->
				{#if can(data.user, 'admissions.view')}
				<div class="info-card">
					<div class="info-card-header">
						<h2>📋 Últimos Aspirantes Registrados</h2>
						<span class="live-badge">En vivo</span>
					</div>
					<div class="aspirantes-list">
						{#if data.ultimosAspirantes.length === 0}
							<p class="empty-text">No hay registros recientes.</p>
						{:else}
							<ul>
								{#each data.ultimosAspirantes as asp (asp.id)}
									<li class="aspirante-item">
										<div class="aspirante-info">
											<strong>{asp.nombre}</strong>
											<small>{asp.cedula} • {asp.carrera}</small>
										</div>
										<span class="aspirante-time">{formatDate(asp.fechaAsignacion)}</span>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
					<div class="info-card-footer">
						<a href={resolve('/digaipe/admisiones')} class="text-link">Ver todos los aspirantes &rarr;</a>
					</div>
				</div>
				{/if}

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
								<img src={listIcon} alt="Ayuda" class="card-icon" />
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
		background-color: #e2f8f0;
		color: #0d9488;
		font-size: 11px;
		font-weight: 600;
		padding: 3px 8px;
		border-radius: 20px;
	}

	.aspirantes-list ul {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.aspirante-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 10px;
		background: #f8fafc;
		border-radius: 8px;
		transition: background 0.2s;
	}

	.aspirante-item:hover {
		background: #f1f5f9;
	}

	.aspirante-info {
		display: flex;
		flex-direction: column;
	}

	.aspirante-info strong {
		font-size: 13px;
		color: #334155;
	}

	.aspirante-info small {
		font-size: 11px;
		color: #64748b;
	}

	.aspirante-time {
		font-size: 11px;
		color: #94a3b8;
		font-weight: 500;
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