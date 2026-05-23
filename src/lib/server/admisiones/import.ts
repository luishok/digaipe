import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import type { AuditContext } from '$lib/server/audit';
import { writeAuditLog } from '$lib/server/audit';
import {
	admissionImportBatches,
	admissions,
	careers,
	mod_admission,
	ocre_types,
	proceso_admission,
	students
} from '$lib/server/db/schema';

export type AdmissionPreviewIssue = {
	row: number;
	field: string;
	message: string;
};

export type AdmissionPreviewRow = {
	row: number;
	numAsignacion: string;
	cedula: string;
	apellidosNombres: string;
	telefono: string | null;
	correo: string | null;
	opcion: string;
	periodoIngreso: string;
	fechaAsignacion: string;
	modaIngreso: string;
	codOcre: string;
	ano: number | null;
	proceso: number | null;
	careerName: string | null;
	modalityName: string | null;
	ocreName: string | null;
	warnings: AdmissionPreviewIssue[];
	errors: AdmissionPreviewIssue[];
};

export type AdmissionPreview = {
	rows: AdmissionPreviewRow[];
	warnings: AdmissionPreviewIssue[];
	errors: AdmissionPreviewIssue[];
};

type RawAdmissionRow = Record<string, unknown>;

type FileWriteResult = {
	fileName: string;
	filePath: string;
	sha256: string;
};

type ResolvedCatalogs = {
	processesByCode: Map<string, { id: number; code: string }>;
	careersByOfae: Map<string, { id: number; ofae: string; name: string | null }>;
	modalitiesByCode: Map<string, { id: number; code: string; name: string }>;
	ocreTypesByCode: Map<string, { id: number; code: string; name: string }>;
};

export const ADMISSION_UPLOAD_ROOT = path.resolve(process.cwd(), 'var', 'uploads', 'admisiones');

const requiredHeaders = [
	'Num_Asignacion',
	'Ced_estudiante',
	'Apel_Nom',
	'Periodo_ingreso',
	'Fecha_asignacion',
	'Opcion',
	'Moda_Ingre',
	'Cod_Ocre',
	'Ano',
	'Proceso'
];

function cleanString(value: unknown): string {
	return String(value ?? '').trim();
}

function cleanUpper(value: unknown): string {
	return cleanString(value).toUpperCase();
}

function normalizeCatalogCode(value: unknown): string {
	return cleanUpper(value).replace(/^\.+/, '').trim().replace(/\s+/g, '');
}

function emptyDotToNull(value: unknown): string | null {
	const cleaned = cleanString(value);
	if (!cleaned || cleaned === '.') return null;
	return cleaned;
}

function parseInteger(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
	const cleaned = cleanString(value);
	if (!cleaned) return null;
	const parsed = Number(cleaned);
	return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function parseDateValue(value: unknown): string {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		return value.toISOString().slice(0, 10);
	}

	if (typeof value === 'number' && Number.isFinite(value)) {
		const parsed = XLSX.SSF.parse_date_code(value);
		if (parsed) {
			const year = String(parsed.y).padStart(4, '0');
			const month = String(parsed.m).padStart(2, '0');
			const day = String(parsed.d).padStart(2, '0');
			return `${year}-${month}-${day}`;
		}
	}

	const cleaned = cleanString(value);
	const match = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
	if (match) {
		const [, day, month, year] = match;
		return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
	}

	return cleaned;
}

function sanitizeFileName(fileName: string): string {
	return path.basename(fileName).replace(/[^\w.\-() ]+/g, '_');
}

function isUploadFile(value: FormDataEntryValue | null): value is File {
	return value instanceof File && value.size > 0;
}

function validateFile(file: FormDataEntryValue | null, allowedExtensions: string[], label: string): File {
	if (!isUploadFile(file)) {
		throw new Error(`Debe cargar el archivo ${label}.`);
	}

	const extension = path.extname(file.name).toLowerCase();
	if (!allowedExtensions.includes(extension)) {
		throw new Error(`El archivo ${label} debe ser ${allowedExtensions.join(' o ')}.`);
	}

	return file;
}

async function writeUploadFile(file: File, directory: string): Promise<FileWriteResult> {
	await mkdir(directory, { recursive: true });

	const bytes = Buffer.from(await file.arrayBuffer());
	const sha256 = createHash('sha256').update(bytes).digest('hex');
	const fileName = sanitizeFileName(file.name);
	const filePath = path.join(directory, fileName);

	await writeFile(filePath, bytes);

	return { fileName, filePath, sha256 };
}

