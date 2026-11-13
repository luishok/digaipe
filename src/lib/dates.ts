// Display formatting for dates: DD-MM-YYYY everywhere a person reads a date (pages, PDFs, CSVs).
// Values sent to the server (URL params, <input type="date">, form fields) and file names stay
// ISO YYYY-MM-DD; only what is shown changes. Imported relatively by server code, because the
// tsx test runner does not resolve `$lib`.

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A calendar date: an ISO date key ('2026-03-05', or anything starting with one) or a Date
 * read from a DATE column. Dates use their UTC parts, the same way the rest of the code turns
 * them into date keys (`toISOString().slice(0, 10)`), so the day never shifts by time zone.
 */
export function formatDate(value: string | Date | null | undefined): string {
	if (value == null || value === '') return '';
	const key = typeof value === 'string' ? value.slice(0, 10) : isoDateKey(value);
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
	return match ? `${match[3]}-${match[2]}-${match[1]}` : String(value);
}

/** 'YYYY-MM' → 'MM-YYYY'. */
export function formatMonth(value: string | null | undefined): string {
	if (!value) return '';
	const match = /^(\d{4})-(\d{2})$/.exec(value.slice(0, 7));
	return match ? `${match[2]}-${match[1]}` : value;
}

/**
 * A moment in time (a TIMESTAMP column), shown as DD-MM-YYYY HH:mm in Venezuela's time zone
 * by default, so it reads the same on every PC and on the server.
 */
export function formatDateTime(
	value: string | Date | null | undefined,
	{ timeZone = 'America/Caracas', seconds = false }: { timeZone?: string; seconds?: boolean } = {}
): string {
	if (value == null || value === '') return '';
	const date = typeof value === 'string' ? new Date(value) : value;
	if (Number.isNaN(date.getTime())) return String(value);
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat('en-GB', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hourCycle: 'h23'
		})
			.formatToParts(date)
			.map((part) => [part.type, part.value])
	);
	const time = `${parts.hour}:${parts.minute}${seconds ? `:${parts.second}` : ''}`;
	return `${parts.day}-${parts.month}-${parts.year} ${time}`;
}

function isoDateKey(date: Date) {
	if (Number.isNaN(date.getTime())) return '';
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}
