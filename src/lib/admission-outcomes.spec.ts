import assert from 'node:assert/strict';
import test from 'node:test';
import {
	admissionOutcome,
	buildEnrollmentReport,
	type EnrollmentSource
} from './admission-outcomes.ts';

const offer = (overrides: Partial<EnrollmentSource> = {}): EnrollmentSource => ({
	admissionId: 1,
	studentId: 1,
	careerId: 1,
	processId: 1,
	selectedAdmissionId: null,
	closedAt: null,
	processingStatus: null,
	cedula: 'V000000001',
	student: 'ESTUDIANTE DE PRUEBA',
	career: 'CARRERA DE PRUEBA',
	faculty: 'FACULTAD',
	process: 'PROCESO',
	modality: 'AR',
	modalityName: 'Alto rendimiento',
	period: 'A2026',
	...overrides
});

test('unprocessed assignments become no matriculado only after official closure', () => {
	assert.deepEqual(admissionOutcome(offer()), {
		outcome: 'pendiente',
		reason: ''
	});
	assert.deepEqual(admissionOutcome(offer({ closedAt: '2026-11-24T12:00:00Z' })), {
		outcome: 'no_matriculado',
		reason: ''
	});
});

test('an unprinted alternative is excluded immediately when another offer was selected', () => {
	assert.deepEqual(admissionOutcome(offer({ selectedAdmissionId: 2 })), {
		outcome: 'no_matriculado',
		reason: 'Otra modalidad seleccionada'
	});
	const report = buildEnrollmentReport([
		offer({ selectedAdmissionId: 2 }),
		offer({
			admissionId: 2,
			modality: 'CV',
			modalityName: 'Convenio',
			selectedAdmissionId: 2,
			processingStatus: 'matriculado'
		})
	]);
	assert.deepEqual(report.totals, {
		assigned: 1,
		offers: 2,
		matriculado: 1,
		no_matriculado: 0,
		pendiente: 0
	});
	assert.equal(report.rows[0].modality, 'CV');
	assert.equal(report.rows[0].reason, '');
});

test('closure preserves returned/incomplete reasons without counting modalities twice', () => {
	const closedAt = '2026-11-24T12:00:00Z';
	const source = [
		offer({ closedAt, processingStatus: 'devuelto' }),
		offer({ admissionId: 2, closedAt, modality: 'CV' }),
		offer({ admissionId: 3, studentId: 2, closedAt, processingStatus: 'pendiente' })
	];
	const report = buildEnrollmentReport(source);
	assert.deepEqual(report.totals, {
		assigned: 2,
		offers: 3,
		matriculado: 0,
		no_matriculado: 2,
		pendiente: 0
	});
	assert.equal(report.rows[0].reason, 'Documentación devuelta');
	assert.equal(report.rows[1].reason, 'Trámite incompleto');
	assert.equal(source[0].processingStatus, 'devuelto');
});

test('other careers and processes remain independent for the same student', () => {
	const report = buildEnrollmentReport([
		offer({ selectedAdmissionId: 1 }),
		offer({ admissionId: 2, careerId: 2 }),
		offer({ admissionId: 3, processId: 2 })
	]);
	assert.equal(report.totals.assigned, 3);
	assert.equal(report.totals.matriculado, 1);
	assert.equal(report.totals.pendiente, 2);
});

test('100 assignments with 115 modality offers and 70 matriculations leave 30 unfilled assignments', () => {
	const rows = Array.from({ length: 100 }, (_, i) =>
		offer({
			admissionId: i + 1,
			studentId: i + 1,
			selectedAdmissionId: i < 70 ? i + 1 : null,
			closedAt: '2026-11-24T12:00:00Z'
		})
	);
	rows.push(
		...rows.slice(0, 15).map((row, i) => ({ ...row, admissionId: 101 + i, modality: 'CV' }))
	);
	const report = buildEnrollmentReport(rows);
	assert.deepEqual(report.totals, {
		assigned: 100,
		offers: 115,
		matriculado: 70,
		no_matriculado: 30,
		pendiente: 0
	});
	assert.deepEqual(report.byCareer[0].assigned, 100);
});
