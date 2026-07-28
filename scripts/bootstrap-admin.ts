import 'dotenv/config';

import { betterAuth } from 'better-auth/minimal';

import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '../src/lib/server/db/schema';

import mysql from 'mysql2/promise';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = mysql.createPool(process.env.DATABASE_URL);
const db = drizzle(client, { schema, mode: 'default' });

const auth = betterAuth({
	baseURL: process.env.ORIGIN,
	secret: process.env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'mysql' }),
	emailAndPassword: { enabled: true },
	plugins: [admin()] // make sure this is the last plugin in the array
});

async function main() {
	const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
	const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
	const name = process.env.BOOTSTRAP_ADMIN_NAME ?? 'Administrator';

	if (!email || !password) {
		throw new Error('Missing BOOTSTRAP_ADMIN_EMAIL or BOOTSTRAP_ADMIN_PASSWORD');
	}

	// Try to find the user first.
	// If you already have direct access to the Better Auth user table through Drizzle,
	// querying that table is the most reliable existence check in a seed script.
	// If not, you can attempt create and handle duplicate-email errors.

	try {
		const created = await auth.api.createUser({
			body: {
				email,
				password,
				name,
				role: 'admin'
			}
		});

		console.log('Bootstrap admin created:', created.user?.email ?? email);
	} catch (error: any) {
		const message = String(error?.message ?? error);

		// Make the script idempotent.
		// Adjust this branch to the exact error shape your setup returns.
		if (
			message.toLowerCase().includes('already') ||
			message.toLowerCase().includes('exists') ||
			message.toLowerCase().includes('duplicate')
		) {
			console.log('Bootstrap admin already exists:', email);
			return;
		}

		throw error;
	}
}

main()
	.then(() => {
		console.log('Bootstrap complete.');
		process.exit(0);
	})
	.catch((err) => {
		console.error('Bootstrap failed:', err);
		process.exit(1);
	});
