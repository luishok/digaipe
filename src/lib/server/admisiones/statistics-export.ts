import { randomUUID } from 'node:crypto';
import type { ReportRow, StatisticsReport, StatisticsSpec } from './statistics';
import {
	formatCount,
	formatDate,
	formatPct,
	palette,
	ReportDoc,
	statusColors,
	type Column,
	type Row
} from './pdf-theme';

export type ExportMeta = { folio?: string; generatedBy?: string };

/** Traceability document reference, e.g. DGP-20260728-A1B2C3. */
export function makeFolio(date = new Date()) {
	const p = (n: number) => String(n).padStart(2, '0');
	const ymd = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}`;
	const rand = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
	return `DGP-${ymd}-${rand}`;
}

const csvCell = (value: unknown) => {
	const text = String(value ?? '');
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const csvLine = (values: unknown[]) => values.map(csvCell).join(',');
const criteria = (report: StatisticsReport) => [
	['Desde', report.spec.dateFrom],
	['Hasta', report.spec.dateTo],
	[
		'Base de fecha',
		report.spec.dateBasis === 'asignacion' ? 'Fecha de asignación origen' : 'Fecha válida DIGAIPE'
	],
	['Datos del estudiante', report.spec.includeStudentData ? 'Sí' : 'No']
];

// ── General report: one flat field list, shared by CSV and the column chooser ──
type FlatField = {
	key: string;
	header: string;
	studentOnly?: boolean;
	value: (row: ReportRow) => string | number;
};
const FLAT_FIELDS: FlatField[] = [
	{ key: 'cedula', header: 'Cédula', studentOnly: true, value: (r) => r.cedula },
	{ key: 'student', header: 'Estudiante', studentOnly: true, value: (r) => r.student },
	{ key: 'fOrigen', header: 'Fecha asignación origen', value: (r) => r.assignmentDate },
	{ key: 'fDigaipe', header: 'Fecha válida DIGAIPE', value: (r) => r.processingDate ?? '' },
	{ key: 'estado', header: 'Estado', value: (r) => r.status ?? '' },
	{ key: 'periodo', header: 'Período', value: (r) => r.period },
	{ key: 'ano', header: 'Año', value: (r) => r.year },
	{ key: 'etapa', header: 'Etapa', value: (r) => r.stage },
	{ key: 'proceso', header: 'Proceso', value: (r) => r.process },
	{ key: 'modalidad', header: 'Modalidad', value: (r) => `${r.modality} - ${r.modalityName}` },
	{ key: 'ocre', header: 'Tipo OCRE', value: (r) => r.ocreType ?? '' },
	{ key: 'carrera', header: 'Carrera', value: (r) => r.career },
	{ key: 'codigo', header: 'Código carrera', value: (r) => r.careerCode ?? '' },
	{ key: 'ofae', header: 'OFAE', value: (r) => r.ofae },
	{ key: 'ocreCarrera', header: 'OCRE carrera', value: (r) => r.careerOcre ?? '' },
	{ key: 'facultad', header: 'Facultad', value: (r) => r.faculty },
	{ key: 'nucleo', header: 'Núcleo', value: (r) => r.nucleus },
	{ key: 'clave', header: 'Clave', value: (r) => r.key },
	{ key: 'genero', header: 'Género', value: (r) => r.gender ?? '' }
];

/** Column options for the general-report column chooser (UI). */
export const GENERAL_COLUMNS = FLAT_FIELDS.map((f) => ({ key: f.key, label: f.header }));

function columnSelected(spec: StatisticsSpec, key: string) {
	return key === 'num' || !spec.columns || spec.columns.includes(key);
}
function csvGeneralFields(spec: StatisticsSpec) {
	return FLAT_FIELDS.filter(
		(f) => (!f.studentOnly || spec.includeStudentData) && columnSelected(spec, f.key)
	);
}
function dimensionSelected(spec: StatisticsSpec, title: string) {
	return !spec.dimensions || spec.dimensions.includes(title);
}

export function buildStatisticsCsv(report: StatisticsReport, meta: ExportMeta = {}) {
	const lines = [
		csvLine([report.spec.reportMode]),
		...(meta.folio ? [csvLine(['Folio', meta.folio])] : []),
		...criteria(report).map(csvLine),
		csvLine(['Total de admisiones', report.totalAdmissions]),
		csvLine(['Total de estudiantes únicos', report.totalUniqueStudents]),
		''
	];
	if (report.spec.reportMode === 'general') {
		const fields = csvGeneralFields(report.spec);
		lines.push(
			csvLine(fields.map((f) => f.header)),
			...report.rows.map((row) => csvLine(fields.map((f) => f.value(row))))
		);
	}
	if (report.spec.reportMode === 'consolidado')
		lines.push(
			...report.pivot.flatMap((date) => [
				csvLine(['Fecha válida', date.date, date.count]),
				...date.statuses.flatMap((status) => [
					csvLine([status.label, status.count]),
					...status.careers.flatMap((career) => [
						csvLine(['', career.label, career.count]),
						...career.students.map((student) => csvLine(['', '', student.label, student.count]))
					])
				]),
				csvLine(['Total fecha', date.date, date.count])
			]),
			csvLine(['Total general', report.totalAdmissions])
		);
	if (report.spec.reportMode === 'estadisticas')
		for (const [title, rows] of Object.entries(report.breakdowns)) {
			if (!dimensionSelected(report.spec, title)) continue;
			const total = report.totalAdmissions || 1;
			let cum = 0;
			lines.push(
				'',
				csvLine([title]),
				csvLine(['Etiqueta', 'Admisiones', '% del total', 'Estudiantes únicos', '% acumulado']),
				...rows.map((row) => {
					cum += row.count;
					return csvLine([
						row.label,
						row.count,
						formatPct(row.count / total),
						row.students,
						formatPct(cum / total)
					]);
				})
			);
		}
	if (report.spec.reportMode === 'reconciliacion' && report.reconciliation) {
		const r = report.reconciliation;
		const m = r.matrix;
		lines.push(
			csvLine(['Embudo', 'Cantidad']),
			csvLine(['Asignados', r.asignados]),
			csvLine(['No procesados', r.noProcesados]),
			csvLine(['Procesados', r.procesados]),
			csvLine(['Pendiente', r.byStatus.pendiente]),
			csvLine(['Matriculado', r.byStatus.matriculado]),
			csvLine(['Devuelto', r.byStatus.devuelto]),
			'',
			csvLine(['Devoluciones', 'Cantidad']),
			csvLine(['Devueltas (histórico)', r.devoluciones.everDevueltas]),
			csvLine(['Sin retornar', r.devoluciones.sinRetornar]),
			csvLine(['Reingresadas', r.devoluciones.reingresadas]),
			csvLine(['Reingresadas, matriculadas', r.devoluciones.reingresadasMatriculadas]),
			csvLine(['Reingresadas, pendientes', r.devoluciones.reingresadasPendientes]),
			'',
			csvLine(['Antigüedad de pendientes', 'Cantidad']),
			...r.agingPendientes.map((b) => csvLine([b.label, b.count])),
			'',
			csvLine(['Antigüedad de no procesados', 'Cantidad']),
			...r.agingNoProcesados.map((b) => csvLine([b.label, b.count])),
			'',
			csvLine([`Matriz ${m.dimensionLabel} x Estado`]),
			csvLine([
				m.dimensionLabel,
				'No procesado',
				'Pendiente',
				'Matriculado',
				'Devuelto',
				'Total',
				'% Matrícula'
			]),
			...m.rows.map((row) =>
				csvLine([
					row.label,
					row.noProcesado,
					row.pendiente,
					row.matriculado,
					row.devuelto,
					row.total,
					formatPct(row.pctMatric)
				])
			),
			csvLine([
				'TOTAL',
				m.totals.noProcesado,
				m.totals.pendiente,
				m.totals.matriculado,
				m.totals.devuelto,
				m.totals.total,
				formatPct(m.totals.pctMatric)
			])
		);
	}
	return `\uFEFF${lines.join('\r\n')}\r\n`;
}

const REPORT_TITLES: Record<StatisticsReport['spec']['reportMode'], string> = {
	general: 'Análisis general de admisiones',
	consolidado: 'Consolidado de revisión',
	estadisticas: 'Estadísticas DIGAIPE',
	reconciliacion: 'Reconciliación de admisiones'
};

function mastheadMeta(report: StatisticsReport) {
	const now = new Date();
	const p = (n: number) => String(n).padStart(2, '0');
	const generatedAt = `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()} ${p(now.getHours())}:${p(now.getMinutes())}`;
	const basis =
		report.spec.dateBasis === 'digaipe' ? 'Fecha válida DIGAIPE' : 'Fecha de asignación origen';
	return [
		`Generado: ${generatedAt}`,
		`Período: ${formatDate(report.spec.dateFrom)} – ${formatDate(report.spec.dateTo)}`,
		`Base de fecha: ${basis}`
	];
}

function mastheadSubtitle(report: StatisticsReport) {
	const total =
		report.spec.reportMode === 'reconciliacion'
			? report.spec.dateBasis === 'digaipe'
				? 'Total de procesados'
				: 'Total de asignados'
			: 'Total de admisiones';
	return [
		`${total}: ${formatCount(report.totalAdmissions)}`,
		`Estudiantes únicos: ${formatCount(report.totalUniqueStudents)}`,
		`Datos del estudiante: ${report.spec.includeStudentData ? 'Sí' : 'No'}`
	].join('  ·  ');
}

function filtersSummary(spec: StatisticsSpec) {
	const parts: string[] = [];
	if (spec.filters.process.length) parts.push(`Proceso: ${spec.filters.process.join(', ')}`);
	if (spec.filters.period.length) parts.push(`Período: ${spec.filters.period.join(', ')}`);
	if (spec.filters.modality.length) parts.push(`Modalidad: ${spec.filters.modality.join(', ')}`);
	if (spec.filters.status.length) parts.push(`Estado: ${spec.filters.status.join(', ')}`);
	if (spec.filters.career.length) parts.push(`Carrera: ${spec.filters.career.join(', ')}`);
	if (spec.filters.faculty.length) parts.push(`Facultad: ${spec.filters.faculty.join(', ')}`);
	if (spec.filters.search) parts.push(`Búsqueda: "${spec.filters.search}"`);
	return parts.join('  ·  ');
}

function drawGeneral(doc: ReportDoc, report: StatisticsReport) {
	const stud = report.spec.includeStudentData;
	type Field = { key: string; col: Column; value: (row: ReportRow, i: number) => string | number };
	const primary: Field[] = [
		{
			key: 'num',
			col: { header: '#', width: 26, align: 'right', mono: true },
			value: (_r, i) => i + 1
		},
		...(stud
			? ([
					{
						key: 'cedula',
						col: { header: 'Cédula', width: 66, mono: true },
						value: (r) => r.cedula
					},
					{ key: 'student', col: { header: 'Estudiante', width: 146 }, value: (r) => r.student }
				] as Field[])
			: []),
		{
			key: 'fOrigen',
			col: { header: stud ? 'F. origen' : 'Fecha origen', width: stud ? 58 : 90, mono: true },
			value: (r) => formatDate(r.assignmentDate)
		},
		{
			key: 'fDigaipe',
			col: { header: stud ? 'F. DIGAIPE' : 'Fecha DIGAIPE', width: stud ? 62 : 90, mono: true },
			value: (r) => formatDate(r.processingDate)
		},
		{
			key: 'estado',
			col: { header: 'Estado', width: stud ? 62 : 80 },
			value: (r) => r.status ?? ''
		},
		{ key: 'carrera', col: { header: 'Carrera', width: 110 }, value: (r) => r.career },
		{ key: 'proceso', col: { header: 'Proceso', width: 70 }, value: (r) => r.process },
		{
			key: 'modalidad',
			col: { header: 'Modalidad', width: stud ? 68 : 84 },
			value: (r) => `${r.modality} - ${r.modalityName}`
		},
		{ key: 'periodo', col: { header: 'Período', width: stud ? 42 : 52 }, value: (r) => r.period }
	];
	const complementary: Field[] = [
		{
			key: 'num',
			col: { header: '#', width: 28, align: 'right', mono: true },
			value: (_r, i) => i + 1
		},
		{ key: 'ocre', col: { header: 'Tipo OCRE', width: 58 }, value: (r) => r.ocreType ?? '' },
		{
			key: 'codigo',
			col: { header: 'Código', width: 52, align: 'right', mono: true },
			value: (r) => r.careerCode ?? ''
		},
		{ key: 'ofae', col: { header: 'OFAE', width: 50 }, value: (r) => r.ofae },
		{
			key: 'ocreCarrera',
			col: { header: 'OCRE carrera', width: 62, align: 'right', mono: true },
			value: (r) => r.careerOcre ?? ''
		},
		{ key: 'facultad', col: { header: 'Facultad', width: 190 }, value: (r) => r.faculty },
		{ key: 'nucleo', col: { header: 'Núcleo', width: 56 }, value: (r) => r.nucleus },
		{ key: 'clave', col: { header: 'Clave', width: 50 }, value: (r) => r.key },
		{
			key: 'ano',
			col: { header: 'Año', width: 44, align: 'right', mono: true },
			value: (r) => r.year
		},
		{
			key: 'etapa',
			col: { header: 'Etapa', width: 44, align: 'right', mono: true },
			value: (r) => r.stage
		},
		{ key: 'genero', col: { header: 'Género', width: 78 }, value: (r) => r.gender ?? '' }
	];
	const render = (title: string, fields: Field[]) => {
		const selected = fields.filter((f) => columnSelected(report.spec, f.key));
		if (selected.length <= 1) return;
		doc.table({
			title,
			zebra: true,
			columns: selected.map((f) => f.col),
			rows: report.rows.map((row, i) => ({ cells: selected.map((f) => f.value(row, i)) }))
		});
	};
	render('Datos principales', primary);
	render('Datos complementarios', complementary);
}

function drawConsolidado(doc: ReportDoc, report: StatisticsReport) {
	const stud = report.spec.includeStudentData;
	const columns: Column[] = stud
		? [
				{ header: 'Fecha válida', width: 74, mono: true },
				{ header: 'Estado', width: 66 },
				{ header: 'Carrera', width: 150 },
				{ header: 'Estudiante', width: 180 },
				{ header: 'Cuenta', width: 62, align: 'right', mono: true }
			]
		: [
				{ header: 'Fecha válida', width: 92, mono: true },
				{ header: 'Estado', width: 90 },
				{ header: 'Carrera', width: 290 },
				{ header: 'Cuenta', width: 60, align: 'right', mono: true }
			];
	const line = (
		fecha: string,
		estado: string,
		carrera: string,
		estudiante: string,
		count: number,
		extra: Partial<Row> = {}
	): Row => ({
		cells: stud
			? [fecha, estado, carrera, estudiante, formatCount(count)]
			: [fecha, estado, carrera, formatCount(count)],
		...extra
	});
	const rows: Row[] = [];
	for (const date of report.pivot) {
		rows.push(
			line(formatDate(date.date), '', '', '', date.count, {
				strong: true,
				fill: palette.accentSoft
			})
		);
		for (const status of date.statuses) {
			rows.push(
				line('', status.label, '', '', status.count, { strong: true, fill: palette.zebra })
			);
			for (const career of status.careers) {
				rows.push(line('', '', career.label, '', career.count));
				if (stud)
					for (const student of career.students)
						rows.push(line('', '', '', student.label, student.count));
			}
		}
		rows.push(
			line(`Total ${formatDate(date.date)}`, '', '', '', date.count, {
				strong: true,
				topRule: true
			})
		);
	}
	rows.push(
		line('TOTAL GENERAL', '', '', '', report.totalAdmissions, {
			strong: true,
			topRule: true,
			fill: palette.accentSoft
		})
	);
	doc.table({ title: 'Consolidado de revisión', columns, rows, fontSize: 8 });
}

function drawEstadisticas(doc: ReportDoc, report: StatisticsReport) {
	doc.kpiRow([
		{ label: 'Admisiones procesadas', value: formatCount(report.totalAdmissions) },
		{ label: 'Estudiantes únicos', value: formatCount(report.totalUniqueStudents) }
	]);
	const total = report.totalAdmissions || 1;
	for (const [title, rows] of Object.entries(report.breakdowns)) {
		if (!dimensionSelected(report.spec, title)) continue;
		let cum = 0;
		doc.table({
			title,
			fontSize: 8,
			columns: [
				{ header: 'Etiqueta', width: 232 },
				{ header: 'Admisiones', width: 80, align: 'right', mono: true, bar: true },
				{ header: '% total', width: 66, align: 'right', mono: true },
				{ header: 'Únicos', width: 88, align: 'right', mono: true },
				{ header: '% acum.', width: 66, align: 'right', mono: true }
			],
			rows: rows.map((row) => {
				cum += row.count;
				return {
					cells: [
						row.label,
						row.count,
						formatPct(row.count / total),
						row.students,
						formatPct(cum / total)
					]
				};
			})
		});
	}
}

function drawReconciliacion(doc: ReportDoc, report: StatisticsReport) {
	const r = report.reconciliation;
	if (!r) return;
	// digaipe basis = throughput view (rows processed in the range); no "no procesados" stage.
	const throughput = report.spec.dateBasis === 'digaipe';
	const base = throughput ? r.procesados : r.asignados;
	const pctOf = (n: number) => (base ? n / base : 0);

	doc.kpiRow(
		throughput
			? [
					{ label: 'Procesados', value: formatCount(r.procesados) },
					{ label: 'Matriculados', value: formatCount(r.byStatus.matriculado) },
					{ label: 'Tasa matriculación', value: formatPct(r.rates.matriculadosSobreProcesados) },
					{ label: 'Devueltos', value: formatCount(r.byStatus.devuelto) }
				]
			: [
					{ label: 'Asignados', value: formatCount(r.asignados) },
					{ label: 'Matriculados', value: formatCount(r.byStatus.matriculado) },
					{ label: 'Tasa matriculación', value: formatPct(r.rates.matriculadosSobreAsignados) },
					{ label: 'Sin procesar', value: formatCount(r.noProcesados) }
				]
	);
	doc.legend([
		{ label: 'Pendiente', color: statusColors.pendiente },
		{ label: 'Matriculado', color: statusColors.matriculado },
		{ label: 'Devuelto', color: statusColors.devuelto },
		...(throughput ? [] : [{ label: 'No procesado', color: statusColors['no procesado'] }])
	]);

	doc.section('Embudo de admisión');
	const statusNodes = [
		{
			label: 'Pendiente',
			count: r.byStatus.pendiente,
			pct: pctOf(r.byStatus.pendiente),
			indent: throughput ? 12 : 24,
			tone: statusColors.pendiente
		},
		{
			label: 'Matriculado',
			count: r.byStatus.matriculado,
			pct: pctOf(r.byStatus.matriculado),
			indent: throughput ? 12 : 24,
			tone: statusColors.matriculado
		},
		{
			label: 'Devuelto',
			count: r.byStatus.devuelto,
			pct: pctOf(r.byStatus.devuelto),
			indent: throughput ? 12 : 24,
			tone: statusColors.devuelto
		}
	];
	doc.funnel(
		throughput
			? [{ label: 'Procesados', count: r.procesados, pct: 1 }, ...statusNodes]
			: [
					{ label: 'Asignados', count: r.asignados, pct: 1 },
					{
						label: 'No procesados',
						count: r.noProcesados,
						pct: pctOf(r.noProcesados),
						indent: 12,
						tone: statusColors['no procesado']
					},
					{ label: 'Procesados', count: r.procesados, pct: pctOf(r.procesados), indent: 12 },
					...statusNodes
				]
	);
	doc.note(
		throughput
			? `Tasa de matriculación: ${formatPct(r.rates.matriculadosSobreProcesados)} de procesados.`
			: `Tasa de matriculación: ${formatPct(r.rates.matriculadosSobreAsignados)} de asignados · ${formatPct(r.rates.matriculadosSobreProcesados)} de procesados. Tasa de no presentación: ${formatPct(r.rates.noPresentacion)}.`
	);

	const d = r.devoluciones;
	const pctD = (n: number) => (d.everDevueltas ? n / d.everDevueltas : 0);
	doc.table({
		title: 'Devoluciones',
		fontSize: 8,
		columns: [
			{ header: 'Concepto', width: 300 },
			{ header: 'Cantidad', width: 120, align: 'right', mono: true },
			{ header: '% de devueltas', width: 112, align: 'right', mono: true }
		],
		rows: [
			{
				cells: ['Devueltas (histórico)', formatCount(d.everDevueltas), formatPct(1)],
				strong: true
			},
			{ cells: ['Sin retornar', formatCount(d.sinRetornar), formatPct(pctD(d.sinRetornar))] },
			{ cells: ['Reingresadas', formatCount(d.reingresadas), formatPct(pctD(d.reingresadas))] },
			{
				cells: [
					'Reingresadas, matriculadas',
					formatCount(d.reingresadasMatriculadas),
					formatPct(pctD(d.reingresadasMatriculadas))
				],
				indent: 10
			},
			{
				cells: [
					'Reingresadas, pendientes',
					formatCount(d.reingresadasPendientes),
					formatPct(pctD(d.reingresadasPendientes))
				],
				indent: 10
			}
		]
	});
	doc.note(`Tasa de retorno de devoluciones: ${formatPct(d.tasaRetorno)}.`);

	const aging = (title: string, buckets: { label: string; count: number }[]) =>
		doc.table({
			title,
			fontSize: 8,
			columns: [
				{ header: 'Rango', width: 300 },
				{ header: 'Cantidad', width: 232, align: 'right', mono: true, bar: true }
			],
			rows: buckets.map((b) => ({ cells: [b.label, b.count] }))
		});
	aging('Antigüedad de pendientes (en revisión)', r.agingPendientes);
	if (!throughput) aging('Antigüedad de no procesados', r.agingNoProcesados);

	const m = r.matrix;
	doc.table({
		title: `Matriz ${m.dimensionLabel} × Estado`,
		fontSize: 7.5,
		columns: [
			{ header: m.dimensionLabel, width: 152 },
			{ header: 'No proc.', width: 64, align: 'right', mono: true },
			{ header: 'Pend.', width: 60, align: 'right', mono: true },
			{ header: 'Matríc.', width: 64, align: 'right', mono: true },
			{ header: 'Devu.', width: 60, align: 'right', mono: true },
			{ header: 'Total', width: 58, align: 'right', mono: true },
			{ header: '% Mat.', width: 74, align: 'right', mono: true }
		],
		rows: [
			...m.rows.map((row) => ({
				cells: [
					row.label,
					row.noProcesado,
					row.pendiente,
					row.matriculado,
					row.devuelto,
					row.total,
					formatPct(row.pctMatric)
				]
			})),
			{
				cells: [
					'TOTAL',
					m.totals.noProcesado,
					m.totals.pendiente,
					m.totals.matriculado,
					m.totals.devuelto,
					m.totals.total,
					formatPct(m.totals.pctMatric)
				],
				strong: true,
				topRule: true
			}
		]
	});

	if (r.overduePendientes.length)
		doc.table({
			title: 'Pendientes vencidos (más de 15 días)',
			fontSize: 7.5,
			columns: [
				{ header: 'Cédula', width: 78, mono: true },
				{ header: 'Estudiante', width: 214 },
				{ header: 'Carrera', width: 180 },
				{ header: 'Días', width: 60, align: 'right', mono: true }
			],
			rows: r.overduePendientes.map((p) => ({ cells: [p.cedula, p.student, p.career, p.days] }))
		});
}

export async function buildStatisticsPdf(report: StatisticsReport, meta: ExportMeta = {}) {
	const orientation = report.spec.reportMode === 'general' ? 'landscape' : 'portrait';
	const doc = await ReportDoc.create(orientation);
	const title = REPORT_TITLES[report.spec.reportMode];
	doc.masthead({ title, subtitle: mastheadSubtitle(report), meta: mastheadMeta(report) });
	const filters = filtersSummary(report.spec);
	if (filters) doc.note(`Filtros — ${filters}`);

	if (report.spec.reportMode === 'general') drawGeneral(doc, report);
	else if (report.spec.reportMode === 'consolidado') drawConsolidado(doc, report);
	else if (report.spec.reportMode === 'estadisticas') drawEstadisticas(doc, report);
	else drawReconciliacion(doc, report);

	return doc.finish({
		left: 'DIGAIPE · Universidad de Los Andes',
		center: `${title} · ${formatDate(report.spec.dateFrom)} – ${formatDate(report.spec.dateTo)}`,
		folio: meta.folio,
		generatedBy: meta.generatedBy
	});
}
