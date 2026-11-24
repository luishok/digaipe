<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatDateTime } from '$lib/dates';
	import EnrollmentReport from '$lib/components/EnrollmentReport.svelte';
	let { data } = $props();
</script>

<h1>Informe oficial de cierre · versión {data.closure.version}</h1>
<p>Cerrado el {formatDateTime(data.closure.closedAt)}. Motivo: {data.closure.reason}</p>
<p>Este informe conserva el resultado de ese cierre, incluso si el proceso se reabre.</p>
<div class="exports">
	<a href={resolve('/digaipe/estadisticas')}>Volver a reportes</a>
	<a href={resolve(`/digaipe/estadisticas/cierres/${data.closure.id}/csv`)}>Descargar CSV completo</a>
	<a href={resolve(`/digaipe/estadisticas/cierres/${data.closure.id}/pdf`)}>Descargar PDF completo</a>
</div>
<EnrollmentReport report={data.closure.report} includeStudents />
<details><summary>Integridad del informe</summary><p class="hash">SHA-256: {data.closure.sha256}</p></details>

<style>
	.exports { display: flex; flex-wrap: wrap; gap: 1rem; margin: 1rem 0; }
	.hash { overflow-wrap: anywhere; }
</style>
