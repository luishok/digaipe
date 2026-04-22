<script lang="ts">

    import {enhance} from "$app/forms";
    import type {PageServerData} from "./$types";
    let { data }: { data: PageServerData } = $props();
</script>

<h1> this is the diagiape main page you are authtorized</h1>

<a href="/digiape/admin/roles"> go to admin roles</a>
<p> your name is: {data.user.name}</p>
{#if data.user}
    <form method="post" action="?/signOut" use:enhance>
        <button>Sign out</button>
    </form>
{/if}