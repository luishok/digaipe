// place files you want to import through the `$lib` alias in this folder.

const batchStatusLabels: Record<string, string> = { draft: 'Borrador', saved: 'Guardado' };

export function batchStatusLabel(status: string) {
	return batchStatusLabels[status] ?? status;
}
