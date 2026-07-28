import 'dotenv/config';

import { betterAuth } from 'better-auth/minimal';

import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '../src/lib/server/db/schema';

import mysql from 'mysql2/promise';
import * as fs from 'node:fs';
import { parse } from 'csv-parse';
import * as path from 'node:path';
import { careers, mod_admission } from '../src/lib/server/db/schema';
import { eq } from 'drizzle-orm';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = mysql.createPool(process.env.DATABASE_URL);
const db = drizzle(client, { schema, mode: 'default' });
type NewAdm = typeof mod_admission.$inferInsert;
type adm_mododelRow = {
	code: string;
	name: string;
};
async function readCsv(filePath: string): Promise<adm_mododelRow[]> {
	return new Promise((resolve, reject) => {
		const rows: adm_mododelRow[] = [];

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
	const csvPath = path.resolve(process.cwd(), 'scripts/dataload/admission_modalities.csv');
	const rows = await readCsv(csvPath);
	console.log(rows);
	console.log(`Loaded ${rows.length} rows from CSV`);

	for (const row of rows) {
		const existing = await db
			.select()
			.from(mod_admission)
			.where(eq(mod_admission.code, row.code))
			.limit(1);

		if (existing.length > 0) {
			console.log(`Skipping existing procedure: ${row.code}`);
			continue;
		}
		const value: NewAdm = {
			code: row.code,
			name: row.name
		};
		await db.insert(mod_admission).values(value);

		console.log(`Inserted: ${row.code}`);
	}
}

main()
	.then(() => {
		console.log('Procedure seed completed.');
		process.exit(0);
	})
	.catch((err) => {
		console.error('Procedure seed failed:', err);
		process.exit(1);
	});
