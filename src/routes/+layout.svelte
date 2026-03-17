<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import "../app.css";
	//PARA TODA LA PAGINA.. THEME
	let { children } = $props();
</script>
<div class="nav_bar">
<h1 > this is the main layout</h1>
</div>
<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
