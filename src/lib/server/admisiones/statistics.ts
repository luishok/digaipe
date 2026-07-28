import { db } from '$lib/server/db';
import {
	admissionProcessings,
	admissions,
	auditEvents,
	careers,
	mod_admission,
	ocre_types,
	proceso_admission,
	students
} from '$lib/server/db/schema';
import { and, asc, eq, gte, inArray, like, lte, or, sql, type SQL } from 'drizzle-orm';
import { caracasDateKey } from './processing';
import { parseReportMode, type ReportMode } from './report-mode';

export type { ReportMode } from './report-mode';
export type DateBasis = 'asignacion' | 'digaipe';
export type ReviewStatus = 'pendiente' | 'matriculado' | 'devuelto';
export type MatrixDimension = 'carrera' | 'facultad' | 'modalidad';

export type StatisticsFilters = {
	process: string[];
	period: string[];
	modality: string[];
	status: string[];
	career: string[];
	faculty: string[];
	search: string;
};

/** Breakdown dimension titles produced by buildBreakdowns, in display order. */
export const BREAKDOWN_TITLES = [
	'Estado',
	'Diario',
	'Semanal ISO',
	'Mensual',
	'Carrera',
	'Facultad',
	'Etapa',
	'Proceso de admisión',
	'Modalidad',
	'Tipo OCRE',
	'Período de ingreso',
	'Género'
] as const;

export type StatisticsSpec = {
	reportMode: ReportMode;
	dateBasis: DateBasis;
	dateFrom: string;
	dateTo: string;
	includeStudentData: boolean;
	filters: StatisticsFilters;
	/** General: subset of column keys to include (empty/undefined = all). */
	columns?: string[];
	/** Estadísticas: subset of breakdown dimension titles to include (empty/undefined = all). */
	dimensions?: string[];
	/** Reconciliación: row dimension for the cross-tab matrix. */
	matrixDimension: MatrixDimension;
};

export type ReportRow = {
	admissionId: number;
	studentId: number;
	cedula: string;
	student: string;
	gender: string | null;
	assignmentDate: string;
	processingDate: string | null;
	status: string | null;
	period: string;
	year: number;
	stage: number;
	process: string;
	modality: string;
	modalityName: string;
	ocreType: string | null;
	career: string;
	careerCode: number | null;
	ofae: string;
	careerOcre: number | null;
	faculty: string;
	nucleus: string;
	key: string;
};

export type PivotStudent = { label: string; count: number };
export type PivotCareer = { label: string; count: number; students: PivotStudent[] };
export type PivotStatus = { label: string; count: number; careers: PivotCareer[] };
export type PivotDate = { date: string; count: number; statuses: PivotStatus[] };
export type Breakdown = { label: string; count: number; students: number };

export type AgingBucket = { label: string; count: number };
export type MatrixRow = {
	label: string;
	noProcesado: number;
	pendiente: number;
	matriculado: number;
	devuelto: number;
	total: number;
	pctMatric: number;
};
export type OverduePendiente = { cedula: string; student: string; career: string; days: number };

export type Reconciliation = {
	asignados: number;
	noProcesados: number;
	procesados: number;
	byStatus: { pendiente: number; matriculado: number; devuelto: number };
	rates: {
		matriculadosSobreAsignados: number;
		matriculadosSobreProcesados: number;
		noPresentacion: number;
	};
	devoluciones: {
		everDevueltas: number;
		sinRetornar: number;
		reingresadas: number;
		reingresadasMatriculadas: number;
		reingresadasPendientes: number;
		tasaRetorno: number;
	};
	agingPendientes: AgingBucket[];
	agingNoProcesados: AgingBucket[];
	overduePendientes: OverduePendiente[];
	matrix: {
		dimensionLabel: string;
		rows: MatrixRow[];
		totals: Omit<MatrixRow, 'label'>;
	};
};

export type StatisticsReport = {
	spec: StatisticsSpec;
	rows: ReportRow[];
	totalAdmissions: number;
	totalUniqueStudents: number;
	pivot: PivotDate[];
	breakdowns: Record<string, Breakdown[]>;
	reconciliation?: Reconciliation;
};

