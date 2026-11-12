import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeLike, parseSearch } from './search.ts';

const cedula = (digits: string, prefix: 'V' | 'E' | null = null) => ({
	kind: 'cedula',
	prefix,
	digits
});

test('every common way of typing a cédula reduces to its significant digits', () => {
	for (const input of ['13118120', '013118120', '13.118.120'])
		assert.deepEqual(parseSearch(input), [cedula('13118120')], input);
	for (const input of ['V13118120', 'v-13.118.120', 'V 13118120', 'V-013118120', 'V. 13.118.120'])
		assert.deepEqual(parseSearch(input), [cedula('13118120', 'V')], input);
	assert.deepEqual(parseSearch('E-81234567'), [cedula('81234567', 'E')]);
});

test('names split into words that may match in any order', () => {
	assert.deepEqual(parseSearch('  juan   pérez '), [
		{ kind: 'word', value: 'juan' },
		{ kind: 'word', value: 'pérez' }
	]);
});

test('a word starting with V or E is not mistaken for a cédula', () => {
	assert.deepEqual(parseSearch('Vargas Elena'), [
		{ kind: 'word', value: 'Vargas' },
		{ kind: 'word', value: 'Elena' }
	]);
});

test('empty, all-zero and oversized input', () => {
	assert.deepEqual(parseSearch('   '), []);
	assert.deepEqual(parseSearch('000'), [{ kind: 'word', value: '000' }]);
	assert.equal(parseSearch('a '.repeat(50)).length, 8);
});

test('LIKE wildcards in user input are escaped', () => {
	assert.equal(escapeLike('50%_a\\b'), '50\\%\\_a\\\\b');
});
