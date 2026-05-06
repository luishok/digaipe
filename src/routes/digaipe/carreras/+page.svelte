<script lang="ts">
    import { authClient } from '$lib/auth-client';

	const session = authClient.useSession();

    let {data,form} = $props();

    // --- Lógica del Modal ---
    let modalElement: HTMLDialogElement; // Aquí se guardará la referencia al <dialog>

    function openModal() {
        modalElement?.showModal();
    }

    function closeModal() {
        modalElement?.close();
    }
		let files = $state<FileList | null>(null); // Guardará la lista de archivos seleccionados
    
    // Variable derivada que reacciona cuando cambia 'files'
    let fileName = $derived(files && files.length > 0 ? files[0].name : null);

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


  // 1. Usamos $state para que el término de búsqueda sea reactivo en Svelte 5
    let searchTerm = $state('');

    // 2. Usamos $derived para que esta variable se recalcule automáticamente 
    // cada vez que el usuario escriba algo en 'searchTerm'
    let filteredCareers = $derived(
        // Validamos que data.all_careers exista para evitar errores si la data tarda en cargar
        (data?.all_careers || []).filter((career) => {
            // Si el buscador está vacío, mostramos todo
            if (searchTerm === '') return true;

            const term = searchTerm.toLowerCase();

            // Buscamos coincidencias en cualquiera de las columnas definidas en 'headers'
            return headers.some((header) => {
                const cellValue = String(career[header.key] || '').toLowerCase();
                return cellValue.includes(term);
            });
        })
    );


    

</script>



<h2 style='text-align: center;'>Carreras</h2>



<div class='header-carreras'>

	{#if $session.data}
	{#if $session.data.user.role === 'admin'}

	<div>  
					<!-- Cambiamos el id por un evento onclick -->
					<button onclick={openModal} class="btn-primary">Subir Archivo</button>
			</div>

			<!-- Usamos bind:this para conectar el HTML con la variable de arriba -->
			<dialog bind:this={modalElement}>
					<div class="modal-actions">
							<button onclick={closeModal} class="close-button">X</button>
					</div>
					<div class='import_careers'>
							<h3>Subir Archivo CSV</h3>
							<form method="POST" enctype="multipart/form-data" class='modal-form'>

									<label class="custom-file-upload {fileName ? 'has-file' : ''}">
										<input 
												type="file" 
												name="csvFile" 
												accept=".csv" 
												bind:files={files} 
												required 
										/>
										
										<div class="upload-content">
											{#if !fileName}
												<!-- Icono de Nube/Subir -->
												<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
												<p>Haga clic para seleccionar o arrastre su CSV</p>
												<span>Solo archivos .csv</span>
											{:else}
												<!-- Icono de Archivo Seleccionado -->
												<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
												<p class="file-ready">¡Archivo listo!</p>
												<strong>{fileName}</strong>
											{/if}
										</div>
									</label>


									<button type="submit">Procesar y Guardar</button>
							</form>

							{#if form?.success}
									<p style="color: green;">{form.message}</p>
							{:else if form?.error}
									<p style="color: red;">{form.message}</p>
							{/if}
					</div>
			</dialog>
		{/if}
	{/if}


	<!-- Input de búsqueda vinculado a la variable $state -->
	<input 
			type="text" 
			bind:value={searchTerm} 
			placeholder="Buscar por programa, facultad, núcleo..." 
			class="buscador"
			style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ccc;"
	/>
</div>
<div class='table_container'>
    <table>
        <thead>
            <!-- Siempre es buena práctica envolver los <th> en un <tr> -->
            <tr>
                {#each headers as header}
                    <th>{header.value}</th>
                {/each}
            </tr>
        </thead>
        <tbody>
            <!-- ¡Importante! Iteramos sobre la variable derivada 'filteredCareers' -->
            {#each filteredCareers as career}
            <tr>
                {#each headers as header}
                    <td>{career[header.key]}</td>
                {/each}
            </tr>
            {/each}
        </tbody>
    </table>
</div>

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

.header-carreras {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 20px;
	gap: 5%;
}
/* modal */
dialog {
	position: relative;
  border: none;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  text-align: center;
	left: 50%;
	top: 50%;
	height: 50vh;
	transform: translate(-50%, -50%);
	width: 500px;
}

/* Animación y fondo oscuro */
dialog::backdrop {
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px); /* Un toque de desenfoque */
}

.modal-actions {
	display: flex;
	justify-content: flex-end;
	margin-bottom: 20px;
	position: absolute;
	right: 20px;
}
.import_careers {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 20px;
	height: 100%;
}
.modal-form{
		display: flex;
    flex-direction: column;
    height: 70%;
}
.modal-form input[type="file"] {
		padding: 10px;
		border: 1px solid #ccc;
		border-radius: 4px;
		margin: auto 0;
}
.modal-form button{
		margin-top: auto;
}
.close-button {
		margin: 0;
    padding: 10px;
    border-radius: 50%;
    width: 30px;
    height: 30px;
    font-size: 12px;
}





/* Escondemos el input feo */
input[type="file"] {
    display: none;
}

.custom-file-upload {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    border: 2px dashed #cbd5e1;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    background-color: #f8fafc;
    margin-bottom: 20px;
}

.custom-file-upload:hover {
    border-color: #3b82f6;
    background-color: #eff6ff;
}

/* Cuando ya hay un archivo seleccionado */
.custom-file-upload.has-file {
    border-style: solid;
    border-color: #22c55e;
    background-color: #f0fdf4;
}

.upload-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    color: #64748b;
}

.upload-content p {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 500;
}

.upload-content span {
    font-size: 0.8rem;
    color: #94a3b8;
}

.file-ready {
    color: #166534;
}

/* Botón de guardar con estilo más "SaaS" */
.btn-save {
    width: 100%;
    padding: 12px;
    background-color: #1e293b;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}

.btn-save:hover:not(:disabled) {
    background-color: #0f172a;
}

.btn-save:disabled {
    background-color: #cbd5e1;
    cursor: not-allowed;
}
</style>
