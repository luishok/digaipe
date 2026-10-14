<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import type { PageServerData } from './$types';
	let { data }: { data: PageServerData } = $props();
</script>

<h1>this is the diagiape main page you are authtorized</h1>

<a href={resolve('/digaipe/estadisticas')}>Estadísticas de admisiones</a>
{#if data.user.role === 'admin'}
	<a href={resolve('/digaipe/admin')}>Administración</a>
	<a href={resolve('/digaipe/admin/roles')}>Usuarios y roles</a>
	<a href={resolve('/digaipe/admin/audit')}>Audit logs</a>
{/if}
<p>your name is: {data.user.name}</p>
{#if data.user}
	<form method="post" action="?/signOut" use:enhance>
		<button>Sign out</button>
	</form>
{/if}
