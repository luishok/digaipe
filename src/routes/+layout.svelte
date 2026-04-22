<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import "../app.css";
	//PARA TODA LA PAGINA.. THEME
	let { children } = $props();
</script>
<svelte:head>
    <link rel="icon" href={favicon} />
</svelte:head>

<div class="layout-wrapper">
    
    <header class="site-header">
        <div class="logo"><img src='/src/lib/assets/ULA_Logo_big.png' alt="Logo"></div>
       
		<a id="menu-icon" class="menu-icon">
        <i class="fa fa-bars"></i>
	    </a>

		<nav id="navigation-bar" class="nav-bar">
        <ul class="main-menu">
            <li><a href="/">Inicio</a></li>
            <li><a href="/contacto">Estadisticas</a></li>
			<li><a href="#" class="active">Carga de datos</a></li>
			<li><a href="#"> Generacion de planilla </a></li>
			<li class='menu-dropdown'><a href="#"> Listas </a>
                <ul>
                    <li><a href='/digaipe/carreras'>Carreras</a></li>
                    <li><a href='#'>Materias</a></li>
                </ul>
            
            </li>
			<li><a href="#">Abouts</a></li>
        </ul>

		</nav>

    </header>

    <main class="main-content">
        {@render children()}
    </main>

    <footer class="site-footer">
        <p>&copy; 2026. Todos los derechos reservados.</p>
    </footer>

</div>


