import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { wrapText } from './pdf-theme.ts';

const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
const width = (s: string) => font.widthOfTextAtSize(s, 7.5);

test('short text stays on one line', () => {
	assert.deepEqual(wrapText('AR', font, 7.5, 60), ['AR']);
});
test('modality names wrap at word boundaries without losing text', () => {
	// 64pt ≈ the General PDF's Modalidad column (68) minus padding.
	assert.deepEqual(wrapText('AR - ALTO RENDIMIENTO', font, 7.5, 64, 3), [
		'AR - ALTO',
		'RENDIMIENTO'
	]);
	const ps = wrapText('PS - IPES: Prueba de Habilidades Específicas', font, 7.5, 64, 3);
	assert.equal(ps.join(' '), 'PS - IPES: Prueba de Habilidades Específicas');
	assert.ok(ps.every((l) => width(l) <= 64));
	// The full OPSU catalog name is longer than 3 lines: trimmed, never overflowing.
	const ops = wrapText(
		'OPS - Oficina de Planificación del Sector Universitario -OPSU-',
		font,
		7.5,
		64,
		3
	);
	assert.equal(ops.length, 3);
	assert.ok(ops[2].endsWith('…') && ops.every((l) => width(l) <= 64));
});
test('process codes break after "/" or "-" and keep every character', () => {
	for (const code of ['UA136/26-11-09', 'CONCILIACION-111']) {
		const lines = wrapText(code, font, 7.5, 40, 3);
		assert.ok(
			lines.every((l) => width(l) <= 40),
			JSON.stringify(lines)
		);
		assert.equal(lines.join(''), code);
	}
});
test('text beyond maxLines ends in an ellipsis within the width', () => {
	const lines = wrapText('uno dos tres cuatro cinco seis siete ocho nueve diez', font, 7.5, 30, 2);
	assert.equal(lines.length, 2);
	assert.ok(lines[1].endsWith('…') && width(lines[1]) <= 30);
});
test('notes wrap with no line limit', () => {
	const text =
		'Una asignación por estudiante, carrera y proceso: 111 asignaciones y 122 ofertas. Una alternativa descartada no cuenta como no procesado.';
	const lines = wrapText(text, font, 8.5, 200);
	assert.ok(lines.length > 1);
	assert.equal(lines.join(' '), text);
});
