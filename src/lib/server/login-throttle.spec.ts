import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
	clearSignInFailures,
	recordSignInFailure,
	resetSignInThrottle,
	signInRetryAfter
} from './login-throttle';

const minute = 60 * 1000;
const keys = { account: 'a', ip: '10.0.0.1' };

beforeEach(() => resetSignInThrottle());

test('allows the first five failures for an account and blocks the sixth attempt', () => {
	for (let i = 0; i < 4; i++) recordSignInFailure(keys, 0);
	assert.equal(signInRetryAfter(keys, 0), 0);
	recordSignInFailure(keys, 0);
	assert.equal(signInRetryAfter(keys, minute), 14 * minute);
});

test('unblocks once the 15 minute window has passed', () => {
	for (let i = 0; i < 5; i++) recordSignInFailure(keys, 0);
	assert.equal(signInRetryAfter(keys, 15 * minute), 0);
});

test('blocks an IP spraying many accounts after twenty failures', () => {
	for (let i = 0; i < 20; i++) recordSignInFailure({ account: `user${i}`, ip: keys.ip }, 0);
	assert.ok(signInRetryAfter({ account: 'fresh', ip: keys.ip }, 0) > 0);
	assert.equal(signInRetryAfter({ account: 'fresh', ip: '10.0.0.2' }, 0), 0);
});

test('a successful sign-in clears the account but not the IP', () => {
	for (let i = 0; i < 5; i++) recordSignInFailure(keys, 0);
	clearSignInFailures(keys);
	assert.equal(signInRetryAfter(keys, 0), 0);
	for (let i = 0; i < 15; i++) recordSignInFailure({ account: `user${i}`, ip: keys.ip }, 0);
	assert.ok(signInRetryAfter(keys, 0) > 0);
});
