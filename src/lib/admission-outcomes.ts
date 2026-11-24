// Shared by live reports, immutable closure reports, and the admission/review screens.
export type EnrollmentOutcome = 'matriculado' | 'no_matriculado' | 'pendiente';
export const enrollmentLabels: Record<EnrollmentOutcome, string> = {
	matriculado: 'Matriculado',
	no_matriculado: 'No matriculado',
	pendiente: 'Pendiente de matrícula'
};

export type AdmissionOutcomeSource = {
	admissionId: number;
	studentId: number;
	careerId: number;
	processId: number;
	selectedAdmissionId: number | null;
	closedAt: Date | string | null;
	processingStatus: string | null;
};

export function assignmentKey(row: { studentId: number; careerId: number; processId: number }) {
	return `${row.studentId}:${row.careerId}:${row.processId}`;
}

export function admissionOutcome(
	row: Pick<
		AdmissionOutcomeSource,
		'admissionId' | 'selectedAdmissionId' | 'closedAt' | 'processingStatus'
	>
) {
	if (row.selectedAdmissionId === row.admissionId)
		return { outcome: 'matriculado' as const, reason: 'Matrícula registrada' };
	if (row.selectedAdmissionId !== null)
		return { outcome: 'no_matriculado' as const, reason: 'Otra modalidad seleccionada' };
	const reason =
		row.processingStatus === 'devuelto'
			? 'Documentación devuelta'
			: row.processingStatus
				? 'Trámite incompleto'
				: 'Sin trámite registrado';
	return { outcome: row.closedAt ? ('no_matriculado' as const) : ('pendiente' as const), reason };
}

export type EnrollmentSource = AdmissionOutcomeSource & {
	cedula: string;
	student: string;
	career: string;
	faculty: string;
	process: string;
	modality: string;
	modalityName: string;
	period: string;
};
export type EnrollmentRow = Omit<EnrollmentSource, 'processingStatus' | 'closedAt'> & {
	closedAt: string | null;
	modalities: string[];
	offerIds: number[];
	outcome: EnrollmentOutcome;
	reason: string;
};
export type EnrollmentTotals = {
	assigned: number;
	offers: number;
	matriculado: number;
	no_matriculado: number;
	pendiente: number;
};
export type EnrollmentReport = {
	schemaVersion: 1;
	generatedAt: string;
	rows: EnrollmentRow[];
	totals: EnrollmentTotals;
	byCareer: (EnrollmentTotals & { process: string; career: string; faculty: string })[];
};

export function summarizeEnrollment(rows: EnrollmentRow[]): EnrollmentReport['totals'] {
	const totals = {
		assigned: rows.length,
		offers: 0,
		matriculado: 0,
		no_matriculado: 0,
		pendiente: 0
	};
	for (const row of rows) {
		totals[row.outcome]++;
		totals.offers += row.offerIds.length;
	}
	return totals;
}

export function buildEnrollmentReport(
	source: EnrollmentSource[],
	generatedAt = new Date().toISOString()
): EnrollmentReport {
	const groups = new Map<string, EnrollmentSource[]>();
	for (const row of source) {
		const key = assignmentKey(row);
		const group = groups.get(key) ?? [];
		group.push(row);
		groups.set(key, group);
	}
	const rows = [...groups.values()]
		.map((group): EnrollmentRow => {
			// Choose the selected offer first; otherwise reflect the furthest unfinished workflow.
			const sorted = [...group].sort((a, b) => a.admissionId - b.admissionId);
			const row =
				sorted.find((r) => r.selectedAdmissionId === r.admissionId) ??
				sorted.find((r) => r.processingStatus === 'pendiente') ??
				sorted.find((r) => r.processingStatus === 'devuelto') ??
				sorted[0];
			const { processingStatus: _status, closedAt, ...rest } = row;
			return {
				...rest,
				closedAt: closedAt ? new Date(closedAt).toISOString() : null,
				modalities: sorted.map((r) => `${r.modality} - ${r.modalityName}`),
				offerIds: sorted.map((r) => r.admissionId),
				...admissionOutcome(row)
			};
		})
		.sort(
			(a, b) =>
				a.process.localeCompare(b.process) ||
				a.career.localeCompare(b.career) ||
				a.student.localeCompare(b.student)
		);
	return enrollmentReportFromRows(rows, generatedAt);
}

export function enrollmentReportFromRows(
	rows: EnrollmentRow[],
	generatedAt: string
): EnrollmentReport {
	const careers = new Map<string, EnrollmentRow[]>();
	for (const row of rows) {
		const key = `${row.processId}:${row.careerId}`;
		const group = careers.get(key) ?? [];
		group.push(row);
		careers.set(key, group);
	}
	return {
		schemaVersion: 1,
		generatedAt,
		rows,
		totals: summarizeEnrollment(rows),
		byCareer: [...careers.values()].map((group) => ({
			process: group[0].process,
			career: group[0].career,
			faculty: group[0].faculty,
			...summarizeEnrollment(group)
		}))
	};
}
