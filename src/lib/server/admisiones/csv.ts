// Spreadsheet apps run a cell that starts with = + - @ (or a tab / carriage return, which some
// of them strip first) as a formula. Text values that start that way get a leading apostrophe,
// which Excel and LibreOffice treat as "this is text" and do not display.
const formulaTrigger = /^[=+\-@\t\r]/;

export function csvCell(value: unknown) {
	let text = String(value ?? '');
	if (typeof value === 'string' && formulaTrigger.test(text)) text = `'${text}`;
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export const csvLine = (values: unknown[]) => values.map(csvCell).join(',');