export async function createDraftBatch(formData: FormData, uploadedByUserId: string, auditContext?: AuditContext) {
	const sourceFile = validateFile(formData.get('sourceFile'), ['.xlsx'], 'de admisiones');
	const estadisticaFile = validateFile(formData.get('estadisticaFile'), ['.pdf'], 'estadistica');
	const manifestFile = validateFile(formData.get('manifestFile'), ['.pdf'], 'manifest');

	const uploadDirectory = path.join(ADMISSION_UPLOAD_ROOT, randomUUID());
	const [source, estadistica, manifest] = await Promise.all([
		writeUploadFile(sourceFile, uploadDirectory),
		writeUploadFile(estadisticaFile, uploadDirectory),
		writeUploadFile(manifestFile, uploadDirectory)
	]);
	const preview = await previewAdmissionFile(source.filePath);

	const [result] = await db.transaction(async (tx) => {
		const [insertResult] = await tx.insert(admissionImportBatches).values({
			uploadedByUserId,
			sourceFileName: source.fileName,
			sourceFilePath: source.filePath,
			sourceFileSha256: source.sha256,
			estadisticaFileName: estadistica.fileName,
			estadisticaFilePath: estadistica.filePath,
			estadisticaFileSha256: estadistica.sha256,
			manifestFileName: manifest.fileName,
			manifestFilePath: manifest.filePath,
			manifestFileSha256: manifest.sha256,
			rowCount: preview.rows.length,
			warningCount: preview.warnings.length,
			errorCount: preview.errors.length
		});

		if (auditContext) {
			await writeAuditLog(tx, auditContext, {
				action: 'admission_import_batch.created',
				entityType: 'admission_import_batch',
				entityId: insertResult.insertId,
				before: null,
				after: {
					id: insertResult.insertId,
					status: 'draft',
					rowCount: preview.rows.length,
					warningCount: preview.warnings.length,
					errorCount: preview.errors.length
				},
				metadata: {
					sourceFileName: source.fileName,
					sourceFileSha256: source.sha256,
					estadisticaFileName: estadistica.fileName,
					estadisticaFileSha256: estadistica.sha256,
					manifestFileName: manifest.fileName,
					manifestFileSha256: manifest.sha256
				}
			});
		}

		return [insertResult];
	});

	const batchId = Number(result.insertId);

	return {
		batchId,
		files: {
			sourceFileName: source.fileName,
			estadisticaFileName: estadistica.fileName,
			manifestFileName: manifest.fileName
		},
		preview
	};
}

export async function previewAdmissionFile(filePath: string): Promise<AdmissionPreview> {
	const buffer = await readFile(filePath);
	const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
	const sheetName = workbook.SheetNames[0];
	if (!sheetName) throw new Error('El archivo de admisiones no tiene hojas.');

	const sheet = workbook.Sheets[sheetName];
	const rawRows = XLSX.utils.sheet_to_json<RawAdmissionRow>(sheet, { defval: '' });
	const headers = Object.keys(rawRows[0] ?? {});
	const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
	if (missingHeaders.length > 0) {
		throw new Error(`Faltan columnas requeridas: ${missingHeaders.join(', ')}.`);
	}

	const catalogs = await loadCatalogs();
	const seenAdmissions = new Set<string>();
	const previewRows = rawRows.map((rawRow, index) =>
		buildPreviewRow(rawRow, index + 2, catalogs, seenAdmissions)
	);
	const warnings = previewRows.flatMap((row) => row.warnings);
	const errors = previewRows.flatMap((row) => row.errors);

	return { rows: previewRows, warnings, errors };
}

async function loadCatalogs(): Promise<ResolvedCatalogs> {
	const [processRows, careerRows, modalityRows, ocreTypeRows] = await Promise.all([
		db.select({ id: proceso_admission.id, code: proceso_admission.code }).from(proceso_admission),
		db.select({ id: careers.id, ofae: careers.ofae, name: careers.todo }).from(careers),
		db.select({ id: mod_admission.id, code: mod_admission.code, name: mod_admission.name }).from(mod_admission),
		db.select({ id: ocre_types.id, code: ocre_types.code, name: ocre_types.name }).from(ocre_types)
	]);

	return {
		processesByCode: new Map(processRows.map((row) => [normalizeCatalogCode(row.code), row])),
		careersByOfae: new Map(careerRows.map((row) => [normalizeCatalogCode(row.ofae), row])),
		modalitiesByCode: new Map(modalityRows.map((row) => [normalizeCatalogCode(row.code), row])),
		ocreTypesByCode: new Map(ocreTypeRows.map((row) => [normalizeCatalogCode(row.code), row]))
	};
}

