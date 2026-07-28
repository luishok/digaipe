import { and, desc, eq, like, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	APActiveDates,
	admissions,
	careers,
	mod_admission,
	ocre_types,
	proceso_admission,
	students
} from '$lib/server/db/schema';
import { caracasDateKey } from './processing';

export type PlanillaAdmission = Awaited<ReturnType<typeof getActiveAdmissionForPlanilla>>;

export function getTodayDateKey(date = new Date()) {
	return caracasDateKey(date);
}

function activeDateValue(today: string) {
	return new Date(`${today}T00:00:00`);
}

export function cleanNullableFormValue(value: FormDataEntryValue | null, maxLength: number) {
	const text = String(value ?? '').trim();
	if (!text) return null;
	return text.slice(0, maxLength);
}

export async function searchActiveAdmissionsForPlanilla(search: string, today = getTodayDateKey()) {
	const pattern = `%${search}%`;
	const conditions = [
		eq(proceso_admission.isEnabled, true),
		eq(APActiveDates.activeDate, activeDateValue(today))
	];

	if (search) {
		const searchCondition = or(
			like(students.cedula, pattern),
			like(students.apellidos_nombres, pattern),
			like(students.telefono, pattern),
			like(students.correo, pattern),
			like(careers.programa_academico, pattern),
			like(proceso_admission.code, pattern)
		);
		if (searchCondition) conditions.push(searchCondition);
	}

	return db
		.select({
			id: admissions.id,
			cedula: students.cedula,
			apellidosNombres: students.apellidos_nombres,
			telefono: students.telefono,
			correo: students.correo,
			genero: students.genero,
			careerName: careers.todo,
			programaAcademico: careers.programa_academico,
			clave: careers.clave,
			opcion: admissions.opcion,
			processCode: proceso_admission.code,
			modalityCode: mod_admission.code,
			modalityName: mod_admission.name,
			activeDate: APActiveDates.activeDate,
			periodoIngreso: admissions.periodoIngreso,
			fechaAsignacion: admissions.fechaAsignacion
		})
		.from(admissions)
		.innerJoin(students, eq(admissions.studentId, students.id))
		.innerJoin(careers, eq(admissions.careerId, careers.id))
		.innerJoin(proceso_admission, eq(admissions.procesoId, proceso_admission.id))
		.innerJoin(APActiveDates, eq(proceso_admission.id, APActiveDates.codeId))
		.innerJoin(mod_admission, eq(admissions.modalityId, mod_admission.id))
		.where(and(...conditions))
		.orderBy(desc(admissions.fechaAsignacion), desc(admissions.id))
		.limit(100);
}

export async function getActiveAdmissionForPlanilla(
	admissionId: number,
	today = getTodayDateKey()
) {
	const [admission] = await db
		.select({
			id: admissions.id,
			studentId: students.id,
			cedula: students.cedula,
			apellidosNombres: students.apellidos_nombres,
			telefono: students.telefono,
			correo: students.correo,
			genero: students.genero,
			careerName: careers.todo,
			programaAcademico: careers.programa_academico,
			facultad: careers.facultad,
			clave: careers.clave,
			opcion: admissions.opcion,
			processCode: proceso_admission.code,
			modalityCode: mod_admission.code,
			modalityName: mod_admission.name,
			ocreCode: ocre_types.code,
			ocreName: ocre_types.name,
			activeDate: APActiveDates.activeDate,
			periodoIngreso: admissions.periodoIngreso,
			fechaAsignacion: admissions.fechaAsignacion,
			ano: admissions.ano,
			proceso: admissions.proceso
		})
		.from(admissions)
		.innerJoin(students, eq(admissions.studentId, students.id))
		.innerJoin(careers, eq(admissions.careerId, careers.id))
		.innerJoin(proceso_admission, eq(admissions.procesoId, proceso_admission.id))
		.innerJoin(APActiveDates, eq(proceso_admission.id, APActiveDates.codeId))
		.innerJoin(mod_admission, eq(admissions.modalityId, mod_admission.id))
		.leftJoin(ocre_types, eq(admissions.ocreTypeId, ocre_types.id))
		.where(
			and(
				eq(admissions.id, admissionId),
				eq(proceso_admission.isEnabled, true),
				eq(APActiveDates.activeDate, activeDateValue(today))
			)
		)
		.limit(1);

	return admission ?? null;
}

function titleCase(value: string) {
	return value
		.toLocaleLowerCase('es-VE')
		.replace(/(^|\s|[-'`])(\p{L})/gu, (_match, separator: string, letter: string) => {
			return `${separator}${letter.toLocaleUpperCase('es-VE')}`;
		});
}

function admissionProcessPrefix(processCode: string) {
	return processCode.replace(/^\.+/, '').trim().split('/')[0] ?? processCode;
}

function formatLegacyDate(value: Date | string) {
	const dateKey = typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10);
	const [year, month, day] = dateKey.split('-');
	return `${day}/${month}/${year}`;
}

export function buildLegacyPlanillaFields(admission: NonNullable<PlanillaAdmission>) {
	const processPrefix = admissionProcessPrefix(admission.processCode);
	const clave = admission.clave ?? admission.opcion;
	const planilla = `. ${processPrefix}${clave}${admission.cedula}`;

	return {
		fechaMat: formatLegacyDate(admission.activeDate),
		propio: titleCase(admission.apellidosNombres),
		planilla,
		mod: admission.modalityName,
		prog: admission.careerName ?? admission.programaAcademico,
		estadisticas: `${admission.cedula} --------- ${admission.apellidosNombres}`,
		clave,
		activo: 'SI',
		condicion: 'Admitido'
	};
}
