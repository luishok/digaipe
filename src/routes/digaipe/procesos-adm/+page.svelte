<script lang="ts">
    import { enhance } from '$app/forms';

    let { form , data } = $props();

    let dateInput = $state('');
    let dates = $state<string[]>([]);

    function addDate() {
        if (!dateInput || dates.includes(dateInput)) return;
        dates = [...dates, dateInput];
        dateInput = '';
    }

    function removeDate(date: string) {
        dates = dates.filter(d => d !== date);
    }

    let headers = [
        { key: 'id', value: 'ID' },
        { key: 'code', value: 'Código' },
        { key: 'dates', value: 'Fechas' }
    ];

</script>

<h1>Create Admission Process</h1>

<!-- Step 1: Create the process -->
<form method="POST" action="?/create" use:enhance>
    <label>
        Code
        <input name="code" type="text" required maxlength="100" />
    </label>
    <button type="submit">Create</button>
</form>

{#if form?.error}
    <p style="color: red">{form.error}</p>
{/if}

{#if form?.processId}
    <p>Process created: <strong>{form.code}</strong></p>

    <h2>Add Active Dates</h2>

    <!-- Step 2: Pick and list dates -->
    <input type="date" bind:value={dateInput} />
    <button type="button" onclick={addDate}>+</button>

    <ul>
        {#each dates as date}
            <li>
                {date}
                <button type="button" onclick={() => removeDate(date)}>x</button>
            </li>
        {/each}
    </ul>

    <!-- Step 3: Save dates -->
    {#if dates.length > 0}
        <form method="POST" action="?/saveDates" use:enhance={() => {
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

    {#if form?.saved}
        <p>Dates saved!</p>
    {/if}
{/if}

<h2>Procesos de Admisión</h2>
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