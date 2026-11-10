<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.png';
	import logo from '$lib/assets/ULA_Logo_big.png';
	import '../app.css';
	import { can } from '$lib/permissions';
	//PARA TODA LA PAGINA.. THEME
	let { children } = $props();
	const user = $derived(page.data.user);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="layout-wrapper">
	<header class="site-header">
		<a href={resolve('/')}><div class="logo"><img src={logo} alt="Logo" /></div></a>

		<a  id="menu-icon" class="menu-icon">
			<i class="fa fa-bars"></i>
		</a>

		<nav id="navigation-bar" class="nav-bar">
			<ul class="main-menu">

                {#if can(user, 'statistics.view')}
                    <li><a href={resolve('/digaipe/estadisticas')}>Estadísticas</a></li>
                {/if}

                {#if can(user, 'admissions.view') || can(user, 'processes.view') || can(user, 'planillas.view') || can(user, 'documents.view')}
                    <li class="menu-dropdown">
                        <a href={resolve('/digaipe/admisiones')} class="active">Admisiones</a>
                        <ul>
                            {#if can(user, 'admissions.view')}
                                <li><a href={resolve('/digaipe/admisiones')}>Gestión de Aspirantes</a></li>
                            {/if}
                            {#if can(user, 'processes.view')}
                                <li><a href={resolve('/digaipe/procesos-adm')}>Procesos de Admisión</a></li>
                            {/if}
                            {#if can(user, 'planillas.view')}
                                <li><a href={resolve('/digaipe/generacion-planilla')}>Generación de Planilla</a></li>
                            {/if}
                            {#if can(user, 'documents.view')}
                                <li><a href={resolve('/digaipe/revision-documentos')}>Revisión de Documentos</a></li>
                            {/if}
                        </ul>
                    </li>
                {/if}

                {#if can(user, 'catalogs.view')}
                    <li class="menu-dropdown">
                        <a href="#">Parametros</a>
                        <ul>
                            <li><a href={resolve('/digaipe/carreras')}>Carreras</a></li>
                            <li><a href={resolve('/digaipe/modalidades-adm')}>Modalidades de Admisión</a></li>
                        </ul>
                    </li>
                {/if}

                {#if user}
                    <li><a href={resolve('/ayuda')}>Ayuda</a></li>
                {/if}
                {#if can(user, 'users.manage') || can(user, 'audit.view')}
                    <li><a href={resolve('/digaipe/admin')}>Administración</a></li>
                {/if}

            </ul>

			
		</nav>
		{#if user}
                <div class="user-actions">
                    <form action={resolve('/digaipe') + '?/signOut'} method="POST" class="logout-form">
                        <button type="submit" class="btn-logout" title="Cerrar sesión">
                            <i class="fa fa-sign-out-alt"></i> Salir
                        </button>
                    </form>
                </div>
            {/if}
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
