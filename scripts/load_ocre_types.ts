import 'dotenv/config';

import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '../src/lib/server/db/schema';

import mysql from 'mysql2/promise';
import * as fs from 'node:fs';
import { parse } from 'csv-parse';
import * as path from 'node:path';
import { ocre_types } from '../src/lib/server/db/schema';
import { eq } from 'drizzle-orm';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = mysql.createPool(process.env.DATABASE_URL);
const db = drizzle(client, { schema, mode: 'default' });

type NewOcreType = typeof ocre_types.$inferInsert;
type OcreTypeRow = {
	code: string;
	name: string;
};

async function readCsv(filePath: string): Promise<OcreTypeRow[]> {
	return new Promise((resolve, reject) => {
		const rows: OcreTypeRow[] = [];

		fs.createReadStream(filePath)
			.pipe(
				parse({
					delimiter: ';',
					trim: true,
					skip_empty_lines: true
				})
			)
			.on('data', (row: string[]) => {
				const code = row[0]?.trim();
				const name = row[1]?.trim();

				if (!code || !name) return;

				rows.push({ code, name });
			})
			.on('end', () => resolve(rows))
			.on('error', reject);
	});
}

async function main() {
	const csvPath = path.resolve(process.cwd(), 'scripts/dataload/ocre_types.csv');
	const rows = await readCsv(csvPath);
	console.log(rows);
	console.log(`Loaded ${rows.length} rows from CSV`);

	for (const row of rows) {
		const existing = await db
			.select()
			.from(ocre_types)
			.where(eq(ocre_types.code, row.code))
			.limit(1);

		if (existing.length > 0) {
			console.log(`Skipping existing ocre type: ${row.code}`);
			continue;
		}

		const value: NewOcreType = {
			code: row.code,
			name: row.name
		};
		await db.insert(ocre_types).values(value);

		console.log(`Inserted: ${row.code}`);
	}
}

main()
	.then(() => {
		console.log('Ocre types seed completed.');
		process.exit(0);
	})
	.catch((err) => {
		console.error('Ocre types seed failed:', err);
		process.exit(1);
	});
