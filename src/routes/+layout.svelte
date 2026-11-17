<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { afterNavigate } from '$app/navigation';
	import favicon from '$lib/assets/favicon.png';
	import logo from '$lib/assets/ULA_Logo_big.png';
	import '../app.css';
	import { can } from '$lib/permissions';

	let { children } = $props();
	const user = $derived(page.data.user);
	const pathname = $derived(page.url.pathname);

	let mobileMenuOpen = $state(false);
	let openSubmenus = $state<{ [key: string]: boolean }>({});

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}

	function toggleSubmenu(key: string) {
		openSubmenus[key] = !openSubmenus[key];
	}

	afterNavigate(() => {
		mobileMenuOpen = false;
		openSubmenus = {};
	});
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') closeMobileMenu(); }} />

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="layout-wrapper">
	<header class="site-header">
		<div class="header-left">
			<a href={resolve('/')} class="logo-link" onclick={closeMobileMenu}>
				<img src={logo} alt="Universidad de Los Andes" class="logo-img" />
			</a>
		</div>

		<!-- Navegación de Escritorio -->
		<nav class="desktop-nav" aria-label="Menú principal de navegación">
			<ul class="nav-list">
				{#if can(user, 'statistics.view')}
					<li>
						<a 
							href={resolve('/digaipe/estadisticas')} 
							class={pathname.startsWith('/digaipe/estadisticas') ? 'nav-link active' : 'nav-link'}
						>
							Estadísticas
						</a>
					</li>
				{/if}

				{#if can(user, 'admissions.view') || can(user, 'processes.view') || can(user, 'planillas.view') || can(user, 'documents.view')}
					<li class="nav-dropdown">
						<a 
							href={resolve('/digaipe/admisiones')} 
							class={pathname.startsWith('/digaipe/admisiones') || pathname.startsWith('/digaipe/procesos-adm') || pathname.startsWith('/digaipe/generacion-planilla') || pathname.startsWith('/digaipe/revision-documentos') ? 'nav-link dropdown-toggle active' : 'nav-link dropdown-toggle'}
						>
							<span>Admisiones</span>
							<svg class="chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
						</a>
						<ul class="dropdown-menu">
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
					<li class="nav-dropdown">
						<a 
							href={resolve('/digaipe/carreras')} 
							class={pathname.startsWith('/digaipe/carreras') || pathname.startsWith('/digaipe/modalidades-adm') ? 'nav-link dropdown-toggle active' : 'nav-link dropdown-toggle'}
						>
							<span>Parámetros</span>
							<svg class="chevron-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
						</a>
						<ul class="dropdown-menu">
							<li><a href={resolve('/digaipe/carreras')}>Carreras</a></li>
							<li><a href={resolve('/digaipe/modalidades-adm')}>Modalidades de Admisión</a></li>
						</ul>
					</li>
				{/if}

				{#if user}
					<li>
						<a 
							href={resolve('/ayuda')} 
							class={pathname.startsWith('/ayuda') ? 'nav-link active' : 'nav-link'}
						>
							Ayuda
						</a>
					</li>
				{/if}

				{#if can(user, 'users.manage') || can(user, 'audit.view')}
					<li>
						<a 
							href={resolve('/digaipe/admin')} 
							class={pathname.startsWith('/digaipe/admin') ? 'nav-link active' : 'nav-link'}
						>
							Administración
						</a>
					</li>
				{/if}
			</ul>
		</nav>

		<!-- Acciones a la derecha (Logout en desktop y botón Hamburguesa en móvil) -->
		<div class="header-right">
			{#if user}
				<div class="desktop-user-actions">
					<form action={resolve('/digaipe') + '?/signOut'} method="POST">
						<button type="submit" class="btn-logout" title="Cerrar sesión">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
								<polyline points="16 17 21 12 16 7"></polyline>
								<line x1="21" y1="12" x2="9" y2="12"></line>
							</svg>
							<span>Salir</span>
						</button>
					</form>
				</div>
			{/if}

			<!-- Botón Hamburguesa para Mobile -->
			<button 
				type="button" 
				class="mobile-menu-btn" 
				onclick={toggleMobileMenu} 
				aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
				aria-expanded={mobileMenuOpen}
			>
				{#if mobileMenuOpen}
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				{:else}
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="3" y1="6" x2="21" y2="6"></line>
						<line x1="3" y1="12" x2="21" y2="12"></line>
						<line x1="3" y1="18" x2="21" y2="18"></line>
					</svg>
				{/if}
			</button>
		</div>

		<!-- Panel / Menú Desplegable para Móviles -->
		{#if mobileMenuOpen}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="mobile-backdrop" onclick={closeMobileMenu}></div>
			<div class="mobile-drawer">
				<nav class="mobile-nav" aria-label="Navegación móvil">
					<ul class="mobile-nav-list">
						{#if can(user, 'statistics.view')}
							<li class="mobile-nav-item">
								<a 
									href={resolve('/digaipe/estadisticas')} 
									class={pathname.startsWith('/digaipe/estadisticas') ? 'mobile-link active' : 'mobile-link'}
									onclick={closeMobileMenu}
								>
									Estadísticas
								</a>
							</li>
						{/if}

						{#if can(user, 'admissions.view') || can(user, 'processes.view') || can(user, 'planillas.view') || can(user, 'documents.view')}
							<li class="mobile-nav-item has-submenu">
								<div class="mobile-submenu-header">
									<a 
										href={resolve('/digaipe/admisiones')} 
										class={pathname.startsWith('/digaipe/admisiones') || pathname.startsWith('/digaipe/procesos-adm') || pathname.startsWith('/digaipe/generacion-planilla') || pathname.startsWith('/digaipe/revision-documentos') ? 'mobile-link active' : 'mobile-link'}
										onclick={closeMobileMenu}
									>
										Admisiones
									</a>
									<button 
										type="button" 
										class="mobile-expand-btn {openSubmenus.admissions ? 'open' : ''}" 
										onclick={() => toggleSubmenu('admissions')}
										aria-label="Desplegar opciones de Admisiones"
									>
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
									</button>
								</div>
								{#if openSubmenus.admissions}
									<ul class="mobile-sublist">
										{#if can(user, 'admissions.view')}
											<li><a href={resolve('/digaipe/admisiones')} onclick={closeMobileMenu}>Gestión de Aspirantes</a></li>
										{/if}
										{#if can(user, 'processes.view')}
											<li><a href={resolve('/digaipe/procesos-adm')} onclick={closeMobileMenu}>Procesos de Admisión</a></li>
										{/if}
										{#if can(user, 'planillas.view')}
											<li><a href={resolve('/digaipe/generacion-planilla')} onclick={closeMobileMenu}>Generación de Planilla</a></li>
										{/if}
										{#if can(user, 'documents.view')}
											<li><a href={resolve('/digaipe/revision-documentos')} onclick={closeMobileMenu}>Revisión de Documentos</a></li>
										{/if}
									</ul>
								{/if}
							</li>
						{/if}

						{#if can(user, 'catalogs.view')}
							<li class="mobile-nav-item has-submenu">
								<div class="mobile-submenu-header">
									<a 
										href={resolve('/digaipe/carreras')} 
										class={pathname.startsWith('/digaipe/carreras') || pathname.startsWith('/digaipe/modalidades-adm') ? 'mobile-link active' : 'mobile-link'}
										onclick={closeMobileMenu}
									>
										Parámetros
									</a>
									<button 
										type="button" 
										class="mobile-expand-btn {openSubmenus.catalogs ? 'open' : ''}" 
										onclick={() => toggleSubmenu('catalogs')}
										aria-label="Desplegar opciones de Parámetros"
									>
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
									</button>
								</div>
								{#if openSubmenus.catalogs}
									<ul class="mobile-sublist">
										<li><a href={resolve('/digaipe/carreras')} onclick={closeMobileMenu}>Carreras</a></li>
										<li><a href={resolve('/digaipe/modalidades-adm')} onclick={closeMobileMenu}>Modalidades de Admisión</a></li>
									</ul>
								{/if}
							</li>
						{/if}

						{#if user}
							<li class="mobile-nav-item">
								<a 
									href={resolve('/ayuda')} 
									class={pathname.startsWith('/ayuda') ? 'mobile-link active' : 'mobile-link'}
									onclick={closeMobileMenu}
								>
									Ayuda
								</a>
							</li>
						{/if}

						{#if can(user, 'users.manage') || can(user, 'audit.view')}
							<li class="mobile-nav-item">
								<a 
									href={resolve('/digaipe/admin')} 
									class={pathname.startsWith('/digaipe/admin') ? 'mobile-link active' : 'mobile-link'}
									onclick={closeMobileMenu}
								>
									Administración
								</a>
							</li>
						{/if}
					</ul>
				</nav>

				{#if user}
					<div class="mobile-user-footer">
						<form action={resolve('/digaipe') + '?/signOut'} method="POST" class="mobile-logout-form">
							<button type="submit" class="mobile-logout-btn">
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
									<polyline points="16 17 21 12 16 7"></polyline>
									<line x1="21" y1="12" x2="9" y2="12"></line>
								</svg>
								<span>Cerrar sesión</span>
							</button>
						</form>
					</div>
				{/if}
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

<style>
	.layout-wrapper {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	/* Header bar */
	.site-header {
		background-color: var(--ula-blue, #0033a0);
		height: 64px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 1.5rem;
		position: sticky;
		top: 0;
		z-index: 1000;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
	}

	.header-left {
		display: flex;
		align-items: center;
	}

	.logo-link {
		display: flex;
		align-items: center;
		text-decoration: none;
	}

	.logo-img {
		height: 42px;
		width: auto;
		object-fit: contain;
		display: block;
	}

	/* Navegación de Escritorio */
	.desktop-nav {
		display: flex;
		align-items: center;
		height: 100%;
	}

	.nav-list {
		display: flex;
		align-items: center;
		gap: 4px;
		list-style: none;
		margin: 0;
		padding: 0;
		height: 100%;
	}

	.nav-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: #ffffff;
		padding: 8px 14px;
		text-decoration: none;
		font-size: 0.95rem;
		font-weight: 500;
		border-radius: 6px;
		transition: background-color 0.2s ease, color 0.2s ease;
		cursor: pointer;
	}

	.nav-link:hover {
		background-color: rgba(255, 255, 255, 0.15);
		color: #ffffff;
		text-decoration: none;
	}

	.nav-link.active {
		background-color: rgba(255, 255, 255, 0.2);
		font-weight: 600;
	}

	/* Menú desplegable en Escritorio */
	.nav-dropdown {
		position: relative;
		height: 100%;
		display: flex;
		align-items: center;
	}

	.chevron-icon {
		transition: transform 0.2s ease;
	}

	.nav-dropdown:hover .chevron-icon {
		transform: rotate(180deg);
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% - 4px);
		left: 0;
		background-color: #002266;
		min-width: 230px;
		list-style: none;
		margin: 0;
		padding: 6px 0;
		border-radius: 8px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
		opacity: 0;
		visibility: hidden;
		transform: translateY(8px);
		transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s;
		z-index: 1010;
	}

	.nav-dropdown:hover .dropdown-menu,
	.nav-dropdown:focus-within .dropdown-menu {
		opacity: 1;
		visibility: visible;
		transform: translateY(0);
	}

	.dropdown-menu li a {
		display: block;
		padding: 10px 18px;
		color: #ffffff;
		font-size: 0.9rem;
		text-decoration: none;
		transition: background-color 0.2s ease, padding-left 0.2s ease;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	}

	.dropdown-menu li:last-child a {
		border-bottom: none;
	}

	.dropdown-menu li a:hover {
		background-color: var(--ula-blue, #0033a0);
		padding-left: 24px;
		color: #ffffff;
		text-decoration: none;
	}

	/* Header derecho y logout */
	.header-right {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.desktop-user-actions {
		display: flex;
		align-items: center;
	}

	.btn-logout {
		background: rgba(255, 255, 255, 0.12);
		border: 1px solid rgba(255, 255, 255, 0.25);
		color: #ffffff;
		padding: 7px 14px;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-logout:hover {
		background-color: #dc2626;
		border-color: #dc2626;
		color: #ffffff;
	}

	/* Botón menú mobile */
	.mobile-menu-btn {
		display: none;
		background: transparent;
		border: none;
		color: #ffffff;
		padding: 8px;
		border-radius: 6px;
		cursor: pointer;
		align-items: center;
		justify-content: center;
		transition: background-color 0.2s ease;
	}

	.mobile-menu-btn:hover {
		background-color: rgba(255, 255, 255, 0.15);
	}

	/* Modal / Drawer para Mobile */
	.mobile-backdrop {
		position: fixed;
		inset: 0;
		top: 64px;
		background-color: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(2px);
		z-index: 998;
	}

	.mobile-drawer {
		position: fixed;
		top: 64px;
		left: 0;
		width: 100%;
		max-height: calc(100vh - 64px);
		overflow-y: auto;
		background-color: #002266;
		border-bottom: 2px solid var(--ula-blue, #0033a0);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
		z-index: 999;
		display: flex;
		flex-direction: column;
		animation: slideDown 0.25s ease-out;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.mobile-nav-list {
		list-style: none;
		margin: 0;
		padding: 8px 0;
		display: flex;
		flex-direction: column;
	}

	.mobile-nav-item {
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.mobile-link {
		display: flex;
		align-items: center;
		padding: 14px 20px;
		color: #ffffff;
		font-size: 1rem;
		font-weight: 500;
		text-decoration: none;
		transition: background-color 0.15s ease;
	}

	.mobile-link:hover,
	.mobile-link.active {
		background-color: rgba(255, 255, 255, 0.12);
		text-decoration: none;
	}

	.mobile-submenu-header {
		display: flex;
		align-items: stretch;
		justify-content: space-between;
	}

	.mobile-submenu-header .mobile-link {
		flex: 1;
	}

	.mobile-expand-btn {
		background: transparent;
		border: none;
		color: #ffffff;
		padding: 0 20px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.2s ease, background-color 0.2s ease;
		border-left: 1px solid rgba(255, 255, 255, 0.08);
	}

	.mobile-expand-btn:hover {
		background-color: rgba(255, 255, 255, 0.1);
	}

	.mobile-expand-btn.open svg {
		transform: rotate(180deg);
	}

	.mobile-sublist {
		list-style: none;
		margin: 0;
		padding: 0;
		background-color: rgba(0, 0, 0, 0.2);
	}

	.mobile-sublist li a {
		display: block;
		padding: 12px 20px 12px 36px;
		color: #e2e8f0;
		font-size: 0.92rem;
		text-decoration: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		transition: background-color 0.15s ease, padding-left 0.15s ease;
	}

	.mobile-sublist li a:hover {
		background-color: rgba(255, 255, 255, 0.1);
		padding-left: 42px;
		color: #ffffff;
		text-decoration: none;
	}

	.mobile-user-footer {
		padding: 16px 20px;
		background-color: rgba(0, 0, 0, 0.3);
		border-top: 1px solid rgba(255, 255, 255, 0.1);
	}

	.mobile-logout-form {
		margin: 0;
	}

	.mobile-logout-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		background-color: rgba(220, 38, 38, 0.2);
		border: 1px solid rgba(220, 38, 38, 0.5);
		color: #fca5a5;
		padding: 12px;
		border-radius: 8px;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.mobile-logout-btn:hover {
		background-color: #dc2626;
		color: #ffffff;
	}

	/* Reglas Responsive */
	@media (max-width: 1024px) {
		.desktop-nav {
			display: none;
		}

		.desktop-user-actions {
			display: none;
		}

		.mobile-menu-btn {
			display: flex;
		}

		.site-header {
			padding: 0 1rem;
		}

		.logo-img {
			height: 38px;
		}
	}
</style>