export type StatisticsOptions = {
	processes: string[];
	periods: string[];
	modalities: string[];
	careers: string[];
	statuses: string[];
	faculties: string[];
};

const statuses = new Set<ReviewStatus>(['pendiente', 'matriculado', 'devuelto']);
const matrixDimensions = new Set<MatrixDimension>(['carrera', 'facultad', 'modalidad']);

function param(url: URL, key: string) {
	return url.searchParams.get(key)?.trim() ?? '';
}
function multiParam(url: URL, key: string) {
	return [
		...new Set(
			url.searchParams
				.getAll(key)
				.map((value) => value.trim())
				.filter(Boolean)
		)
	];
}
function validDate(value: string) {
	return (
		/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
	);
}
function dateValue(value: string) {
	return new Date(`${value}T00:00:00`);
}
function dateOnly(value: Date | string | null) {
	if (!value) return null;
	return typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}
function daysBetween(fromKey: string, toKey: string) {
	const diff = (Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000;
	return Math.max(0, Math.floor(diff));
}

export function parseStatisticsSpec(url: URL): { spec: StatisticsSpec | null; errors: string[] } {
	const dateFrom = param(url, 'dateFrom');
	const dateTo = param(url, 'dateTo');
	const reportMode = parseReportMode(param(url, 'reportMode') || 'general');
	const dateBasis = param(url, 'dateBasis') || 'asignacion';
	const matrixDimension = (param(url, 'matrixDimension') || 'carrera') as MatrixDimension;
	const errors: string[] = [];
	if (!dateFrom || !dateTo) errors.push('Seleccione las fechas Desde y Hasta.');
	if (dateFrom && !validDate(dateFrom)) errors.push('La fecha Desde no es válida.');
	if (dateTo && !validDate(dateTo)) errors.push('La fecha Hasta no es válida.');
	if (dateFrom && dateTo && dateFrom > dateTo)
		errors.push('La fecha Desde debe ser anterior o igual a Hasta.');
	if (!reportMode)
		errors.push('El tipo de reporte no es válido.');
	if (!['asignacion', 'digaipe'].includes(dateBasis)) errors.push('La base de fecha no es válida.');
	if (errors.length || !reportMode) return { spec: null, errors };
	const columns = multiParam(url, 'col');
	const dimensions = multiParam(url, 'dim');
	return {
		spec: {
			reportMode,
			dateBasis: dateBasis as DateBasis,
			dateFrom,
			dateTo,
			includeStudentData: url.searchParams.get('includeStudentData') === 'on',
			filters: {
				process: multiParam(url, 'filter_process'),
				period: multiParam(url, 'filter_period'),
				modality: multiParam(url, 'filter_modality'),
				status: multiParam(url, 'filter_status'),
				career: multiParam(url, 'filter_career'),
				faculty: multiParam(url, 'filter_faculty'),
				search: param(url, 'search')
			},
			columns: columns.length ? columns : undefined,
			dimensions: dimensions.length ? dimensions : undefined,
			matrixDimension: matrixDimensions.has(matrixDimension) ? matrixDimension : 'carrera'
		},
		errors: []
	};
}

/** Filters shared by every report mode (process/period/modality/career/search). */
function filterConditions(spec: StatisticsSpec): SQL[] {
	const conditions: SQL[] = [];
	if (spec.filters.process.length)
		conditions.push(inArray(proceso_admission.code, spec.filters.process));
	if (spec.filters.period.length)
		conditions.push(inArray(admissions.periodoIngreso, spec.filters.period));
	if (spec.filters.modality.length)
		conditions.push(inArray(mod_admission.code, spec.filters.modality));
	if (spec.filters.career.length)
		conditions.push(inArray(careers.programa_academico, spec.filters.career));
	if (spec.filters.faculty.length) conditions.push(inArray(careers.facultad, spec.filters.faculty));
	if (spec.filters.search) {
		const pattern = `%${spec.filters.search}%`;
		conditions.push(
			or(
				like(students.cedula, pattern),
				like(students.apellidos_nombres, pattern),
				like(careers.programa_academico, pattern)
			)!
		);
	}
	return conditions;
}

function conditionsFor(spec: StatisticsSpec): SQL[] {
	const dateColumn =
		spec.dateBasis === 'digaipe' || spec.reportMode !== 'general'
			? admissionProcessings.processingDate
			: admissions.fechaAsignacion;
	const conditions: SQL[] = [
		gte(dateColumn, dateValue(spec.dateFrom)),
		lte(dateColumn, dateValue(spec.dateTo)),
		...filterConditions(spec)
	];
	const statusFilter = spec.filters.status.filter((value) => statuses.has(value as ReviewStatus));
	if (statusFilter.length) conditions.push(inArray(admissionProcessings.status, statusFilter));
	return conditions;
}

function sorted(values: Array<string | number | null>) {
	return [...new Set(values.filter((v): v is string | number => v !== null).map(String))].sort(
		(a, b) => a.localeCompare(b, 'es', { numeric: true })
	);
}

export async function loadStatisticsOptions(): Promise<StatisticsOptions> {
	const [processes, periods, modalities, careerRows, statusRows, facultyRows] = await Promise.all([
		db.select({ value: proceso_admission.code }).from(proceso_admission),
		db.select({ value: admissions.periodoIngreso }).from(admissions),
		db.select({ value: mod_admission.code }).from(mod_admission),
		db.select({ value: careers.programa_academico }).from(careers),
		db.select({ value: admissionProcessings.status }).from(admissionProcessings),
		db.select({ value: careers.facultad }).from(careers)
	]);
	return {
		processes: sorted(processes.map((r) => r.value)),
		periods: sorted(periods.map((r) => r.value)),
		modalities: sorted(modalities.map((r) => r.value)),
		careers: sorted(careerRows.map((r) => r.value)),
		statuses: sorted(statusRows.map((r) => r.value)),
		faculties: sorted(facultyRows.map((r) => r.value))
	};
}

export async function buildStatisticsReport(spec: StatisticsSpec): Promise<StatisticsReport> {
	if (spec.reportMode === 'reconciliacion') {
		const { reconciliation, uniqueStudents } = await buildReconciliation(spec);
		return {
			spec,
			rows: [],
			totalAdmissions: reconciliation.asignados,
			totalUniqueStudents: uniqueStudents,
			pivot: [],
			breakdowns: {},
			reconciliation
		};
	}
	const isProcessedReport =
		spec.reportMode !== 'general' || spec.dateBasis === 'digaipe' || spec.filters.status.length > 0;
	const query = db
		.select({
			admissionId: admissions.id,
			studentId: admissions.studentId,
			cedula: students.cedula,
			student: students.apellidos_nombres,
			gender: students.genero,
			assignmentDate: admissions.fechaAsignacion,
			processingDate: admissionProcessings.processingDate,
			status: admissionProcessings.status,
			period: admissions.periodoIngreso,
			year: admissions.ano,
			stage: admissions.proceso,
			process: proceso_admission.code,
			modality: mod_admission.code,
			modalityName: mod_admission.name,
			ocreType: ocre_types.code,
			career: careers.programa_academico,
			careerCode: careers.codigo,
			ofae: careers.ofae,
			careerOcre: careers.ocre,
			faculty: careers.facultad,
			nucleus: careers.nucleo,
			key: careers.clave
		})
		.from(admissions)
		.innerJoin(students, eq(admissions.studentId, students.id))
		.innerJoin(careers, eq(admissions.careerId, careers.id))
		.innerJoin(proceso_admission, eq(admissions.procesoId, proceso_admission.id))
		.innerJoin(mod_admission, eq(admissions.modalityId, mod_admission.id))
		.leftJoin(ocre_types, eq(admissions.ocreTypeId, ocre_types.id));
	const withProcessing = isProcessedReport
		? query.innerJoin(admissionProcessings, eq(admissionProcessings.admissionId, admissions.id))
		: query.leftJoin(admissionProcessings, eq(admissionProcessings.admissionId, admissions.id));
	const sourceRows = await withProcessing
		.where(and(...conditionsFor(spec)))
		.orderBy(asc(admissions.id));
	const rows: ReportRow[] = sourceRows.map((row) => ({
		...row,
		assignmentDate: dateOnly(row.assignmentDate)!,
		processingDate: dateOnly(row.processingDate)
	}));
	const processedRows = rows.filter((row) => row.processingDate);
	const pivot = buildPivot(processedRows, spec.includeStudentData);
	return {
		spec,
		rows,
		totalAdmissions: rows.length,
		totalUniqueStudents: new Set(rows.map((row) => row.studentId)).size,
		pivot,
		breakdowns: buildBreakdowns(processedRows)
	};
}

type ReconRow = {
	admissionId: number;
	studentId: number;
	processingId: number | null;
	status: string | null;
	assignmentDate: string;
	processingDate: string | null;
	cedula: string;
	student: string;
	career: string;
	faculty: string;
	modality: string;
};

const AGING_BUCKETS: Array<{ label: string; min: number; max: number }> = [
	{ label: '0–3 días', min: 0, max: 3 },
	{ label: '4–7 días', min: 4, max: 7 },
	{ label: '8–15 días', min: 8, max: 15 },
	{ label: 'Más de 15 días', min: 16, max: Infinity }
];

function bucketize(days: number[]): AgingBucket[] {
	return AGING_BUCKETS.map((bucket) => ({
		label: bucket.label,
		count: days.filter((d) => d >= bucket.min && d <= bucket.max).length
	}));
}

export async function buildReconciliation(
	spec: StatisticsSpec
): Promise<{ reconciliation: Reconciliation; uniqueStudents: number }> {
	const dateColumn =
		spec.dateBasis === 'digaipe' ? admissionProcessings.processingDate : admissions.fechaAsignacion;
	const sourceRows = await db
		.select({
			admissionId: admissions.id,
			studentId: admissions.studentId,
			processingId: admissionProcessings.id,
			status: admissionProcessings.status,
			assignmentDate: admissions.fechaAsignacion,
			processingDate: admissionProcessings.processingDate,
			cedula: students.cedula,
			student: students.apellidos_nombres,
			career: careers.programa_academico,
			faculty: careers.facultad,
			modality: mod_admission.code
		})
		.from(admissions)
		.innerJoin(students, eq(admissions.studentId, students.id))
		.innerJoin(careers, eq(admissions.careerId, careers.id))
		.innerJoin(proceso_admission, eq(admissions.procesoId, proceso_admission.id))
		.innerJoin(mod_admission, eq(admissions.modalityId, mod_admission.id))
		.leftJoin(admissionProcessings, eq(admissionProcessings.admissionId, admissions.id))
		.where(
			and(
				// Honor the "Base de fecha" toggle, like the other reports:
				//  · asignacion → cohort assigned in the range (includes never-processed rows)
				//  · digaipe    → throughput: rows PROCESSED in the range (NULL processingDate drops out)
				gte(dateColumn, dateValue(spec.dateFrom)),
				lte(dateColumn, dateValue(spec.dateTo)),
				...filterConditions(spec)
			)
		);
	const rows: ReconRow[] = sourceRows.map((row) => ({
		...row,
		processingId: row.processingId ?? null,
		assignmentDate: dateOnly(row.assignmentDate)!,
		processingDate: dateOnly(row.processingDate)
	}));
	const today = caracasDateKey();

	const asignados = rows.length;
	const procesados = rows.filter((r) => r.processingId !== null);
	const noProcesados = asignados - procesados.length;
	const byStatus = { pendiente: 0, matriculado: 0, devuelto: 0 };
	for (const r of procesados)
		if (r.status && r.status in byStatus) byStatus[r.status as ReviewStatus]++;

	// ── Devoluciones: which admissions were EVER returned (audit ledger) ──
	const everDevueltaGlobal = new Set<number>();
	const devueltoEvents = await db
		.select({ entityId: auditEvents.entityId })
		.from(auditEvents)
		.where(
			and(
				eq(auditEvents.action, 'admission_document.reviewed'),
				eq(auditEvents.entityType, 'admission_processing'),
				sql`JSON_UNQUOTE(JSON_EXTRACT(${auditEvents.afterValue}, '$.status')) = 'devuelto'`
			)
		);
	for (const row of devueltoEvents) everDevueltaGlobal.add(Number(row.entityId));

	let everDevueltas = 0;
	let sinRetornar = 0;
	let reingresadasMatriculadas = 0;
	let reingresadasPendientes = 0;
	for (const r of procesados) {
		const wasDevuelta = r.status === 'devuelto' || everDevueltaGlobal.has(r.processingId!);
		if (!wasDevuelta) continue;
		everDevueltas++;
		if (r.status === 'devuelto') sinRetornar++;
		else if (r.status === 'matriculado') reingresadasMatriculadas++;
		else reingresadasPendientes++;
	}
	const reingresadas = reingresadasMatriculadas + reingresadasPendientes;

	// ── Aging ──
	const agingPendientes = bucketize(
		procesados
			.filter((r) => r.status === 'pendiente' && r.processingDate)
			.map((r) => daysBetween(r.processingDate!, today))
	);
	const agingNoProcesados = bucketize(
		rows.filter((r) => r.processingId === null).map((r) => daysBetween(r.assignmentDate, today))
	);
	const overduePendientes: OverduePendiente[] = spec.includeStudentData
		? procesados
				.filter((r) => r.status === 'pendiente' && r.processingDate)
				.map((r) => ({
					cedula: r.cedula,
					student: r.student,
					career: r.career,
					days: daysBetween(r.processingDate!, today)
				}))
				.filter((r) => r.days > 15)
				.sort((a, b) => b.days - a.days)
				.slice(0, 200)
		: [];

	// ── Cross-tab matrix ──
	const dimensionKey = (r: ReconRow) =>
		spec.matrixDimension === 'facultad'
			? r.faculty
			: spec.matrixDimension === 'modalidad'
				? r.modality
				: r.career;
	const dimensionLabel =
		spec.matrixDimension === 'facultad'
			? 'Facultad'
			: spec.matrixDimension === 'modalidad'
				? 'Modalidad'
				: 'Carrera';
	const matrixMap = new Map<string, Omit<MatrixRow, 'label' | 'pctMatric'>>();
	for (const r of rows) {
		const label = dimensionKey(r);
		const cell = matrixMap.get(label) ?? {
			noProcesado: 0,
			pendiente: 0,
			matriculado: 0,
			devuelto: 0,
			total: 0
		};
		if (r.processingId === null) cell.noProcesado++;
		else if (r.status && r.status in byStatus) cell[r.status as ReviewStatus]++;
		cell.total++;
		matrixMap.set(label, cell);
	}
	const matrixRows: MatrixRow[] = [...matrixMap.entries()]
		.map(([label, cell]) => ({
			label,
			...cell,
			pctMatric: cell.total ? cell.matriculado / cell.total : 0
		}))
		.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'es'));
	const matrixTotals = matrixRows.reduce(
		(acc, r) => ({
			noProcesado: acc.noProcesado + r.noProcesado,
			pendiente: acc.pendiente + r.pendiente,
			matriculado: acc.matriculado + r.matriculado,
			devuelto: acc.devuelto + r.devuelto,
			total: acc.total + r.total,
			pctMatric: 0
		}),
		{ noProcesado: 0, pendiente: 0, matriculado: 0, devuelto: 0, total: 0, pctMatric: 0 }
	);
	matrixTotals.pctMatric = matrixTotals.total ? matrixTotals.matriculado / matrixTotals.total : 0;

	const reconciliation: Reconciliation = {
		asignados,
		noProcesados,
		procesados: procesados.length,
		byStatus,
		rates: {
			matriculadosSobreAsignados: asignados ? byStatus.matriculado / asignados : 0,
			matriculadosSobreProcesados: procesados.length ? byStatus.matriculado / procesados.length : 0,
			noPresentacion: asignados ? noProcesados / asignados : 0
		},
		devoluciones: {
			everDevueltas,
			sinRetornar,
			reingresadas,
			reingresadasMatriculadas,
			reingresadasPendientes,
			tasaRetorno: everDevueltas ? reingresadas / everDevueltas : 0
		},
		agingPendientes,
		agingNoProcesados,
		overduePendientes,
		matrix: { dimensionLabel, rows: matrixRows, totals: matrixTotals }
	};
	return { reconciliation, uniqueStudents: new Set(rows.map((r) => r.studentId)).size };
}

