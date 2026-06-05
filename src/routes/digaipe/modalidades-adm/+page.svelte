<script lang="ts">
    import { authClient } from '$lib/auth-client';

    const session = authClient.useSession();

    let { data} = $props();

    let headers = [
        { key: 'id', value: 'ID' },
        { key: 'code', value: 'Código' },
        { key: 'name', value: 'Nombre' }
    ];
</script>

<h2>Modalidades de Admisión</h2>
<div class="table_container">
    <table>
        <thead>
        <tr>
            {#each headers as header}
                <th>{header.value}</th>
            {/each}
        </tr>
        </thead>
        <tbody>
        {#each data.all_admission_modalities as modality}
            <tr>
                {#each headers as header}
                    <td>{modality[header.key]}</td>
                {/each}
            </tr>
        {/each}
        </tbody>
    </table>
</div>

<style>
    .import_section {
        margin-bottom: 1.5rem;
    }

    
</style>