function addRequiredError(errors: AdmissionPreviewIssue[], row: number, field: string, value: string) {
	if (!value) errors.push({ row, field, message: `${field} es requerido.` });
}

function buildPreviewRow(
	rawRow: RawAdmissionRow,
	rowNumber: number,
	catalogs: ResolvedCatalogs,
	seenAdmissions: Set<string>
): AdmissionPreviewRow {
	const warnings: AdmissionPreviewIssue[] = [];
	const errors: AdmissionPreviewIssue[] = [];
	const numAsignacion = normalizeCatalogCode(rawRow.Num_Asignacion);
	const cedula = cleanUpper(rawRow.Ced_estudiante);
	const apellidosNombres = cleanString(rawRow.Apel_Nom);
	const telefono = emptyDotToNull(rawRow.Telefono);
	const correo = emptyDotToNull(rawRow.Correo_e);
	const opcion = normalizeCatalogCode(rawRow.Opcion);
	const periodoIngreso = cleanUpper(rawRow.Periodo_ingreso);
	const fechaAsignacion = parseDateValue(rawRow.Fecha_asignacion);
	const modaIngreso = normalizeCatalogCode(rawRow.Moda_Ingre);
	const codOcre = normalizeCatalogCode(rawRow.Cod_Ocre);
	const ano = parseInteger(rawRow.Ano);
	const proceso = parseInteger(rawRow.Proceso);

	addRequiredError(errors, rowNumber, 'Num_Asignacion', numAsignacion);
	addRequiredError(errors, rowNumber, 'Ced_estudiante', cedula);
	addRequiredError(errors, rowNumber, 'Apel_Nom', apellidosNombres);
	addRequiredError(errors, rowNumber, 'Periodo_ingreso', periodoIngreso);
	addRequiredError(errors, rowNumber, 'Fecha_asignacion', fechaAsignacion);
	addRequiredError(errors, rowNumber, 'Opcion', opcion);
	addRequiredError(errors, rowNumber, 'Moda_Ingre', modaIngreso);
	addRequiredError(errors, rowNumber, 'Cod_Ocre', codOcre);
	if (ano === null) errors.push({ row: rowNumber, field: 'Ano', message: 'Ano debe ser numerico.' });
	if (proceso === null) errors.push({ row: rowNumber, field: 'Proceso', message: 'Proceso debe ser numerico.' });
	if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaAsignacion)) {
		errors.push({ row: rowNumber, field: 'Fecha_asignacion', message: 'Fecha_asignacion debe ser una fecha valida.' });
	}

	if (cleanString(rawRow.Telefono) === '.') {
		warnings.push({ row: rowNumber, field: 'Telefono', message: 'Telefono contiene solo un punto y se guardara vacio.' });
	}
	if (cleanString(rawRow.Correo_e) === '.') {
		warnings.push({ row: rowNumber, field: 'Correo_e', message: 'Correo_e contiene solo un punto y se guardara vacio.' });
	}

	const process = catalogs.processesByCode.get(numAsignacion) ?? null;
	const career = catalogs.careersByOfae.get(opcion) ?? null;
	const modality = catalogs.modalitiesByCode.get(modaIngreso) ?? null;
	const ocreType = catalogs.ocreTypesByCode.get(codOcre) ?? null;

	if (numAsignacion && !process) errors.push({ row: rowNumber, field: 'Num_Asignacion', message: `No existe el proceso ${numAsignacion}.` });
	if (opcion && !career) errors.push({ row: rowNumber, field: 'Opcion', message: `No existe una carrera con codigo OFAE ${opcion}.` });
	if (modaIngreso && !modality) errors.push({ row: rowNumber, field: 'Moda_Ingre', message: `No existe la modalidad ${modaIngreso}.` });
	if (codOcre && !ocreType) errors.push({ row: rowNumber, field: 'Cod_Ocre', message: `No existe el tipo OCRE ${codOcre}.` });

	const duplicateKey = `${cedula}:${opcion}:${numAsignacion}`;
	if (seenAdmissions.has(duplicateKey)) {
		errors.push({ row: rowNumber, field: 'Ced_estudiante', message: 'Admision duplicada dentro del archivo.' });
	}
	seenAdmissions.add(duplicateKey);

	return {
		row: rowNumber,
		numAsignacion,
		cedula,
		apellidosNombres,
		telefono,
		correo,
		opcion,
		periodoIngreso,
		fechaAsignacion,
		modaIngreso,
		codOcre,
		ano,
		proceso,
		careerName: career?.name ?? null,
		modalityName: modality?.name ?? null,
		ocreName: ocreType?.name ?? null,
		warnings,
		errors
	};
}

