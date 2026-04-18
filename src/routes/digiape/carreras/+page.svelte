<script lang="ts">
    import { authClient } from '$lib/auth-client';

	const session = authClient.useSession();

    let {data,form} = $props();

    let headers = [
        {key:'programa_academico', value:'Programa Academico'},
        {key:'codigo', value:'Codigo OPSU'},
        {key:'ofae', value:'Codigo OFAE'},
        {key:'ocre', value:'Codigo OCRE'},
        {key:'facultad', value:'Facultad'},
        {key:'todo', value:'Nombre Completo'},
        {key:'nucleo', value:'Nucleo'},
        {key:'clave', value:'Clave'}
    ]




</script>



<h2>Carreras</h2>

<div class='table_container'>
    <table>
        <thead>
            {#each headers as header}
                <th>{header.value}</th>
            {/each}
        </thead>
        <tbody>
            {#each data.all_careers as career}
            <tr>
                {#each headers as header}
                    <td>{career[header.key]}</td>
                {/each}
            </tr>
            {/each}
        </tbody>
    </table>
</div>


{#if $session.data}
{#if $session.data.user.role === 'admin'}

<div class='import_careers'>

    <h3>Subir Archivo CSV</h3>

    <form method="POST" enctype="multipart/form-data">
        <input type="file" name="csvFile" accept=".csv" required />
        <button type="submit">Procesar y Guardar</button>
    </form>

    {#if form?.success}
        <p style="color: green;">{form.message}</p>
    {:else if form?.error}
        <p style="color: red;">{form.message}</p>
    {/if}

</div>
{/if}
{/if}

<style>


.table_container {
    width: 100%;
    overflow-x: auto; /* Permite scroll horizontal en móviles */
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

  /* Efecto Zebra (Filas alternas) */
  .table_container tbody tr:nth-child(even) {
    background-color: #fcfcfd;
  }

  /* Efecto Hover para resaltar la fila actual */
  .table_container tbody tr:hover {
    background-color: #f1f5f9;
    transition: background-color 0.2s ease;
  }

  /* Quitar el borde inferior a la última fila */
  .table_container tbody tr:last-child td {
    border-bottom: none;
  }


</style>