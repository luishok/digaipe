import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type mysql from 'mysql2/promise';

// The database triggers that protect and feed the audit ledger are defined only in the
// migrations (drizzle/*.sql). Backups do not carry them (the backup account has no TRIGGER
// privilege, which would also let it drop them), so they are rebuilt from here after a restore,
// and any drift (a trigger missing, altered or added by hand) is reported.

export type TriggerDefinition = { name: string; table: string; timing: string; event: string; body: string; sql: string };
export type TriggerDrift = { missing: string[]; changed: string[]; unexpected: string[] };

const createTrigger =
	/^CREATE\s+TRIGGER\s+`([^`]+)`\s+(BEFORE|AFTER)\s+(INSERT|UPDATE|DELETE)\s+ON\s+`([^`]+)`\s+FOR\s+EACH\s+ROW\s+([\s\S]+)$/i;
const dropTrigger = /^DROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?`([^`]+)`/i;

const normalize = (sql: string) => sql.replace(/\s+/g, ' ').trim().replace(/;$/, '').trim();

/** The trigger set the migrations leave behind, applied in order. */
export async function expectedTriggers(migrationsDir = path.resolve(process.cwd(), 'drizzle')) {
	const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
	const triggers = new Map<string, TriggerDefinition>();
	for (const file of files) {
		const text = await readFile(path.join(migrationsDir, file), 'utf8');
		for (const raw of text.split('--> statement-breakpoint')) {
			const statement = raw.trim().replace(/;\s*$/, '');
			const created = createTrigger.exec(statement);
			if (created) {
				const [, name, timing, event, table, body] = created;
				triggers.set(name, { name, table, timing: timing.toUpperCase(), event: event.toUpperCase(), body: normalize(body), sql: statement });
				continue;
			}
			const dropped = dropTrigger.exec(statement);
			if (dropped) triggers.delete(dropped[1]);
		}
	}
	return triggers;
}

/** Compares the database's triggers with the migrations. Requires TRIGGER (or root) to see bodies. */
export async function triggerDrift(
	connection: mysql.Connection,
	database: string,
	expected: Map<string, TriggerDefinition>
): Promise<TriggerDrift> {
	const [rows] = await connection.query<mysql.RowDataPacket[]>(
		`SELECT trigger_name AS name, event_object_table AS tbl, action_timing AS timing,
			event_manipulation AS event, action_statement AS body
		 FROM information_schema.triggers WHERE trigger_schema = ?`,
		[database]
	);
	const actual = new Map(rows.map((row) => [String(row.name), row]));
	const drift: TriggerDrift = { missing: [], changed: [], unexpected: [] };
	for (const [name, want] of expected) {
		const have = actual.get(name);
		if (!have) drift.missing.push(name);
		else if (
			have.tbl !== want.table ||
			have.timing !== want.timing ||
			have.event !== want.event ||
			normalize(String(have.body)) !== want.body
		)
			drift.changed.push(name);
	}
	for (const name of actual.keys()) if (!expected.has(name)) drift.unexpected.push(name);
	return drift;
}
