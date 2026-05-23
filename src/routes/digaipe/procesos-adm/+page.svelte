<script lang="ts">
    import { enhance } from '$app/forms';

    let { form , data } = $props();

    let dateInput = $state('');
    let dates = $state<string[]>([]);

    function addDate() {
        if (!dateInput || dates.includes(dateInput)) return;
        dates = [...dates, dateInput];
        dateInput = '';
        document.getElementsByClassName('selected-dates')[0].setAttribute('style', 'display: block;');
    }

    function removeDate(date: string) {
        dates = dates.filter(d => d !== date);
        if (dates.length === 0) {
            document.getElementsByClassName('selected-dates')[0].setAttribute('style', 'display: none;');
        }
    }

    let headers = [
        { key: 'id', value: 'ID' },
        { key: 'code', value: 'Código' },
        { key: 'dates', value: 'Fechas' }
    ];




    // Estado local para controlar los 5 segundos de visibilidad
    let mostrarMensaje = false;

    // Escuchamos de forma reactiva cuando "form.saved" pase a ser verdadero
    $effect(() => {
        if (form?.saved) {
            mostrarMensaje = true;

            const timer = setTimeout(() => {

                mostrarMensaje = false;
                location.reload();
                // Si necesitas limpiar el estado del form:
                if (form) form.saved = false; 
            }, 4000);

            // Svelte 5 ejecuta esta función de retorno para limpiar el efecto anterior
            return () => clearTimeout(timer);
        }
    });

</script>

<style>
h1{
    text-align: center;
}
    .process-container{
        display: flex;
        gap: 2rem;
       height: 50vh;
    }
    .process-container p{
        margin: 0;
    }
    .process-left, .process-right{
        flex: 1;
        border-radius: 8px;
         overflow-y: auto;
    }
    .process-left{
        background-color: var(--ula-blue);
        padding: 1rem;
        gap: 0.5rem;
        display: flex;
        flex-direction: column;
            padding: 24px;
    border-radius: 12px;
    box-shadow: 0 4px 6px 4px rgba(0, 0, 0, 0.05), 0 2px 4px 4px rgba(0, 0, 0, 0.03);
    font-family: system-ui, -apple-system, sans-serif;
        
    }

    .process-left h2 {
    font-size: 20px;
    color: #ffffff; /* Blanco para resaltar sobre el fondo azul */
    margin-top: 0;
    margin-bottom: 20px;
    font-weight: 700;
    border-left: 4px solid white; /* Detalle elegante con blanco en el título */
    padding-left: 10px;
    
}
    .item-process-left{
        border-radius: 8px;
        background: white;
        padding: 1.5rem;
        align-items: center;
    }
    .item-process-left label {
    display: flex;
    flex-direction: column;
    gap: 6px; /* Controla la separación entre el texto y el input */
    font-weight: 600; /* Opcional: para que resalte un poco más el título */
    margin: 0 1em;
}
    .process-right{
        background-color: var(--ula-light);
        padding: 1rem;
            padding: 24px;
    border-radius: 12px;
    box-shadow: 0 4px 6px 4px rgba(0, 0, 0, 0.05), 0 2px 4px 4px rgba(0, 0, 0, 0.03);
    font-family: system-ui, -apple-system, sans-serif;
       
    }





    .input-date, .input-text {
    width: 50%;
    padding: 10px 14px;
    font-size: 15px;
    color: #1e293b; /* Texto oscuro para legibilidad */
    background-color: #ffffff; /* Predominantemente blanco */
    border: 1px solid #cbd5e1; /* Borde gris suave por defecto */
    border-radius: 8px; /* Bordes redondeados modernos */
    outline: none;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    box-sizing: border-box;
}

/* Efecto Hover (Cuando el mouse pasa por encima) */
.input-date:hover {
    border-color: #94a3b8;
}

/* Estado Focus (Cuando el usuario hace clic o interactúa con él) */
.input-date:focus {
    border-color: #0033a0; /* Tu color de acento */
    /* Crea un halo sutil alrededor del input usando tu azul con opacidad */
    box-shadow: 0 0 0 3px rgba(0, 51, 160, 0.15); 
}

/* --- Personalización del Icono de Calendario Nativo --- */

/* Para navegadores basados en Webkit (Chrome, Safari, Edge, Opera) */
.input-date::-webkit-calendar-picker-indicator {
    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%230033a0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>');
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    transition: background-color 0.2s;
}

/* Cambia ligeramente el fondo del icono al pasar el mouse sobre él */
.input-date::-webkit-calendar-picker-indicator:hover {
    background-color: rgba(0, 51, 160, 0.08);
}



.selected-dates{
    margin-top: 1rem;
    padding: 0.5rem;
    display: none;
    margin-bottom: 1rem;
}
.selected-dates ul{
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-left: 1em;
}

.selected-dates li{
    background-color: #e2e8f0;
    padding: 0.5rem;
    border-radius: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    letter-spacing: 4px;
}
.button-red{
    background-color:#ef4444;
}
.save-dates-form{
    display: flex;
    justify-content: center;
}
.save-dates-form button, .create-process button{
   width: 50%;
    min-width:fit-content;
}
.create-process .container-button-create{
        display: flex;
    justify-content: center;
    margin-top: 1rem;
}

 .mensaje-exito{
    display:none;
 }

















 

