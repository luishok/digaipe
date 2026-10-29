import assert from 'node:assert/strict';
import test from 'node:test';
import { csvCell, csvLine } from './csv.ts';

test('neutralizes text that a spreadsheet would run as a formula', () => {
	assert.equal(csvCell('=HYPERLINK("http://x","clic")'), `"'=HYPERLINK(""http://x"",""clic"")"`);
	assert.equal(csvCell('+58 412'), "'+58 412");
	assert.equal(csvCell('-cmd'), "'-cmd");
	assert.equal(csvCell('@SUM(A1)'), "'@SUM(A1)");
	assert.equal(csvCell('\t=1+1'), "'\t=1+1");
});

test('leaves numbers and ordinary text alone', () => {
	assert.equal(csvCell(-3), '-3');
	assert.equal(csvCell(42), '42');
	assert.equal(csvCell('PÉREZ, ANA'), '"PÉREZ, ANA"');
	assert.equal(csvCell(null), '');
	assert.equal(csvLine(['Total', 7]), 'Total,7');
});
