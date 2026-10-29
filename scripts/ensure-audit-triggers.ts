import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import { expectedTriggers, triggerDrift } from './lib/audit-triggers';

// Rebuilds the audit triggers from the migrations when any is missing or altered: always after a
// restore (backups do not carry triggers), and whenever someone has dropped or changed one.
// Each repair is recorded in the ledger as schema.triggers_repaired. Triggers that exist in the
// database but not in the migrations are reported, not dropped: a person must look at them.
// Runs in the setup container as the database owner, after migrations.

async function main() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error('DATABASE_URL is not set');
	const database = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
	const expected = await expectedTriggers();
	const connection = await mysql.createConnection(databaseUrl);
	try {
		const drift = await triggerDrift(connection, database, expected);
		for (const name of [...drift.changed, ...drift.missing]) {
			if (drift.changed.includes(name)) await connection.query(`DROP TRIGGER ${connection.escapeId(name)}`);
			await connection.query(expected.get(name)!.sql);
		}
		if (drift.missing.length || drift.changed.length) {
			await connection.query(
				"CALL append_audit_event(?, 'system', 'schema.triggers_repaired', 'success', NULL, NULL, NULL, NULL, NULL, NULL, 'database', ?, NULL, NULL, ?)",
				[randomUUID(), database, JSON.stringify(drift)]
			);
			console.log(`Recreated ${drift.missing.length} missing and ${drift.changed.length} altered trigger(s).`);
		} else {
			console.log(`All ${expected.size} audit triggers present and unchanged.`);
		}
		if (drift.unexpected.length) {
			console.error(`WARNING: triggers not defined in the migrations: ${drift.unexpected.join(', ')}`);
		}
	} finally {
		await connection.end();
	}
}

main().catch((err) => {
	console.error('Trigger check failed:', err);
	process.exit(1);
});
