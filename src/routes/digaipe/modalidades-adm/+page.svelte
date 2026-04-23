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

    .table_container {
        width: 100%;
        overflow-x: auto;
        margin: 1rem 0;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .table_container table {
        width: 100%;
        border-collapse: collapse;
        font-family: sans-serif;
        background-color: white;
        text-align: left;
    }

    .table_container thead {
        background-color: #f8fafc;
        border-bottom: 2px solid #e2e8f0;
    }

    .table_container th {
        padding: 12px 16px;
        font-weight: 600;
        color: #475569;
        text-transform: uppercase;
        font-size: 0.75rem;
        letter-spacing: 0.05em;
    }

    .table_container td {
        padding: 12px 16px;
        color: #1e293b;
        border-bottom: 1px solid #f1f5f9;
        font-size: 0.9rem;
    }

    .table_container tbody tr:nth-child(even) {
        background-color: #fcfcfd;
    }

    .table_container tbody tr:hover {
        background-color: #f1f5f9;
        transition: background-color 0.2s ease;
    }

    .table_container tbody tr:last-child td {
        border-bottom: none;
    }
</style>