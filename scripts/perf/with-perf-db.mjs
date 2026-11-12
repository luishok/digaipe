// Runs a command against the performance-test database instead of the dev database.
//
//   node scripts/perf/with-perf-db.mjs <command> [args...]
//
// Takes DATABASE_URL from .env, swaps the database name for `digaipe_perf` (same local MySQL
// server), and creates that database if it does not exist. Refuses non-local hosts, so the
// synthetic data can never land in the dev ('local') or a production database.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import mysql from 'mysql2/promise';

export const PERF_DB = 'digaipe_perf';

export function perfEnv() {
	const env = Object.fromEntries(
		readFileSync('.env', 'utf8')
			.split(/\r?\n/)
			.map((line) => /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line))
			.filter(Boolean)
			.map(([, k, v]) => [k, v.trim().replace(/^"|"$/g, '')])
	);
	const url = new URL(env.DATABASE_URL);
	if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname))
		throw new Error('Aborted: the performance database must be on localhost.');
	url.pathname = `/${PERF_DB}`;
	return { ...env, DATABASE_URL: url.toString() };
}

async function ensureDatabase(databaseUrl) {
	const server = new URL(databaseUrl);
	server.pathname = '/';
	const connection = await mysql.createConnection(server.toString());
	await connection.query(
		`CREATE DATABASE IF NOT EXISTS \`${PERF_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`
	);
	await connection.end();
}

if (process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
	const [command, ...args] = process.argv.slice(2);
	if (!command) throw new Error('Usage: node scripts/perf/with-perf-db.mjs <command> [args...]');
	const env = perfEnv();
	await ensureDatabase(env.DATABASE_URL);
	const child = spawn(command, args, {
		stdio: 'inherit',
		shell: process.platform === 'win32',
		env: { ...process.env, ...env }
	});
	child.on('exit', (code) => process.exit(code ?? 1));
}
