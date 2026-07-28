import { db } from '../src/lib/server/db/index.js';
import { sql } from 'drizzle-orm';

type VerificationRow = {
	sequence: number;
	event_hash: string;
	previous_hash: string;
	expected_previous_hash: string;
	expected_event_hash: string;
};

const rows = (await db.execute(
	sql.raw(`
	WITH ordered AS (
		SELECT
			sequence,
			event_hash,
			previous_hash,
			COALESCE(LAG(event_hash) OVER (ORDER BY sequence), REPEAT('0', 64)) AS expected_previous_hash,
			occurred_at,
			source,
			action,
			outcome,
			actor_user_id,
			actor_name,
			actor_email,
			correlation_id,
			ip_address,
			user_agent,
			entity_type,
			entity_id,
			before_value,
			after_value,
			metadata
		FROM audit_events
	), verified AS (
		SELECT
			*,
			SHA2(CONCAT_WS('|',
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
			), 256) AS expected_event_hash
		FROM ordered
	)
	SELECT sequence, event_hash, previous_hash, expected_previous_hash, expected_event_hash
	FROM verified
	WHERE previous_hash <> expected_previous_hash OR event_hash <> expected_event_hash
	ORDER BY sequence
`)
)) as unknown as VerificationRow[];

const [chainState] = (await db.execute(
	sql.raw(`
	SELECT
		state.last_sequence,
		state.last_hash,
		COALESCE((SELECT MAX(sequence) FROM audit_events), 0) AS expected_last_sequence,
		COALESCE((SELECT event_hash FROM audit_events ORDER BY sequence DESC LIMIT 1), REPEAT('0', 64)) AS expected_last_hash
	FROM audit_chain_state AS state
	WHERE state.id = 1
`)
)) as unknown as Array<{
	last_sequence: number;
	last_hash: string;
	expected_last_sequence: number;
	expected_last_hash: string;
}>;

const stateIsValid =
	chainState &&
	Number(chainState.last_sequence) === Number(chainState.expected_last_sequence) &&
	chainState.last_hash === chainState.expected_last_hash;

if (rows.length || !stateIsValid) {
	console.error('Audit ledger verification failed.');
	if (rows.length) console.error(`Invalid events: ${rows.map((row) => row.sequence).join(', ')}`);
	if (!stateIsValid) console.error('Audit chain state does not match the last ledger event.');
	process.exitCode = 1;
} else {
	console.log(`Audit ledger verified through sequence ${chainState.expected_last_sequence}.`);
}
