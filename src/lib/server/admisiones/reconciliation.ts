import { assignmentKey } from '../../admission-outcomes';

export type ReconciliationOffer = {
	admissionId: number;
	studentId: number;
	careerId: number;
	processId: number;
	selectedAdmissionId: number | null;
	processingId: number | null;
	status: string | null;
	assignmentDate: string;
	processingDate: string | null;
	modality: string;
};

/** Collapse BEFORE date/modality filtering, so discarded offers cannot masquerade as no-shows. */
export function collapseReconciliationOffers<T extends ReconciliationOffer>(offers: T[]) {
	const groups = new Map<string, T[]>();
	for (const offer of offers) {
		const key = assignmentKey(offer);
		const group = groups.get(key) ?? [];
		group.push(offer);
		groups.set(key, group);
	}
	return [...groups.values()].map((group) => {
		const ordered = [...group].sort((a, b) => a.admissionId - b.admissionId);
		const representative =
			ordered.find((r) => r.admissionId === r.selectedAdmissionId) ??
			ordered.find((r) => r.status === 'pendiente') ??
			ordered.find((r) => r.status === 'devuelto') ??
			ordered.find((r) => r.processingId !== null) ??
			ordered[0];
		const offeredModalities = [...new Set(ordered.map((r) => r.modality))];
		return {
			...representative,
			// Once enrolled, the chosen offer supplies its assignment date. An earlier
			// discarded offer must not hide that enrollment from its own date range.
			assignmentDate: representative.selectedAdmissionId !== null
				? representative.assignmentDate : ordered.map((r) => r.assignmentDate).sort()[0],
			modality:
				representative.selectedAdmissionId === null && offeredModalities.length > 1
					? 'Varias modalidades'
					: representative.modality,
			offeredModalities,
			offerCount: group.length,
			offerIds: ordered.map((r) => r.admissionId),
			processingIds: ordered.flatMap((r) => (r.processingId === null ? [] : [r.processingId]))
		};
	});
}
