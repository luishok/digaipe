import 'dotenv/config';

import { spawn } from 'node:child_process';
import mysql from 'mysql2/promise';

const confirmation = 'YES';
const requiredEnvironment = [
	'DATABASE_URL',
	'BETTER_AUTH_SECRET',
	'BOOTSTRAP_ADMIN_EMAIL',
	'BOOTSTRAP_ADMIN_PASSWORD'
] as const;

function assertSafeTarget() {
	if (process.env.DIGAIPE_CONFIRM_DEV_DB_RESET !== confirmation) {
		throw new Error(
			'Aborted. Set DIGAIPE_CONFIRM_DEV_DB_RESET=YES to confirm the local development database reset.'
		);
	}

	if (process.env.NODE_ENV === 'production') {
		throw new Error('Aborted. The development database reset cannot run with NODE_ENV=production.');
	}

	for (const name of requiredEnvironment) {
		if (!process.env[name]) {
			throw new Error(`Aborted. ${name} must be set before resetting the database.`);
		}
	}

	const databaseUrl = new URL(process.env.DATABASE_URL!);
	const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
	const databaseName = databaseUrl.pathname.replace(/^\//, '');

	if (!localHosts.has(databaseUrl.hostname) || databaseName !== 'local') {
		throw new Error(
			'Aborted. This command only permits DATABASE_URL targets on localhost using the local database.'
		);
	}
}

async function run(command: string, args: string[]) {
	await new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: process.cwd(),
			stdio: 'inherit',
			windowsHide: true
		});

		child.once('error', reject);
		child.once('exit', (code) => {
			if (code === 0) {
				resolve();
				return;
			}

			reject(new Error(`${command} exited with code ${code ?? 'unknown'}.`));
		});
	});
}

async function waitForDatabase() {
	const databaseUrl = process.env.DATABASE_URL!;
	let lastError: unknown;

	for (let attempt = 1; attempt <= 60; attempt += 1) {
		try {
			const connection = await mysql.createConnection(databaseUrl);
			await connection.ping();
			await connection.end();
			return;
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}
	}

	throw new Error(`MySQL did not become ready within 60 seconds: ${String(lastError)}`);
}

async function main() {
	assertSafeTarget();

	const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
	console.log('Removing the local Docker database volume...');
	await run('docker', ['compose', 'down', '-v']);

	console.log('Starting a fresh local MySQL container...');
	await run('docker', ['compose', 'up', '-d']);

	console.log('Waiting for MySQL...');
	await waitForDatabase();

	console.log('Applying Drizzle migrations...');
	await run(npx, ['drizzle-kit', 'migrate', '--config', 'drizzle.config.ts']);

	console.log('Creating the bootstrap administrator...');
	await run(npx, ['tsx', 'scripts/bootstrap-admin.ts']);

	console.log('Loading admission modalities...');
	await run(npx, ['tsx', 'scripts/load_admission_mod.ts']);

	console.log('Loading OCRE types...');
	await run(npx, ['tsx', 'scripts/load_ocre_types.ts']);

	console.log('Verifying the fresh audit ledger...');
	await run(npx, ['tsx', 'scripts/verify-audit.ts']);

	console.log('Development database rebuild completed.');
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
