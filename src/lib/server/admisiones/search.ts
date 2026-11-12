import { and, like, or, type AnyColumn, type SQL } from 'drizzle-orm';

/**
 * Free-text search shared by the statistics and admissions pages.
 *
 * Cédulas are stored as a nationality letter plus a zero-padded number ('V013118120'),
 * but people type them as 'V-13.118.120', 'V13118120', '13.118.120' or '13118120'. A
 * cédula-like token is therefore reduced to its significant digits (and optional V/E
 * prefix) before matching. Every other token is matched as a word: each word must appear
 * somewhere (any searchable column), in any order — so 'juan perez' finds
 * 'PEREZ GONZALEZ JUAN'. Case and accents are handled by the column collation
 * (utf8mb4_0900_ai_ci).
 */

export type SearchToken =
	| { kind: 'cedula'; prefix: 'V' | 'E' | null; digits: string }
	| { kind: 'word'; value: string };

const MAX_LENGTH = 100;
const MAX_TOKENS = 8;
const CEDULA_TOKEN = /^([VE])?-?([\d.]+)$/i;

/** Escapes LIKE wildcards so '%', '_' and '\' in user input are matched literally. */
export function escapeLike(value: string) {
	return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function parseSearch(raw: string): SearchToken[] {
	const text = raw
		.slice(0, MAX_LENGTH)
		.trim()
		// 'V 13118120' / 'V- 13.118.120' → 'V13118120'-style single token
		.replace(/(^|\s)([VE])[\s.-]+(?=\d)/gi, '$1$2');
	if (!text) return [];
	const tokens: SearchToken[] = [];
	for (const part of text.split(/\s+/)) {
		const cedula = CEDULA_TOKEN.exec(part);
		const digits = cedula?.[2].replace(/\./g, '').replace(/^0+/, '');
		if (cedula && digits) {
			const prefix = cedula[1] ? (cedula[1].toUpperCase() as 'V' | 'E') : null;
			tokens.push({ kind: 'cedula', prefix, digits });
		} else {
			tokens.push({ kind: 'word', value: part });
		}
		if (tokens.length === MAX_TOKENS) break;
	}
	return tokens;
}

/**
 * Builds the WHERE condition for a search string, or undefined when there is nothing to
 * search. `cedula` is the cédula column; `text` are the other columns a word may match.
 */
export function searchCondition(
	raw: string,
	columns: { cedula: AnyColumn; text: AnyColumn[] }
): SQL | undefined {
	const tokens = parseSearch(raw);
	if (!tokens.length) return undefined;
	const conditions = tokens.map((token): SQL => {
		if (token.kind === 'cedula') {
			const head = token.prefix ? `${token.prefix}%` : '%';
			const digitsMatch = like(columns.cedula, `${head}${escapeLike(token.digits)}%`);
			// A short number could also be part of a career name/code, e.g. 'medicina 2'.
			return token.prefix
				? digitsMatch
				: or(digitsMatch, ...columns.text.map((col) => like(col, `%${token.digits}%`)))!;
		}
		const pattern = `%${escapeLike(token.value)}%`;
		return or(like(columns.cedula, pattern), ...columns.text.map((col) => like(col, pattern)))!;
	});
	return and(...conditions);
}
