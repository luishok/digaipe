import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { expectedTriggers, triggerDrift } from './lib/audit-triggers';

// Verifies the audit ledger and anchors its head outside the database
// (docs/security-review-2026-10-28.md, A1 and A3).
//
//   tsx scripts/audit-ledger.ts verify [--anchors <file>]
//   tsx scripts/audit-ledger.ts anchor --anchors <file> [--note <text>]
//
// The hash chain alone cannot catch someone with database-owner rights who deletes the newest
// events and rewinds audit_chain_state, or who rewrites and re-hashes the whole chain. An anchor
// (sequence + event_hash) copied to storage that person cannot edit closes both gaps: `verify`
// fails when an anchored event is missing or its hash changed.
//
// Plain mysql2 (not src/lib/server/db) so it runs under tsx, outside Vite.

type Anchor = {
	version: 1;
	anchoredAt: string;
	database: string;
	sequence: number;
	eventHash: string;
	occurredAt: string;
	note?: string;
};

type Head = { sequence: number; eventHash: string; occurredAt: string };

function option(name: string) {
	const index = process.argv.indexOf(name);
	return index === -1 ? undefined : process.argv[index + 1];
}

// Mirrors append_audit_event in drizzle/0001_audit_ledger_controls.sql. Keep them identical.
const verifyChainSql = `
	WITH ordered AS (
		SELECT
			*,
			COALESCE(LAG(event_hash) OVER (ORDER BY sequence), REPEAT('0', 64)) AS expected_previous_hash
		FROM audit_events
	)
	SELECT sequence,
		previous_hash <> expected_previous_hash AS broken_link,
		event_hash <> SHA2(CONCAT_WS('|',
			previous_hash,
			CAST(sequence AS CHAR),
			DATE_FORMAT(occurred_at, '%Y-%m-%dT%H:%i:%s.%fZ'),
			COALESCE(source, ''), COALESCE(action, ''), COALESCE(outcome, ''),
			COALESCE(actor_user_id, ''), COALESCE(actor_name, ''), COALESCE(actor_email, ''),
			COALESCE(correlation_id, ''), COALESCE(ip_address, ''), COALESCE(user_agent, ''),
			COALESCE(entity_type, ''), COALESCE(entity_id, ''),
			COALESCE(CAST(before_value AS CHAR), 'null'),
			COALESCE(CAST(after_value AS CHAR), 'null'),
			COALESCE(CAST(metadata AS CHAR), 'null')
		), 256) AS bad_hash
	FROM ordered
	HAVING broken_link OR bad_hash
	ORDER BY sequence
`;

async function readAnchors(file: string, allowMissing: boolean): Promise<Anchor[]> {
	let text: string;
	try {
		text = await readFile(file, 'utf8');
	} catch (error) {
		// The very first `anchor` run creates the file.
		if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw error;
	}
	return text
		.split(/\r?\n/)
		.filter((line) => line.trim())
		.map((line, index) => {
			const anchor = JSON.parse(line) as Anchor;
			if (anchor.version !== 1 || !Number.isSafeInteger(anchor.sequence) || !/^[0-9a-f]{64}$/.test(anchor.eventHash)) {
				throw new Error(`${file}:${index + 1} is not a valid anchor line`);
			}
			return anchor;
		});
}

