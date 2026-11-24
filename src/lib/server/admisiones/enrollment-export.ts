import { enrollmentLabels, type EnrollmentReport } from '$lib/admission-outcomes';
import { csvLine } from './csv';
import { ReportDoc, formatCount, type Column } from './pdf-theme';
import { formatDateTime } from '$lib/dates';

export type EnrollmentExportMeta = {
	title?: string;
	folio?: string;
	generatedBy?: string;
	sha256?: string;
};

export function buildEnrollmentCsv(
	report: EnrollmentReport,
	includeStudents: boolean,
	meta: EnrollmentExportMeta = {}
) {
	const lines = [
		csvLine([meta.title ?? 'Resultado de matrícula por proceso']),
		csvLine(['Fecha del informe', report.generatedAt]),
		csvLine(['Folio', meta.folio ?? '']),
		...(meta.sha256 ? [csvLine(['SHA-256 del informe', meta.sha256])] : []),
		csvLine([
			'Proceso',
			'Facultad',
			'Carrera',
			'Asignados',
			'Ofertas',
			'Matriculados',
			'No matriculados',
			'Pendientes'
		]),
		...report.byCareer.map((r) =>
			csvLine([
				r.process,
				r.faculty,
				r.career,
				r.assigned,
				r.offers,
				r.matriculado,
				r.no_matriculado,
				r.pendiente
			])
		),
		csvLine([
			'TOTAL',
			'',
			'',
			report.totals.assigned,
			report.totals.offers,
			report.totals.matriculado,
			report.totals.no_matriculado,
			report.totals.pendiente
		])
	];
	if (includeStudents)
		lines.push(
			'',
			csvLine([
				'Proceso',
				'Facultad',
				'Carrera',
				'Cédula',
				'Estudiante',
				'Modalidades ofrecidas',
				'Modalidad matriculada',
				'Resultado',
				'Motivo'
			]),
			...report.rows.map((r) =>
				csvLine([
					r.process,
					r.faculty,
					r.career,
					r.cedula,
					r.student,
					r.modalities.join(', '),
					r.outcome === 'matriculado' ? `${r.modality} - ${r.modalityName}` : '',
					enrollmentLabels[r.outcome],
					r.reason
				])
			)
		);
	lines.push(
		'',
		csvLine([
			'Una asignación por estudiante, carrera y proceso. Las ofertas incluyen modalidades alternativas.'
		]),
		csvLine(['Los cupos disponibles requieren conocer el cupo autorizado.'])
	);
	return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export async function buildEnrollmentPdf(
	report: EnrollmentReport,
	includeStudents: boolean,
	meta: EnrollmentExportMeta = {}
) {
	const doc = await ReportDoc.create('landscape');
	doc.masthead({
		title: meta.title ?? 'Resultado de matrícula por proceso',
		subtitle: `Asignados: ${formatCount(report.totals.assigned)} · Matriculados: ${formatCount(report.totals.matriculado)} · No matriculados: ${formatCount(report.totals.no_matriculado)} · Pendientes: ${formatCount(report.totals.pendiente)}`,
		meta: [`Fecha del informe: ${formatDateTime(report.generatedAt)}`]
	});
	doc.note(
		'Una asignación por estudiante, carrera y proceso. Las ofertas incluyen las modalidades alternativas.'
	);
	if (report.totals.pendiente)
		doc.note('Resultado provisional: hay procesos abiertos con asignaciones pendientes.');
	const columns: Column[] = [
		{ header: 'Proceso', width: 105 },
		{ header: 'Facultad / Carrera', width: 247 },
		...['Asignados', 'Ofertas', 'Matric.', 'No matric.', 'Pendientes'].map((header) => ({
			header,
			width: 72,
			align: 'right' as const
		}))
	];
	doc.table({
		title: 'Resumen por carrera y proceso',
		columns,
		rows: report.byCareer.map((r) => ({
			cells: [
				r.process,
				`${r.faculty} / ${r.career}`,
				r.assigned,
				r.offers,
				r.matriculado,
				r.no_matriculado,
				r.pendiente
			]
		})),
		fontSize: 8
	});
	if (includeStudents)
		doc.table({
			title: 'Detalle de asignaciones',
			columns: [
				{ header: 'Proceso / Carrera', width: 153 },
				{ header: 'Cédula', width: 75 },
				{ header: 'Estudiante', width: 150 },
				{ header: 'Modalidad elegida', width: 105 },
				{ header: 'Resultado', width: 91 },
				{ header: 'Motivo', width: 138 }
			],
			rows: report.rows.map((r) => ({
				cells: [
					`${r.process} / ${r.career}`,
					r.cedula,
					r.student,
					r.outcome === 'matriculado' ? r.modalityName : '—',
					enrollmentLabels[r.outcome],
					r.reason
				]
			})),
			fontSize: 7
		});
	doc.note('Los cupos disponibles requieren conocer el cupo autorizado.');
	if (meta.sha256) doc.note(`SHA-256 del informe: ${meta.sha256}`);
	return doc.finish({
		left: 'DIGAIPE · Universidad de Los Andes',
		center: 'Resultado de matrícula',
		folio: meta.folio,
		generatedBy: meta.generatedBy
	});
}
