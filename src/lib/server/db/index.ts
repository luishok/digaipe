import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';

// `vite build` imports every server module to analyse routes, and the image build has no
// runtime env. The pool connects lazily, so a placeholder URL is never dialled at build time.
if (!building && !env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = mysql.createPool(env.DATABASE_URL || 'mysql://build@localhost/build');

export const db = drizzle(client, { schema, mode: 'default' });
