import 'dotenv/config';

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { parse } from 'csv-parse/sync';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as schema from '../src/lib/server/db/schema';
import { careers } from '../src/lib/server/db/schema';

// Seeds the careers catalog from scripts/dataload/careers.csv. Same format and rules as the
// import on /digaipe/carreras: `;`-delimited with a header row, a career is identified by its
// clave (núcleo + OFAE), rows already present are skipped, so this is safe to rerun.

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = mysql.createPool(process.env.DATABASE_URL);
const db = drizzle(client, { schema, mode: 'default' });

type NewCareer = typeof careers.$inferInsert;
type CsvRow = Record<string, string | undefined>;

const normalizeCode = (value: string | null | undefined) =>
	String(value ?? '')
		.toUpperCase()
		.replace(/^\.+/, '')
		.replace(/\s+/g, '');

// Mirrors the generated `clave` column: concat(nucleo, ofae). Empty when either part is missing.
const careerKey = (career: { nucleo: string | null | undefined; ofae: string | null | undefined }) => {
	const nucleo = normalizeCode(career.nucleo);
	const ofae = normalizeCode(career.ofae);
	return nucleo && ofae ? `${nucleo}${ofae}` : '';
};

const optionalInt = (value: string | undefined) => {
	const text = value?.trim();
	if (!text) return null;
	const number = Number(text);
	if (!Number.isInteger(number)) throw new Error(`Not an integer: "${text}"`);
	return number;
};

async function main() {
	const csvPath = path.resolve(process.cwd(), 'scripts/dataload/careers.csv');
	const records = parse(fs.readFileSync(csvPath, 'utf8'), {
		columns: true,
		delimiter: ';',
		bom: true,
		trim: true,
		skip_empty_lines: true
	}) as CsvRow[];
	console.log(`Loaded ${records.length} rows from CSV`);

	const values: NewCareer[] = records.map((row, index) => {
		try {
			return {
				programa_academico: row['Programa Académico'] ?? '',
				codigo: optionalInt(row['OPSU']),
				ofae: row['OFAE'] ?? '',
				ocre: optionalInt(row['OCRE']),
				facultad: row['Facultad o Núcleo'] ?? '',
				nucleo: row['Nucleo'] ?? ''
			};
		} catch (err) {
			// +2: header line, 1-based lines.
			throw new Error(`careers.csv line ${index + 2}: ${(err as Error).message}`);
		}
	});

	const existing = await db.select({ nucleo: careers.nucleo, ofae: careers.ofae }).from(careers);
	const seen = new Set(existing.map(careerKey));
	const newValues: NewCareer[] = [];
	let skippedExisting = 0;

	values.forEach((value, index) => {
		const key = careerKey(value);
		if (!key) {
			console.log(`Skipping line ${index + 2} (empty núcleo or OFAE): ${value.programa_academico}`);
		} else if (seen.has(key)) {
			skippedExisting++;
		} else {
			seen.add(key);
			newValues.push(value);
		}
	});

	// One transaction: a failure leaves the catalog as it was, not half loaded.
	if (newValues.length) await db.transaction((tx) => tx.insert(careers).values(newValues).then(() => undefined));
	console.log(`Inserted ${newValues.length}, skipped ${skippedExisting} already present.`);
}

main()
	.then(() => {
		console.log('Careers seed completed.');
		process.exit(0);
	})
	.catch((err) => {
		console.error('Careers seed failed:', err);
		process.exit(1);
	});
