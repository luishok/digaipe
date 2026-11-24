/** An explicit nationality is required: never guess V versus E or strip arbitrary letters. */
export function normalizeStudentIdentity(value: unknown): string | null {
	const compact = String(value ?? '')
		.toUpperCase()
		.replace(/[ .\t\r\n\u00a0-]/g, '');
	const match = /^([VE])([0-9]{1,9})$/.exec(compact);
	if (!match || /^0+$/.test(match[2])) return null;
	return `${match[1]}${match[2].padStart(9, '0')}`;
}