function buildPivot(rows: ReportRow[], includeStudents: boolean): PivotDate[] {
	const dates = new Map<
		string,
		Map<string, Map<string, { count: number; students: Map<string, number> }>>
	>();
	for (const row of rows) {
		const date = row.processingDate!;
		const status = row.status ?? 'pendiente';
		const career = row.career;
		const statusMap = dates.get(date) ?? new Map();
		const careerMap = statusMap.get(status) ?? new Map();
		const entry = careerMap.get(career) ?? { count: 0, students: new Map() };
		entry.count++;
		if (includeStudents) {
			const student = `${row.cedula} — ${row.student}`;
			entry.students.set(student, (entry.students.get(student) ?? 0) + 1);
		}
		careerMap.set(career, entry);
		statusMap.set(status, careerMap);
		dates.set(date, statusMap);
	}
	return [...dates.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, statusesByDate]) => ({
			date,
			count: [...statusesByDate.values()]
				.flatMap((careers) => [...careers.values()])
				.reduce((sum, entry) => sum + entry.count, 0),
			statuses: [...statusesByDate.entries()]
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([label, careers]) => ({
					label,
					count: [...careers.values()].reduce((sum, entry) => sum + entry.count, 0),
					careers: [...careers.entries()]
						.sort(([a], [b]) => a.localeCompare(b))
						.map(([career, entry]) => ({
							label: career,
							count: entry.count,
							students: [...entry.students.entries()]
								.sort(([a], [b]) => a.localeCompare(b))
								.map(([student, count]) => ({ label: student, count }))
						}))
				}))
		}));
}

