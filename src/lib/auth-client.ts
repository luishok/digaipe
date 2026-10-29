import { createAuthClient } from 'better-auth/svelte';
import { adminClient } from 'better-auth/client/plugins';
// No baseURL: the client calls the origin it was served from (dev, Docker or behind a proxy).
export const authClient = createAuthClient({
	plugins: [adminClient()]
});
export const { signIn, signOut, useSession } = authClient;
