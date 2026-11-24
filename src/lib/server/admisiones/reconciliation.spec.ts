import assert from 'node:assert/strict';
import test from 'node:test';
import { collapseReconciliationOffers, type ReconciliationOffer } from './reconciliation.ts';

const offer = (patch: Partial<ReconciliationOffer> = {}): ReconciliationOffer => ({
	admissionId: 1,
	studentId: 1,
	careerId: 1,
	processId: 1,
	selectedAdmissionId: 1,
	processingId: 1,
	status: 'matriculado',
	assignmentDate: '2026-01-01',
	processingDate: '2026-01-02',
	modality: 'AR',
	...patch
});
test('an unprinted discarded alternative never increases assigned or no-processed counts', () => {
	const rows = collapseReconciliationOffers([
		offer(),
		offer({
			admissionId: 2,
			processingId: null,
			status: null,
			processingDate: null,
			modality: 'CV'
		})
	]);
	assert.equal(rows.length, 1);
	assert.equal(rows[0].status, 'matriculado');
	assert.equal(rows[0].offerCount, 2);
	assert.deepEqual(rows[0].processingIds, [1]);
});
test('unselected alternatives collapse to one assignment and retain all processing history', () => {
	const rows = collapseReconciliationOffers([
		offer({ selectedAdmissionId: null, status: 'devuelto' }),
		offer({
			admissionId: 2,
			selectedAdmissionId: null,
			processingId: 2,
			status: 'pendiente',
			modality: 'CV'
		})
	]);
	assert.equal(rows[0].status, 'pendiente');
	assert.equal(rows[0].modality, 'Varias modalidades');
	assert.deepEqual(rows[0].processingIds, [1, 2]);
});

test('the selected offer retains its own assignment date when another offer was assigned earlier', () => {
	const rows = collapseReconciliationOffers([
		offer({
			selectedAdmissionId: 2,
			processingId: null,
			status: null,
			assignmentDate: '2026-03-02'
		}),
		offer({ admissionId: 2, selectedAdmissionId: 2, assignmentDate: '2026-03-20', modality: 'CV' })
	]);
	assert.equal(rows[0].assignmentDate, '2026-03-20');
});
