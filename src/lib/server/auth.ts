import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { admin } from 'better-auth/plugins';

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: 'mysql' }),
	emailAndPassword: { enabled: true, disableSignUp: true },
	// Shared office PCs: a session ends after 8 hours without use (default was 7 days). Each use
	// at least an hour after the last refresh extends it, so it is an idle timeout, not a cap.
	session: { expiresIn: 60 * 60 * 8, updateAge: 60 * 60 },
	plugins: [admin(), sveltekitCookies(getRequestEvent)] // make sure this is the last plugin in the array
});