async function verify(
	connection: mysql.Connection,
	database: string,
	anchorsFile: string | undefined,
	allowMissingAnchors: boolean
) {
	const problems: string[] = [];

	const [invalid] = await connection.query<mysql.RowDataPacket[]>(verifyChainSql);
	for (const row of invalid) {
		problems.push(
			`event ${row.sequence}: ${row.bad_hash ? 'contents do not match its hash' : ''}${row.bad_hash && row.broken_link ? '; ' : ''}${row.broken_link ? 'previous_hash does not link to the event before it' : ''}`
		);
	}

	const [[span]] = await connection.query<mysql.RowDataPacket[]>(
		'SELECT COALESCE(MIN(sequence), 0) AS first, COALESCE(MAX(sequence), 0) AS last, COUNT(*) AS total FROM audit_events'
	);
	if (Number(span.total) > 0 && (Number(span.first) !== 1 || Number(span.total) !== Number(span.last))) {
		problems.push(`sequence is not contiguous: ${span.total} events spanning ${span.first}..${span.last}`);
	}

	const [[state]] = await connection.query<mysql.RowDataPacket[]>(
		`SELECT s.last_sequence, s.last_hash,
			(SELECT event_hash FROM audit_events ORDER BY sequence DESC LIMIT 1) AS head_hash
		 FROM audit_chain_state s WHERE s.id = 1`
	);
	if (!state) problems.push('audit_chain_state row is missing');
	else if (Number(state.last_sequence) !== Number(span.last) || state.last_hash !== (state.head_hash ?? '0'.repeat(64))) {
		problems.push(`audit_chain_state (${state.last_sequence}) does not match the newest event (${span.last})`);
	}

	// The triggers that block edits to the ledger and record changes to business tables. Needs
	// the database owner (other accounts cannot see trigger bodies).
	const drift = await triggerDrift(connection, database, await expectedTriggers());
	if (drift.missing.length) problems.push(`audit triggers missing: ${drift.missing.join(', ')}`);
	if (drift.changed.length) problems.push(`audit triggers altered: ${drift.changed.join(', ')}`);
	if (drift.unexpected.length) problems.push(`triggers not in the migrations: ${drift.unexpected.join(', ')}`);

	let anchorCount = 0;
	if (anchorsFile) {
		const anchors = (await readAnchors(anchorsFile, allowMissingAnchors)).filter((anchor) => anchor.database === database);
		anchorCount = anchors.length;
		for (const anchor of anchors) {
			const [[row]] = await connection.query<mysql.RowDataPacket[]>(
				'SELECT event_hash FROM audit_events WHERE sequence = ?',
				[anchor.sequence]
			);
			if (!row) problems.push(`anchor ${anchor.sequence} (${anchor.anchoredAt}): event is missing; the ledger was truncated`);
			else if (row.event_hash !== anchor.eventHash)
				problems.push(`anchor ${anchor.sequence} (${anchor.anchoredAt}): hash changed; the ledger was rewritten`);
		}
	}

	return { problems, lastSequence: Number(span.last), anchorCount };
}

async function head(connection: mysql.Connection): Promise<Head> {
	const [[row]] = await connection.query<mysql.RowDataPacket[]>(
		`SELECT sequence, event_hash, DATE_FORMAT(occurred_at, '%Y-%m-%dT%H:%i:%s.%fZ') AS occurred_at
		 FROM audit_events ORDER BY sequence DESC LIMIT 1`
	);
	if (!row) throw new Error('The audit ledger is empty.');
	return { sequence: Number(row.sequence), eventHash: row.event_hash, occurredAt: row.occurred_at };
}

async function main() {
	const command = process.argv[2];
	const anchorsFile = option('--anchors');
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error('DATABASE_URL is not set');
	if (command !== 'verify' && command !== 'anchor') {
		throw new Error('Usage: audit-ledger.ts verify [--anchors <file>] | anchor --anchors <file> [--note <text>]');
	}
	if (command === 'anchor' && !anchorsFile) throw new Error('anchor needs --anchors <file>');

	const database = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
	const connection = await mysql.createConnection(databaseUrl);
	try {
		const result = await verify(connection, database, anchorsFile, command === 'anchor');
		if (result.problems.length) {
			console.error(`Audit ledger verification FAILED (${database}):`);
			for (const problem of result.problems) console.error(`  - ${problem}`);
			// Anchoring a broken ledger would vouch for it.
			if (command === 'anchor') console.error('No anchor was written.');
			process.exitCode = 1;
			return;
		}
		console.log(
			`Audit ledger verified (${database}): ${result.lastSequence} events` +
				(anchorsFile ? `, ${result.anchorCount} anchor(s) match` : ', no anchors checked')
		);
		if (command === 'verify') return;

		const anchored = await head(connection);
		const note = option('--note');
		// Record the anchoring in the ledger itself, so a gap in anchoring is visible there too.
		await connection.query('CALL append_audit_event(?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, NULL, NULL, ?)', [
			randomUUID(),
			'system',
			'audit.anchored',
			'success',
			'audit_ledger',
			String(anchored.sequence),
			JSON.stringify({ sequence: anchored.sequence, eventHash: anchored.eventHash, note: note ?? null })
		]);
		const anchor: Anchor = {
			version: 1,
			anchoredAt: new Date().toISOString(),
			database,
			...anchored,
			...(note ? { note } : {})
		};
		const line = JSON.stringify(anchor);
		await appendFile(anchorsFile!, `${line}\n`, 'utf8');
		console.log(`Anchor appended to ${anchorsFile}. Keep an independent copy of this line:`);
		console.log(line);
	} finally {
		await connection.end();
	}
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exitCode = 1;
});
