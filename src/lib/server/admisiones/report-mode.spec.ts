import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReportMode } from './report-mode.ts';

test('accepts every report mode that the statistics page can submit', () => {
	assert.equal(parseReportMode('general'), 'general');
	assert.equal(parseReportMode('consolidado'), 'consolidado');
	assert.equal(parseReportMode('estadisticas'), 'estadisticas');
	assert.equal(parseReportMode('reconciliacion'), 'reconciliacion');
});

test('rejects unknown report modes instead of falling back to general', () => {
	assert.equal(parseReportMode('invalid'), null);
});