function buildBreakdowns(rows: ReportRow[]): Record<string, Breakdown[]> {
	const isoWeek = (dateKey: string) => {
		const date = new Date(`${dateKey}T00:00:00Z`);
		const day = date.getUTCDay() || 7;
		date.setUTCDate(date.getUTCDate() - day + 1);
		return `Semana del ${date.toISOString().slice(0, 10)}`;
	};
	const dimensions: Record<string, (row: ReportRow) => string> = {
		Estado: (r) => r.status ?? 'Pendiente',
		Diario: (r) => r.processingDate!,
		'Semanal ISO': (r) => isoWeek(r.processingDate!),
		Mensual: (r) => r.processingDate!.slice(0, 7),
		Carrera: (r) => r.career,
		Facultad: (r) => r.faculty,
		Etapa: (r) => (r.stage === 2 ? 'Reasignación' : '1ª asignación'),
		'Proceso de admisión': (r) => r.process,
		Modalidad: (r) => r.modality,
		'Tipo OCRE': (r) => r.ocreType ?? 'Sin especificar',
		'Período de ingreso': (r) => r.period,
		Género: (r) => r.gender ?? 'Sin especificar'
	};
	return Object.fromEntries(
		Object.entries(dimensions).map(([title, value]) => {
			const groups = new Map<string, Set<number>>();
			const counts = new Map<string, number>();
			for (const row of rows) {
				const label = value(row);
				counts.set(label, (counts.get(label) ?? 0) + 1);
				const students = groups.get(label) ?? new Set();
				students.add(row.studentId);
				groups.set(label, students);
			}
			return [
				title,
				[...counts.entries()]
					.map(([label, count]) => ({ label, count, students: groups.get(label)?.size ?? 0 }))
					.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'))
			];
		})
	);
}

export function exportFileStem(report: StatisticsReport) {
	return `digaipe_${report.spec.reportMode}_${report.spec.dateFrom}_${report.spec.dateTo}`;
}
