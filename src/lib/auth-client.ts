import { createAuthClient } from 'better-auth/svelte';
import { adminClient } from 'better-auth/client/plugins';
export const authClient = createAuthClient({
	/** The base URL of the server (optional if you're using the same domain) */
	baseURL: 'http://localhost:5173',
	plugins: [adminClient()]
});
export const { signIn, signUp, signOut, useSession } = authClient;
