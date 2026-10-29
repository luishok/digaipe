import assert from 'node:assert/strict';
import test from 'node:test';
import { can, formatRoles, parseRoles, PERMISSIONS } from './permissions.ts';

test('admin holds every permission', () => {
	for (const permission of PERMISSIONS) assert.ok(can({ role: 'admin' }, permission), permission);
});

test('each operational role is limited to its own job', () => {
	assert.ok(can({ role: 'planillas' }, 'planillas.generate'));
	assert.ok(!can({ role: 'planillas' }, 'documents.review'));
	assert.ok(can({ role: 'revisor' }, 'documents.unlock'));
	assert.ok(!can({ role: 'revisor' }, 'planillas.generate'));
	assert.ok(can({ role: 'estadisticas' }, 'statistics.view'));
	assert.ok(!can({ role: 'estadisticas' }, 'admissions.view'));
	assert.ok(can({ role: 'cargador' }, 'catalogs.import'));
	assert.ok(!can({ role: 'cargador' }, 'users.manage'));
});

test('auditor can view everything and change nothing', () => {
	for (const permission of PERMISSIONS) {
		assert.equal(can({ role: 'auditor' }, permission), permission.endsWith('.view'), permission);
	}
});

test('roles combine, and unknown or legacy values grant nothing', () => {
	assert.ok(can({ role: 'planillas,revisor' }, 'planillas.generate'));
	assert.ok(can({ role: 'planillas, revisor' }, 'documents.review'));
	assert.ok(!can({ role: 'user' }, 'catalogs.view'));
	assert.ok(!can({ role: null }, 'catalogs.view'));
	assert.ok(!can(null, 'catalogs.view'));
	assert.deepEqual(parseRoles('revisor,bogus,revisor'), ['revisor']);
	assert.equal(formatRoles(['revisor', 'admin', 'bogus']), 'admin,revisor');
});
