import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	admissionImportBatches,
	admissions,
	careers,
	mod_admission,
	ocre_types,
	proceso_admission,
	students
} from '$lib/server/db/schema';
import { and, desc, eq, gte, like, lte, or, sql } from 'drizzle-orm';

function getFilter(url: URL, key: string) {
	return url.searchParams.get(key)?.trim() ?? '';
}

function dateFilterValue(value: string) {
	return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : null;
}

export const load: PageServerLoad = async ({ url }) => {
	const filters = {
		search: getFilter(url, 'search'),
		process: getFilter(url, 'process'),
		period: getFilter(url, 'period'),
		modality: getFilter(url, 'modality'),
		career: getFilter(url, 'career'),
		dateFrom: getFilter(url, 'dateFrom'),
		dateTo: getFilter(url, 'dateTo')
	};

	const conditions = [];
	if (filters.search) {
		const pattern = `%${filters.search}%`;
		conditions.push(
			or(
				like(students.cedula, pattern),
				like(students.apellidos_nombres, pattern),
				like(students.telefono, pattern),
				like(students.correo, pattern)
			)
		);
	}
	if (filters.process) conditions.push(eq(proceso_admission.code, filters.process));
	if (filters.period) conditions.push(eq(admissions.periodoIngreso, filters.period));
	if (filters.modality) conditions.push(eq(mod_admission.code, filters.modality));
	if (filters.career) conditions.push(eq(admissions.opcion, filters.career));

	const dateFrom = dateFilterValue(filters.dateFrom);
	const dateTo = dateFilterValue(filters.dateTo);
	if (dateFrom) conditions.push(gte(admissions.fechaAsignacion, dateFrom));
	if (dateTo) conditions.push(lte(admissions.fechaAsignacion, dateTo));

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	const query = db
		.select({
			id: admissions.id,
			cedula: students.cedula,
			apellidosNombres: students.apellidos_nombres,
			telefono: students.telefono,
			correo: students.correo,
			careerName: careers.todo,
			opcion: admissions.opcion,
			processCode: proceso_admission.code,
			modalityCode: mod_admission.code,
			modalityName: mod_admission.name,
			ocreCode: ocre_types.code,
			periodoIngreso: admissions.periodoIngreso,
			fechaAsignacion: admissions.fechaAsignacion,
			ano: admissions.ano,
			proceso: admissions.proceso,
			batchId: admissions.importBatchId,
			sourceFileName: admissionImportBatches.sourceFileName
		})
		.from(admissions)
		.innerJoin(students, eq(admissions.studentId, students.id))
		.innerJoin(careers, eq(admissions.careerId, careers.id))
		.innerJoin(proceso_admission, eq(admissions.procesoId, proceso_admission.id))
		.innerJoin(mod_admission, eq(admissions.modalityId, mod_admission.id))
		.leftJoin(ocre_types, eq(admissions.ocreTypeId, ocre_types.id))
		.leftJoin(admissionImportBatches, eq(admissions.importBatchId, admissionImportBatches.id))
		.orderBy(desc(admissions.fechaAsignacion), desc(admissions.id))
		.limit(500);

	const rows = whereClause ? await query.where(whereClause) : await query;

	const [processes, periods, modalities, careerOptions] = await Promise.all([
		db.select({ code: proceso_admission.code }).from(proceso_admission).orderBy(proceso_admission.code),
		db
			.select({ period: admissions.periodoIngreso })
			.from(admissions)
			.groupBy(admissions.periodoIngreso)
			.orderBy(desc(admissions.periodoIngreso)),
		db.select({ code: mod_admission.code, name: mod_admission.name }).from(mod_admission).orderBy(mod_admission.code),
		db
			.select({ opcion: admissions.opcion })
			.from(admissions)
			.groupBy(admissions.opcion)
			.orderBy(sql`${admissions.opcion}`)
	]);

	return {
		admissions: rows,
		filters,
		filterOptions: {
			processes,
			periods,
			modalities,
			careerOptions
		}
	};
};
