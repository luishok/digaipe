import 'dotenv/config';

import mysql from 'mysql2/promise';

// Creates the MySQL accounts the deployment uses and grants them least privilege
// (see docs/audit-db-roles.md). Must run with the database-owner account, after migrations,
// so new tables get grants.
//
// - APP_DB_USER (required): the web app. DML on business tables, SELECT only on the audit
//   ledger, EXECUTE on append_audit_event.
// - READONLY_DB_USER (optional, only when READONLY_DB_PASSWORD is set): for auditors and SQL
//   tools. SELECT on everything, including the audit ledger, except columns that would let
//   its holder take over accounts. No writes, no procedures, TLS required.
// - BACKUP_DB_USER (optional, only when BACKUP_DB_PASSWORD is set): the backup worker. Dump
//   privileges and EXECUTE on record_backup_event; no writes, no triggers.

const READ_ONLY_TABLES = new Set(['audit_events', 'audit_chain_state', 'audit_logs']);
const SKIPPED_TABLES = new Set(['__drizzle_migrations']);

// Hidden from the read-only account: live session tokens, password hashes, OAuth tokens and
// verification codes. Add any new secret column here when a migration introduces one.
const SECRET_COLUMNS: Record<string, string[]> = {
	session: ['token'],
	account: ['access_token', 'refresh_token', 'id_token', 'password'],
	verification: ['value']
};

const HOST = '%';

function accountName(variable: string) {
	const name = process.env[variable];
	if (!name || !/^[A-Za-z0-9_]{1,32}$/.test(name)) {
		throw new Error(`${variable} must be 1-32 letters, digits or underscores`);
	}
	return name;
}

async function ensureAccount(connection: mysql.Connection, user: string, password: string) {
	await connection.query('CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?', [user, HOST, password]);
	// Keep the password in sync with the environment when it is rotated.
	await connection.query('ALTER USER ?@? IDENTIFIED BY ?', [user, HOST, password]);
}

async function tablesOf(connection: mysql.Connection, database: string) {
	const [tables] = await connection.query<mysql.RowDataPacket[]>(
		`SELECT table_name AS name FROM information_schema.tables
		 WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
		[database]
	);
	return tables.map((table) => String(table.name)).filter((name) => !SKIPPED_TABLES.has(name));
}

async function grantApp(connection: mysql.Connection, database: string, tables: string[]) {
	const user = accountName('APP_DB_USER');
	const password = process.env.APP_DB_PASSWORD;
	if (!password) throw new Error('APP_DB_PASSWORD is not set');
	await ensureAccount(connection, user, password);

	const db = connection.escapeId(database);
	for (const name of tables) {
		const privileges = READ_ONLY_TABLES.has(name) ? 'SELECT' : 'SELECT, INSERT, UPDATE, DELETE';
		await connection.query(`GRANT ${privileges} ON ${db}.${connection.escapeId(name)} TO ?@?`, [user, HOST]);
	}
	await connection.query(`GRANT EXECUTE ON PROCEDURE ${db}.\`append_audit_event\` TO ?@?`, [user, HOST]);
	console.log(`Granted ${user} access to ${tables.length} table(s) in ${database}.`);
}

async function grantReadonly(connection: mysql.Connection, database: string, tables: string[]) {
	const password = process.env.READONLY_DB_PASSWORD;
	if (!password) {
		console.log('READONLY_DB_PASSWORD not set; no read-only account.');
		return;
	}
	const user = accountName('READONLY_DB_USER');
	await ensureAccount(connection, user, password);
	await connection.query('ALTER USER ?@? REQUIRE SSL', [user, HOST]);
	// Start from nothing on every run, so a privilege granted by hand or by an older version
	// of this script cannot linger.
	await connection.query('REVOKE ALL PRIVILEGES, GRANT OPTION FROM ?@?', [user, HOST]);

	const db = connection.escapeId(database);
	let restricted = 0;
	for (const name of tables) {
		const table = `${db}.${connection.escapeId(name)}`;
		const secrets = SECRET_COLUMNS[name];
		if (!secrets) {
			await connection.query(`GRANT SELECT ON ${table} TO ?@?`, [user, HOST]);
			continue;
		}
		const [columns] = await connection.query<mysql.RowDataPacket[]>(
			'SELECT column_name AS name FROM information_schema.columns WHERE table_schema = ? AND table_name = ?',
			[database, name]
		);
		const visible = columns.map((column) => String(column.name)).filter((column) => !secrets.includes(column));
		if (!visible.length) continue;
		const list = visible.map((column) => connection.escapeId(column)).join(', ');
		await connection.query(`GRANT SELECT (${list}) ON ${table} TO ?@?`, [user, HOST]);
		restricted++;
	}
	console.log(
		`Granted ${user} read-only access to ${tables.length} table(s) in ${database} (${restricted} without secret columns).`
	);
}

// The backup worker's account: enough for `mysqldump --single-transaction --routines
// --skip-triggers --no-tablespaces` and for recording backup.* events. It reads all data (a
// backup must be complete, secrets included) but can change nothing. No TRIGGER privilege: in
// MySQL it also allows dropping and creating triggers, i.e. switching off database auditing.
// Triggers are rebuilt from the migrations instead (scripts/ensure-audit-triggers.ts).
// Restore uses root.
async function grantBackup(connection: mysql.Connection, database: string) {
	const password = process.env.BACKUP_DB_PASSWORD;
	if (!password) {
		console.log('BACKUP_DB_PASSWORD not set; no backup account.');
		return;
	}
	const user = accountName('BACKUP_DB_USER');
	await ensureAccount(connection, user, password);
	await connection.query('REVOKE ALL PRIVILEGES, GRANT OPTION FROM ?@?', [user, HOST]);

	const db = connection.escapeId(database);
	await connection.query(`GRANT SELECT, SHOW VIEW ON ${db}.* TO ?@?`, [user, HOST]);
	// Lets SHOW CREATE PROCEDURE return the body for routines defined by root. It only exposes
	// routine definitions, not data.
	await connection.query('GRANT SHOW_ROUTINE ON *.* TO ?@?', [user, HOST]);
	// Only backup.* events; append_audit_event would let it write any event under any actor.
	await connection.query(`GRANT EXECUTE ON PROCEDURE ${db}.\`record_backup_event\` TO ?@?`, [user, HOST]);
	console.log(`Granted ${user} backup access to ${database}.`);
}

async function main() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error('DATABASE_URL is not set');
	const database = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
	const connection = await mysql.createConnection(databaseUrl);
	try {
		const tables = await tablesOf(connection, database);
		await grantApp(connection, database, tables);
		await grantReadonly(connection, database, tables);
		await grantBackup(connection, database);
	} finally {
		await connection.end();
	}
}

main().catch((err) => {
	console.error('Grant failed:', err);
	process.exit(1);
});