export async function saveAdmissionBatch(batchId: number, auditContext?: AuditContext) {
	const [batch] = await db
		.select()
		.from(admissionImportBatches)
		.where(eq(admissionImportBatches.id, batchId))
		.limit(1);

	if (!batch) throw new Error('No existe el lote de admisiones.');
	if (batch.status !== 'draft') throw new Error('Este lote ya fue guardado.');

	const preview = await previewAdmissionFile(batch.sourceFilePath);
	if (preview.errors.length > 0) {
		await db
			.update(admissionImportBatches)
			.set({
				rowCount: preview.rows.length,
				warningCount: preview.warnings.length,
				errorCount: preview.errors.length
			})
			.where(eq(admissionImportBatches.id, batchId));
		throw new Error('No se puede guardar un lote con errores.');
	}

	const catalogs = await loadCatalogs();
	await assertNoExistingAdmissions(preview.rows, catalogs);

	await db.transaction(async (tx) => {
		for (const row of preview.rows) {
			const process = catalogs.processesByCode.get(row.numAsignacion);
			const career = catalogs.careersByOfae.get(row.opcion);
			const modality = catalogs.modalitiesByCode.get(row.modaIngreso);
			const ocreType = catalogs.ocreTypesByCode.get(row.codOcre);

			if (!process || !career || !modality) {
				throw new Error(`La fila ${row.row} no tiene referencias validas.`);
			}

			await tx
				.insert(students)
				.values({
					cedula: row.cedula,
					apellidos_nombres: row.apellidosNombres,
					telefono: row.telefono,
					correo: row.correo
				})
				.onDuplicateKeyUpdate({
					set: {
						apellidos_nombres: row.apellidosNombres,
						telefono: row.telefono,
						correo: row.correo
					}
				});

			const [student] = await tx
				.select({ id: students.id })
				.from(students)
				.where(eq(students.cedula, row.cedula))
				.limit(1);

			if (!student) throw new Error(`No se pudo guardar el estudiante de la fila ${row.row}.`);

			await tx.insert(admissions).values({
				importBatchId: batchId,
				studentId: student.id,
				careerId: career.id,
				procesoId: process.id,
				modalityId: modality.id,
				opcion: row.opcion,
				ocreTypeId: ocreType?.id ?? null,
				periodoIngreso: row.periodoIngreso,
				fechaAsignacion: new Date(`${row.fechaAsignacion}T00:00:00`),
				ano: row.ano ?? 0,
				proceso: row.proceso ?? 0
			});
		}

		await tx
			.update(admissionImportBatches)
			.set({
				status: 'saved',
				rowCount: preview.rows.length,
				warningCount: preview.warnings.length,
				errorCount: 0,
				savedAt: new Date()
			})
			.where(eq(admissionImportBatches.id, batchId));

		if (auditContext) {
			await writeAuditLog(tx, auditContext, {
				action: 'admission_import_batch.saved',
				entityType: 'admission_import_batch',
				entityId: batchId,
				before: {
					status: batch.status,
					rowCount: batch.rowCount,
					warningCount: batch.warningCount,
					errorCount: batch.errorCount,
					savedAt: batch.savedAt
				},
				after: {
					status: 'saved',
					rowCount: preview.rows.length,
					warningCount: preview.warnings.length,
					errorCount: 0
				},
				metadata: { insertedAdmissionCount: preview.rows.length }
			});
		}
	});

	return { saved: true, rowCount: preview.rows.length, warningCount: preview.warnings.length };
}

async function assertNoExistingAdmissions(rows: AdmissionPreviewRow[], catalogs: ResolvedCatalogs) {
	const cedulas = [...new Set(rows.map((row) => row.cedula))];
	if (cedulas.length === 0) return;

	const existingStudents = await db
		.select({ id: students.id, cedula: students.cedula })
		.from(students)
		.where(inArray(students.cedula, cedulas));

	const studentIdByCedula = new Map(existingStudents.map((student) => [student.cedula, student.id]));
	for (const row of rows) {
		const studentId = studentIdByCedula.get(row.cedula);
		const process = catalogs.processesByCode.get(row.numAsignacion);
		const career = catalogs.careersByOfae.get(row.opcion);

		if (!studentId || !process || !career) continue;

		const existing = await db
			.select({ id: admissions.id })
			.from(admissions)
			.where(
				and(
					eq(admissions.studentId, studentId),
					eq(admissions.careerId, career.id),
					eq(admissions.procesoId, process.id)
				)
			)
			.limit(1);

		if (existing.length > 0) {
			throw new Error(`La fila ${row.row} ya existe para estudiante, carrera y proceso.`);
		}
	}
}
