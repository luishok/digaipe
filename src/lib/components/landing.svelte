<script>
    // Aquí puedes importar componentes futuros, como el logo de la institución
    // import Logo from '$lib/components/Logo.svelte';
</script>

<svelte:head>
    <title>Inicio | Sistema DIGIAPE</title>
</svelte:head>

<main class="landing-container">
    <header class="hero">
        <h1>Sistema de Gestión <span>DIGIAPE</span></h1>
        <p class="subtitle">Plataforma de Control de Admisiones y Estadísticas</p>
    </header>

    <section class="card-info">
        <div class="icon">🔒</div>
        <h2>Acceso Restringido</h2>
        <p>
            Esta es una página de <strong>uso personal y exclusivo para DIGIAPE</strong>. 
        </p>
        <p>
            Este sistema centralizado permite la administración eficiente del proceso de admisiones, la consulta de datos estadísticos y el registro detallado de auditorías operativas para el servicio.
        </p>
        
        <div class="actions">
            <!-- Actualiza los href hacia las rutas correspondientes de tu sistema -->
            <a href="/login" class="btn btn-primary">Iniciar Sesión</a>
        </div>
    </section>

    <footer>
        <p>&copy; {new Date().getFullYear()} Proyecto de Servicio Comunitario para DIGIAPE.</p>
    </footer>
</main>

<style>
    /* Reset básico por si no tienes un layout global configurado aún */
    :global(body, html) {
        margin: 0;
        padding: 0;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        background-color: #f8fafc;
        color: #334155;
    }

    .landing-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 2rem;
        text-align: center;
    }

    .hero {
        margin-bottom: 2rem;
    }



    .subtitle {
        font-size: 1.2rem;
        color: #64748b;
        margin: 0;
    }

    .card-info {
        background: #ffffff;
        padding: 3rem 2rem;
        border-radius: 16px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
        max-width: 550px;
        width: 100%;
        border: 1px solid #e2e8f0;
    }

    .icon {
        font-size: 2.5rem;
        margin-bottom: 1rem;
    }

    h2 {
        font-size: 1.5rem;
        color: #1e293b;
        margin-top: 0;
        margin-bottom: 1rem;
    }

    p {
        line-height: 1.6;
        color: #475569;
        font-size: 1.05rem;
        margin-bottom: 1.25rem;
    }

    .actions {
        display: flex;
        gap: 1rem;
        justify-content: center;
        margin-top: 2rem;
    }

    .btn {
        display: inline-block;
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        font-weight: 600;
        text-decoration: none;
        transition: all 0.2s ease;
        font-size: 1rem;
    }

    .btn-primary {
        background-color: #2563eb;
        color: white;
        border: 2px solid #2563eb;
    }

    .btn-primary:hover {
        background-color: #1d4ed8;
        border-color: #1d4ed8;
        transform: translateY(-1px);
    }

    .btn-outline {
        background-color: transparent;
        color: #475569;
        border: 2px solid #cbd5e1;
    }

    .btn-outline:hover {
        background-color: #f1f5f9;
        color: #0f172a;
        border-color: #94a3b8;
    }

    footer {
        margin-top: 3rem;
        font-size: 0.875rem;
        color: #94a3b8;
    }
</style>