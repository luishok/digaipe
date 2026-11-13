// "This user must change their password before doing anything else" is stored as a row in
// Better Auth's `verification` table, so no schema change is needed. The row exists from the
// moment an admin sets a password (create or reset) until the user picks their own.
//
// The gate treats any row as pending, whatever its `expiresAt`: Better Auth deletes expired
// verification rows when it looks them up, and a vanished row would let the user keep the
// admin-chosen password. Hence the far-future expiry: 2038-01-01, because `expires_at` is a
// MySQL TIMESTAMP, which cannot store anything after 2038-01-19 (a later date fails the insert).
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { verification } from '$lib/server/db/schema';

type Writer = Pick<typeof db, 'insert' | 'delete'>;

export const CHANGE_PASSWORD_ROUTE = '/digaipe/cambiar-password';

const NEVER = new Date('2038-01-01T00:00:00Z');

const identifierFor = (userId: string) => `must-change-password:${userId}`;

export async function mustChangePassword(userId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: verification.id })
		.from(verification)
		.where(eq(verification.identifier, identifierFor(userId)))
		.limit(1);
	return Boolean(row);
}

/** Flags the user; call in the same transaction that writes the admin-chosen password. */
export async function requirePasswordChange(tx: Writer, userId: string, actorUserId: string | null) {
	await tx.delete(verification).where(eq(verification.identifier, identifierFor(userId)));
	await tx.insert(verification).values({
		id: randomUUID(),
		identifier: identifierFor(userId),
		value: actorUserId ?? 'system',
		expiresAt: NEVER
	});
}

/** Clears the flag; call in the same transaction that writes the user's own password. */
export async function clearPasswordChange(tx: Writer, userId: string) {
	await tx.delete(verification).where(eq(verification.identifier, identifierFor(userId)));
}
