<script lang="ts">
	let { data, form } = $props();
</script>

<h1>Revisión de documentos</h1>
{#if form?.message}<p aria-live="polite">{form.message}</p>{/if}

<form method="GET">
    <fieldset class="filter-card">
        <legend>Filtros</legend>

        <!-- Fila 1: Rango de fechas y Búsqueda -->
        <div class="filter-row-flex">
            <div class="label-input">
                <label>
                    Desde 
                    <input type="date" name="dateFrom" value={data.filters.dateFrom} />
                </label>
            </div>

            <div class="label-input">
                <label>
                    Hasta 
                    <input type="date" name="dateTo" value={data.filters.dateTo} />
                </label>
            </div>

            <div class="label-input">
                <label>
                    Buscar 
                    <input type="search" name="search" value={data.filters.search} placeholder="Escribe para buscar..." />
                </label>
            </div>
        </div>

        <!-- Fila 2: Desplegables de Estado, Proceso y Acciones -->
        <div class="filter-row-flex">
            <div class="label-input">
                <label>
                    Estado 
                    <select name="status">
                        <option value="">Todos</option>
                        <option value="pendiente" selected={data.filters.status === 'pendiente'}>Pendiente</option>
                        <option value="matriculado" selected={data.filters.status === 'matriculado'}>Matriculado</option>
                        <option value="devuelto" selected={data.filters.status === 'devuelto'}>Devuelto</option>
                    </select>
                </label>
            </div>

            <div class="label-input">
                <label>
                    Proceso 
                    <select name="process">
                        <option value="">Todos</option>
                        {#each data.processes as process}
                            <option value={process.code} selected={data.filters.process === process.code}>
                                {process.code}
                            </option>
                        {/each}
                    </select>
                </label>
            </div>

            <!-- Botones de Acción -->
            <div class="filter-actions">
                <button type="submit" class="btn-submit">Filtrar</button>
                <a href="/digaipe/revision-documentos" class="btn-clear">Limpiar</a>
            </div>
        </div>
    </fieldset>
</form>

<form method="POST" action="?/review" class="data-section">
    <!-- Header de la Sección -->
    <div class="section-header">
        <div>
            <h2>Admisiones con planilla generada</h2>
            <span class="count-badge">{data.rows.length} admisión(es)</span>
        </div>
    </div>

    <!-- Tabla Responsiva -->
    <div class="table-container">
        <table class="custom-table">
            <thead>
                <tr>
                    <th class="th-checkbox">
                        <span class="sr-only">Seleccionar</span>
                    </th>
                    <th>Fecha válida</th>
                    <th>Estado</th>
                    <th>Proceso</th>
                    <th>Carrera</th>
                    <th>Cédula</th>
                    <th>Estudiante</th>
                    <th>Motivo</th>
                    {#if data.isAdmin}
                        <th>Administración</th>
                    {/if}
                </tr>
            </thead>
            <tbody>
                {#each data.rows as row}
                    <tr>
                        <td class="td-checkbox">
                            <input type="checkbox" name="processingId" value={row.id} class="row-checkbox" />
                        </td>
                        <td class="whitespace-nowrap">{String(row.processingDate).slice(0, 10)}</td>
                        <td>
                            <span class="status-badge status-{row.status?.toLowerCase()}">
                                {row.status}
                            </span>
                        </td>
                        <td><code class="code-tag">{row.processCode}</code></td>
                        <td>{row.career ?? '—'}</td>
                        <td class="font-mono">{row.cedula}</td>
                        <td class="font-medium">{row.student}</td>
                        <td class="text-muted">{row.returnReason ?? '—'}</td>
                        {#if data.isAdmin}
                            <td>
                                <div class="admin-cell-action">
                                    <input 
                                        type="text" 
                                        name={`unlockReason_${row.id}`} 
                                        maxlength="500" 
                                        placeholder="Motivo de desbloqueo..." 
                                        class="table-input"
                                    />
                                    <button
                                        type="submit"
                                        formmethod="POST"
                                        formaction="?/unlock"
                                        name="unlockProcessingId"
                                        value={row.id}
                                        class="btn-unlock"
                                    >
                                        Desbloquear
                                    </button>
                                </div>
                            </td>
                        {/if}
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>

    <!-- Panel de Decisión para Seleccionadas -->
    <fieldset class="filter-card mt-4">
        <legend>Decisión para las seleccionadas</legend>
        
        <div class="filter-row-flex align-end">
            <div class="label-input">
                <label>
                    Estado
                    <select name="status">
                        <option value="matriculado">Matriculado</option>
                        <option value="devuelto">Devuelto</option>
                    </select>
                </label>
            </div>

            <div class="label-input flex-1">
                <label>
                    Motivo de devolución
                    <input  class="motivo-devolucion-text"
                        type="text" 
                        name="reason" 
                        maxlength="500" 
                        placeholder="Especifique la razón si devuelve la solicitud..." 
                    />
                </label>
            </div>

            <div class="filter-actions">
                <button type="submit" class="btn-submit">
                    Guardar decisión
                </button>
            </div>
        </div>
    </fieldset>
</form>
