<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';
	//PARA TODA LA PAGINA.. THEME
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="layout-wrapper">
	<header class="site-header">
		<div class="logo"><img src="/src/lib/assets/ULA_Logo_big.png" alt="Logo" /></div>

		<a id="menu-icon" class="menu-icon">
			<i class="fa fa-bars"></i>
		</a>

		<nav id="navigation-bar" class="nav-bar">
			<ul class="main-menu">
				<li><a href={resolve('/')}>Inicio</a></li>
				<li><a href={resolve('/digaipe/estadisticas')}>Estadísticas</a></li>
				<li class="menu-dropdown">
					<a href="#" class="active">Admisiones</a>
					<ul>
						<li><a href={resolve('/digaipe/admisiones')}>Admisiones</a></li>
						<li><a href={resolve('/digaipe/procesos-adm')}>Procesos de Admision</a></li>
					</ul>
				</li>
				<li><a href={resolve('/digaipe/generacion-planilla')}> Generacion de planilla </a></li>
				<li><a href={resolve('/digaipe/revision-documentos')}>Revisión de documentos</a></li>
				<li class="menu-dropdown">
					<a href="#"> Listas </a>
					<ul>
						<li><a href={resolve('/digaipe/carreras')}>Carreras</a></li>
						<li><a href={resolve('/digaipe/modalidades-adm')}>Modalidades Adm</a></li>
					</ul>
				</li>
				<li><a href={resolve('/ayuda')}>Ayuda</a></li>
				{#if page.data.user?.role === 'admin'}
					<li><a href={resolve('/digaipe/admin')}>Administración</a></li>
				{/if}
			</ul>
		</nav>
	</header>

	<main class="main-content">
		{@render children()}
	</main>


	<footer class="footer">
        <div class="footer-content">
            <p>Universidad de Los Andes (ULA) - Venezuela</p>
            <p>Sistema Interno DIGAIPE</p>
            <p class="footer-copy">&copy; 2026 Todos los derechos reservados.</p>
        </div>
    </footer>
</div>
