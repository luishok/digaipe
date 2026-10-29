<script lang="ts">
	import docIcon from '$lib/assets/icons/digaipe-doc.svg';
	import graphIcon from '$lib/assets/icons/digaipe-graph.svg';
	import listIcon from '$lib/assets/icons/digaipe-list.svg';
	import personPlusIcon from '$lib/assets/icons/digaipe-person-plus.svg';
	import { can, parseRoles } from '$lib/permissions';

	let { data } = $props();
</script>
<div class="container">
	<div class="welcome-banner">
		<h1>¡Bienvenido!</h1>
	</div>

	{#if parseRoles(data.user.role).length === 0}
		<p class="instruction-text">
			Su cuenta no tiene roles asignados. Solicite acceso a un administrador.
		</p>
	{:else}
		<p class="instruction-text">Por favor, seleccione una opción para continuar:</p>
	{/if}

	<div class="cards-grid">
		{#if can(data.user, 'statistics.view')}
		<div class="card">
			<div class="card-body">
				<img src={graphIcon} alt="Estadísticas" class="card-icon" />
				<h2 class="card-title">Estadísticas</h2>
			</div>
			<a href="/digaipe/estadisticas" class="card-btn">Continuar</a>
		</div>
		{/if}
		{#if can(data.user, 'admissions.view')}
		<div class="card">
			<div class="card-body">
				<img
					src={personPlusIcon}
					alt="Admisiones"
					class="card-icon"
				/>
				<h2 class="card-title">Admisiones</h2>
			</div>
			<a href="/digaipe/admisiones" class="card-btn">Continuar</a>
		</div>
		{/if}

		{#if can(data.user, 'planillas.view')}
		<div class="card">
			<div class="card-body">
				<img src={docIcon} alt="Planillas" class="card-icon" />
				<h2 class="card-title">Generación de Planillas</h2>
			</div>
			<a href="/digaipe/generacion-planilla" class="card-btn">Continuar</a>
		</div>
		{/if}

		{#if can(data.user, 'catalogs.view')}
		<div class="card">
			<div class="card-body">
				<img src={listIcon} alt="Listas" class="card-icon" />
				<h2 class="card-title">Listas</h2>
			</div>
			<a href="/digaipe/carreras" class="card-btn">Continuar</a>
		</div>
		{/if}

		
	</div>
</div>


<style>
	* {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
	}

	body {
		background-color: #f4f6f9;
		padding: 40px 20px;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		text-align: center;
	}

	.welcome-banner {
		background-color: #d1dcfd;
		color: #000;
		padding: 24px;
		border-radius: 12px;
		margin-bottom: 30px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
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

	.instruction-text {
		color: #444;
		font-size: 16px;
		margin-bottom: 35px;
	}

	/* Grid para las 4 tarjetas */
	.cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 20px;
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
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
		min-height: 260px;
	}

	.card:hover {
		transform: translateY(-5px);
		box-shadow: 0 8px 18px rgba(0, 0, 0, 0.12);
	}

	/* Contenido interno (Icono y Título) */
	.card-body {
		padding: 30px 20px;
		display: flex;
		flex-direction: column;
		align-items: flex-start; /* Alineado a la izquierda como la imagen original */
		text-align: left;
		flex-grow: 1;
	}

	.card-icon {
		width: 60px;
		height: 60px;
		margin-bottom: 20px;
		object-fit: contain;
	}

	.card-title {
		font-size: 18px;
		font-weight: 700;
		color: #1e293b;
		line-height: 1.3;
	}

	/* Botón Continuar inferior */
	.card-btn {
		background-color: #0038df; /* Azul del botón */
		color: #ffffff;
		text-decoration: none;
		padding: 12px;
		font-size: 14px;
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
		content: '➔'; /* Flecha simple, puedes cambiarla por un icono SVG o FontAwesome */
		font-size: 12px;
	}
</style>
