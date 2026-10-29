// Sign-in throttle for the /login form action. better-auth's own rate limiter only covers its
// HTTP router, and the form action calls auth.api directly, so it is never limited.
//
// Kept in process memory: the app runs as a single Node process (deploy/compose.yaml).
// Counters reset on restart, which an attacker cannot trigger. Move to a database table
// if the app ever runs as more than one instance.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_ACCOUNT = 5;
const MAX_FAILURES_PER_IP = 20;
// Bounds memory if someone sprays random emails or addresses.
const MAX_TRACKED_KEYS = 10_000;

export type SignInThrottleKeys = { account: string; ip: string };

type Bucket = { failures: number; windowStart: number };

const buckets = new Map<string, Bucket>();

function liveBucket(key: string, now: number) {
	const bucket = buckets.get(key);
	if (bucket && now - bucket.windowStart < WINDOW_MS) return bucket;
	buckets.delete(key);
	return undefined;
}

function retryAfter(key: string, limit: number, now: number) {
	const bucket = liveBucket(key, now);
	return bucket && bucket.failures >= limit ? bucket.windowStart + WINDOW_MS - now : 0;
}

function prune(now: number) {
	for (const [key, bucket] of buckets) {
		if (now - bucket.windowStart >= WINDOW_MS) buckets.delete(key);
	}
	// Map iterates in insertion order, so this drops the oldest windows first.
	for (const key of buckets.keys()) {
		if (buckets.size <= MAX_TRACKED_KEYS) break;
		buckets.delete(key);
	}
}

function increment(key: string, now: number) {
	const bucket = liveBucket(key, now);
	if (bucket) bucket.failures++;
	else buckets.set(key, { failures: 1, windowStart: now });
}

/** Milliseconds until another sign-in attempt is allowed; 0 when allowed now. */
export function signInRetryAfter(keys: SignInThrottleKeys, now = Date.now()) {
	return Math.max(
		retryAfter(`account:${keys.account}`, MAX_FAILURES_PER_ACCOUNT, now),
		retryAfter(`ip:${keys.ip}`, MAX_FAILURES_PER_IP, now)
	);
}

export function recordSignInFailure(keys: SignInThrottleKeys, now = Date.now()) {
	increment(`account:${keys.account}`, now);
	increment(`ip:${keys.ip}`, now);
	if (buckets.size > MAX_TRACKED_KEYS) prune(now);
}

/** A successful sign-in clears the account's failures; the IP's count stays. */
export function clearSignInFailures(keys: SignInThrottleKeys) {
	buckets.delete(`account:${keys.account}`);
}

export function resetSignInThrottle() {
	buckets.clear();
}
