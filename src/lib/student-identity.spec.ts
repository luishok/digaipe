import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeStudentIdentity } from './student-identity.ts';

test('formatting and zero padding resolve to one identity without guessing nationality', () => {
	for (const value of ['V12345678', 'v-12345678', 'V 12.345.678', 'V012345678', 'V\u00a012345678'])
		assert.equal(normalizeStudentIdentity(value), 'V012345678');
	assert.equal(normalizeStudentIdentity('E-12345678'), 'E012345678');
	assert.equal(normalizeStudentIdentity('12345678'), null);
});
test('malformed identities are rejected rather than coerced into another student', () => {
	for (const value of ['V12X34', 'V0', 'V000000000', 'V1234567890', 'P12345678', '', null])
		assert.equal(normalizeStudentIdentity(value), null);
});
