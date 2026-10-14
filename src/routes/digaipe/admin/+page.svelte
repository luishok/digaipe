<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Administración | DIGAIPE</title>
</svelte:head>

<h1>Administración</h1>
<p class="subtitle">Gestione los usuarios, sus permisos y el registro de actividad de DIGAIPE.</p>

<section class="report-card" aria-labelledby="admin-tools">
	<h2 id="admin-tools" class="report-title">Herramientas de administración</h2>
	<div class="kpi-grid">
		<a class="kpi-card" href={resolve('/digaipe/admin/roles')}>
			<span class="kpi-value">Usuarios y roles</span>
			<span>Agregar y eliminar usuarios, y asignar permisos de acceso.</span>
		</a>
		<a class="kpi-card" href={resolve('/digaipe/admin/audit')}>
			<span class="kpi-value">Auditoría</span>
			<span>Consultar y exportar el registro de actividad del sistema.</span>
		</a>
	</div>
</section>

<div class="filter-actions">
	<a href={resolve('/digaipe')}>Volver a DIGAIPE</a>
</div>
