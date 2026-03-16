<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>
<h1> this is the main layout</h1>
<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