/* Título de la sección */
.process-right h2 {
    font-size: 20px;
    color: #1e293b; /* Gris oscuro elegante */
    margin-top: 0;
    margin-bottom: 20px;
    font-weight: 700;
    border-left: 4px solid #0033a0; /* Detalle elegante con tu azul en el título */
    padding-left: 10px;
}

/* Contenedor responsivo de la tabla */
.process-right .table_container {
    width: 100%;
    overflow-x: auto; /* Permite scroll horizontal en móviles si es necesario */
    border: 1px solid #e2e8f0; /* Borde sutil alrededor de la tabla */
    border-radius: 8px;
}

/* Estilos generales de la tabla */
.process-right table {
    width: 100%;
    border-collapse: collapse; /* Elimina dobles bordes molestos */
    text-align: left;
    font-size: 14px;
}

/* Encabezado (Thead) */
.process-right thead {
    background-color: #f8fafc; /* Gris ultra claro para contrastar con el fondo blanco */
    border-bottom: 2px solid #e2e8f0;
}

.process-right th {
    padding: 14px 16px;
    font-weight: 600;
    color: #475569; /* Color de texto suave pero legible para los headers */
    text-transform: uppercase; /* Opcional: hace que los headers se vean más corporativos */
    font-size: 12px;
    letter-spacing: 0.05em;
}

/* Filas y Celdas del Cuerpo (Tbody) */
.process-right tbody tr {
    border-bottom: 1px solid #f1f5f9; /* Línea divisoria muy sutil entre registros */
    transition: background-color 0.15s ease;
}

/* Efecto cebra opcional (filas intercaladas con un tono gris casi imperceptible) */
.process-right tbody tr:nth-child(even) {
    background-color: #fcfdfe;
}

/* Efecto Hover: Resalta la fila donde el usuario tiene el mouse */
.process-right tbody tr:hover {
    background-color: rgba(0, 51, 160, 0.03); /* Un toque sutilísimo de tu azul */
}

.process-right td {
    padding: 14px 16px;
    color: #334155; /* Texto del contenido */
    vertical-align: middle;
}

/* Evita que el texto de las celdas se pegue feo si hay saltos de línea */
.process-right td strong {
    color: #1e293b;
    font-weight: 600;
}
</style>

<h1>Procesos de Admisión</h1>

<!-- Step 1: Create the process -->
<div class='process-container'>
    <div class='process-left'>
        <h2>Crear Proceso de Admisión</h2>
        <div class='item-process-left'>
        <form class='create-process' id='create-process-form' method="POST" action="?/create" use:enhance>
            <div class="input-group">
                <label for="process-code" class="label-text">Código del Proceso</label>
                <input 
                    id="process-code" 
                    class="input-text" 
                    name="code" 
                    type="text" 
                    placeholder="Ingresa código del proceso" 
                    required 
                    maxlength="100" 
                />
            </div>
            <div class='container-button-create'>
                <button type="submit">Create</button>
            </div>
        </form>
    

{#if form?.error}
    <p style="color: red">❌{form.error}</p>
{/if}

{#if form?.processId}

    <p>✅Process created: <strong>{form.code}</strong></p>
    <style>
        #create-process-form {
            display: none;
        }
    </style>
{/if}
</div>
{#if form?.processId}
    <div class='item-process-left'>
    <label for="active-dates-input">Agregar Fechas Activas</label>
    <!-- Step 2: Pick and list dates -->
    <input id="active-dates-input" class="input-date" type="date" bind:value={dateInput} />
    <button type="button" onclick={addDate}>+</button>

    
    <div class='selected-dates'>
        <p style='font-weight: bold;'>Fechas Seleccionadas</p>
        <ul>
            
            {#each dates as date}
                <li>
                    {date}
                    <button type="button" class="button-red" onclick={() => removeDate(date)}>x</button>
                </li>
            {/each}
        </ul>
    </div>

    <!-- Step 3: Save dates -->
    {#if dates.length > 0}
        <form class='save-dates-form' method="POST" action="?/saveDates" use:enhance={() => {
  return async ({ result, update }) => {
    await update();
    if (result.type === 'success') {
      dates = [];
      form = null;
      update({ reset: true });
    }
  };
}}>
            <input type="hidden" name="processId" value={form.processId} />
            <input type="hidden" name="dates" value={JSON.stringify(dates)} />
            <button type="submit">Save Dates</button>
        </form>
    {/if}
    </div>
    {#if form?.saved}
        <style>
            .item-process-left {
                display: none;
            }
            .mensaje-exito{
                display:block !important;
                background:white;
                padding:1rem;
                text-align:center;
                border-radius:8px;
                height:fit-content;
            }
        </style>
        <div class="mensaje-exito">
            <p>✅ Fechas Guardadas!</p>
        </div>

    {/if}
{/if}

</div>



<div class='process-right'>
    <h2>Procesos Guardados</h2>
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
                {#each data.all_admission_proc as process}
                    <tr>
                        {#each headers as header}
                            <td>{process[header.key]}</td>
                        {/each}
                    </tr>
                {/each}
                </tbody>
            </table>
        </div>
    </div>
</div>