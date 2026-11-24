// Integration tests use ONLY a newly created, localhost-only disposable database.
// Credentials come from DATABASE_URL, but its existing database is never used or changed.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import { createServer } from 'vite';
import * as XLSX from 'xlsx';

const serverUrl = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(serverUrl.hostname))
	throw new Error('Admission integration tests require a localhost MySQL server.');
const database = `digaipe_admission_test_${Date.now()}`;
assert.match(database, /^digaipe_admission_test_\d+$/);
serverUrl.pathname = '/';
const owner = await mysql.createConnection({ uri: serverUrl.toString(), connectTimeout: 5000 });
let vite;
let pool;
let created = false;
const testUser = `adm_test_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
const testPassword = randomUUID();
const uploadedDirectories = new Set();
try {
	const [[version]] = await owner.query('SELECT VERSION() AS version');
	console.log(`Testing migrations and enrollment against MySQL ${version.version}.`);
	await owner.query(
		`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`
	);
	created = true;
	await owner.query(`USE \`${database}\``);
	serverUrl.pathname = `/${database}`;
	process.env.DATABASE_URL = serverUrl.toString();
	const journal = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8'));
	async function migration(entry) {
		const contents = await readFile(`drizzle/${entry.tag}.sql`, 'utf8');
		for (const statement of contents
			.split('--> statement-breakpoint')
			.map((s) => s.trim())
			.filter(Boolean))
			await owner.query(statement);
	}
	for (const entry of journal.entries.filter((e) => e.idx < 7)) await migration(entry);
	// These pre-upgrade rows prove existing IDs and matrícula history survive.
	await owner.query(
		"INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES ('admission-test','PRUEBA','admission-test@example.invalid',1,NOW(),NOW())"
	);
	await owner.query(
		"INSERT INTO careers (id,programa_academico,ofae,facultad,nucleo) VALUES (1,'CARRERA PRUEBA','0001','FACULTAD','T')"
	);
	await owner.query(
		"INSERT INTO admission_modalities (id,codigo_admission,nombre) VALUES (1,'AR','ALTO RENDIMIENTO'),(2,'CV','CONVENIO')"
	);
	await owner.query(
		"INSERT INTO admission_processes (id,num_asignacion,is_enabled) VALUES (1,'PROCESO-PRUEBA',1)"
	);
	await owner.query(
		"INSERT INTO students (id,cedula,apellidos_nombres) VALUES (1,'V000000001','UNO'),(2,'V000000002','DOS'),(3,'V000000003','TRES')"
	);
	await owner.query(
		"INSERT INTO admissions (id,student_id,career_id,proceso_id,modality_id,opcion,periodo_ingreso,fecha_asignacion,ano,proceso) VALUES (1,1,1,1,1,'0001','A2026','2026-01-01',2026,1),(2,2,1,1,1,'0001','A2026','2026-01-01',2026,1),(3,3,1,1,1,'0001','A2026','2026-01-01',2026,1)"
	);
	await owner.query(
		"INSERT INTO admission_processings (id,admission_id,processing_date,generated_by_user_id,status) VALUES (1,1,'2026-01-01','admission-test','matriculado'),(2,2,'2026-01-01','admission-test','pendiente')"
	);
	await migration(journal.entries.find((e) => e.idx === 7));
	// A collision must fail atomically, without adding the key or merging the people.
	await owner.query(
		"INSERT INTO students (id,cedula,apellidos_nombres) VALUES (44,'V-1','LEGADO ALIAS')"
	);
	const identityMigration = journal.entries.find((e) => e.idx === 8);
	await assert.rejects(migration(identityMigration), { code: 'ER_DUP_ENTRY' });
	const [identityColumns] = await owner.query("SHOW COLUMNS FROM students LIKE 'identity_key'");
	assert.equal(identityColumns.length, 0);
	await owner.query('DELETE FROM students WHERE id=44');
	await owner.query(
		"INSERT INTO students (id,cedula,apellidos_nombres) VALUES (44,'V1X34','LEGADO INVALIDO')"
	);
	await assert.rejects(migration(identityMigration));
	await owner.query('DELETE FROM students WHERE id=44');
	await owner.query(
		"INSERT INTO students (id,cedula,apellidos_nombres) VALUES (44,'V-12345678','LEGADO CON FORMATO')"
	);
	for (const entry of journal.entries.filter((e) => e.idx > 7)) await migration(entry);
	const [[formattedLegacy]] = await owner.query(
		'SELECT id,cedula,identity_key FROM students WHERE id=44'
	);
	assert.deepEqual(formattedLegacy, { id: 44, cedula: 'V-12345678', identity_key: 'V012345678' });
	await assert.rejects(
		owner.query(
			"INSERT INTO students (cedula,apellidos_nombres) VALUES ('V 12345678','DUPLICADO')"
		),
		{ code: 'ER_DUP_ENTRY' }
	);
	await assert.rejects(
		owner.query("INSERT INTO students (cedula,apellidos_nombres) VALUES ('V12X34','INVALIDO')")
	);
	await assert.rejects(owner.query("INSERT INTO students (cedula,apellidos_nombres) VALUES ('É1234','INVALIDO')"));
	console.log(
		'PASS: identity migration rejects collisions/invalid legacy rows atomically; preserves IDs and original formatting.'
	);
	const [[legacy]] = await owner.query('SELECT * FROM admission_selections WHERE admission_id=1');
	assert.equal(legacy.student_id, 1);
	assert.equal(legacy.selected_at, null);
	assert.equal(legacy.selected_by_user_id, null);
	console.log('PASS: upgrade preserves existing matrícula and unknown review metadata.');
	await owner.query(
		"INSERT INTO admissions (id,student_id,career_id,proceso_id,modality_id,opcion,periodo_ingreso,fecha_asignacion,ano,proceso) VALUES (4,2,1,1,2,'0001','A2026','2026-01-01',2026,1)"
	);
	await assert.rejects(
		owner.query(
			"INSERT INTO admissions (student_id,career_id,proceso_id,modality_id,opcion,periodo_ingreso,fecha_asignacion,ano,proceso) VALUES (2,1,1,2,'0001','A2026','2026-01-01',2026,1)"
		),
		{ code: 'ER_DUP_ENTRY' }
	);
	await assert.rejects(
		owner.query(
			'INSERT INTO admission_selections (student_id,career_id,proceso_id,admission_id) VALUES (3,1,1,4)'
		),
		{ code: 'ER_NO_REFERENCED_ROW_2' }
	);
	await owner.query(
		"INSERT INTO admission_processings (id,admission_id,processing_date,generated_by_user_id,status) VALUES (4,4,'2026-01-01','admission-test','pendiente')"
	);
	console.log(
		'PASS: distinct modalities accepted; exact duplicates and mismatched selections rejected.'
	);
	const grants = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/grant-db-users.ts'], {
		env: {
			...process.env,
			APP_DB_USER: testUser,
			APP_DB_PASSWORD: testPassword,
			BACKUP_DB_PASSWORD: '',
			READONLY_DB_PASSWORD: ''
		},
		encoding: 'utf8',
		windowsHide: true
	});
	assert.equal(grants.status, 0, grants.stderr || grants.stdout);
	const appUrl = new URL(serverUrl);
	appUrl.username = testUser;
	appUrl.password = testPassword;
	process.env.DATABASE_URL = appUrl.toString();
	const appConnection = await mysql.createConnection(appUrl.toString());
	await assert.rejects(
		appConnection.query('UPDATE audit_chain_state SET last_sequence=last_sequence WHERE id=0'),
		{ code: 'ER_TABLEACCESS_DENIED_ERROR' }
	);
	await appConnection.end();
	console.log(
		'PASS: running application tests with deployment privileges; audit tables remain read-only.'
	);
	vite = await createServer({
		configFile: false,
		// SvelteKit sync/build may rewrite tsconfig while browser tests run. The service
		// loader must retain one module graph/pool rather than hot-reloading test services.
		server: { middlewareMode: true, watch: null },
		resolve: { alias: { $lib: path.resolve('src/lib') } },
		plugins: [
			{
				name: 'admission-test-runtime',
				resolveId(id) {
					if (id === '$env/dynamic/private' || id === '$app/environment') return `\0test:${id}`;
				},
				load(id) {
					if (id === '\0test:$env/dynamic/private') return 'export const env = process.env';
					if (id === '\0test:$app/environment') return 'export const building = false';
				}
			}
		]
	});
	const enrollment = await vite.ssrLoadModule('/src/lib/server/admisiones/enrollment.ts');
	const review = await vite.ssrLoadModule('/src/lib/server/admisiones/review.ts');
	const stats = await vite.ssrLoadModule('/src/lib/server/admisiones/statistics.ts');
	const exporter = await vite.ssrLoadModule('/src/lib/server/admisiones/enrollment-export.ts');
	const importer = await vite.ssrLoadModule('/src/lib/server/admisiones/import.ts');
	const processing = await vite.ssrLoadModule('/src/lib/server/admisiones/processing.ts');
	const planilla = await vite.ssrLoadModule('/src/lib/server/admisiones/planilla.ts');
	const dbModule = await vite.ssrLoadModule('/src/lib/server/db/index.ts');
	pool = dbModule.db.$client;
	const context = {
		actorUserId: 'admission-test',
		actorName: 'PRUEBA',
		actorEmail: 'admission-test@example.invalid',
		correlationId: randomUUID(),
		ipAddress: null,
		userAgent: 'integration-test'
	};
	const decisions = await Promise.allSettled([
		review.reviewAdmissions([2], 'matriculado', '', context),
		review.reviewAdmissions([4], 'matriculado', '', context)
	]);
	assert.equal(decisions.filter((r) => r.status === 'fulfilled').length, 1);
	assert.equal(decisions.filter((r) => r.status === 'rejected').length, 1);
	let report = await enrollment.getEnrollmentReport();
	assert.deepEqual(report.totals, {
		assigned: 3,
		offers: 4,
		matriculado: 2,
		no_matriculado: 0,
		pendiente: 1
	});
	console.log(
		'PASS: simultaneous reviewers produce exactly one winner; unprocessed students included.'
	);
	await owner.query("INSERT INTO ap_active_dates (code_id,active_date) VALUES (1,'2026-01-01')");
	const closed = await enrollment.closeAdmissionProcess(1, 'CIERRE DE PRUEBA', context);
	const snapshot = await enrollment.getClosure(closed.closureId);
	assert.equal(snapshot.report.totals.no_matriculado, 1);
	assert.equal(
		snapshot.report.rows.find((r) => r.studentId === 3).reason,
		'Sin trámite registrado'
	);
	await assert.rejects(review.unlockAdmission(1, 'PRUEBA', context), /cerrado/);
	await assert.rejects(
		owner.query('DELETE FROM admission_process_closures WHERE id=?', [snapshot.id]),
		/inmutables/
	);
	await assert.rejects(
		owner.query("UPDATE admission_process_closures SET reason='ALTERADO' WHERE id=?", [
			snapshot.id
		]),
		/inmutables/
	);
	const csv = exporter.buildEnrollmentCsv(snapshot.report, true);
	assert.match(csv, /No matriculados/);
	assert.match(csv, /Sin trámite registrado/);
	const pdf = await exporter.buildEnrollmentPdf(snapshot.report, true);
	assert.equal(Buffer.from(pdf).subarray(0, 4).toString(), '%PDF');
	console.log(
		'PASS: closure includes never-processed assignments, blocks changes, verifies hash and exports CSV/PDF.'
	);
	await enrollment.reopenAdmissionProcess(1, 'REAPERTURA DE PRUEBA', context);
	await review.unlockAdmission(1, 'CAMBIO DE PRUEBA', context);
	const unchanged = await enrollment.getClosure(closed.closureId);
	assert.equal(unchanged.sha256, snapshot.sha256);
	assert.deepEqual(unchanged.report.totals, snapshot.report.totals);
	const closedAgain = await enrollment.closeAdmissionProcess(1, 'SEGUNDO CIERRE', context);
	assert.equal(closedAgain.version, 2);
	const parsed = stats.parseStatisticsSpec(
		new URL(
			'http://test/?reportMode=matricula&filter_process=PROCESO-PRUEBA&filter_status=no_matriculado'
		)
	);
	assert.deepEqual(parsed.errors, []);
	const filtered = await stats.buildStatisticsReport(parsed.spec);
	assert.equal(filtered.enrollment.totals.no_matriculado, 2);
	assert.equal(filtered.enrollment.totals.matriculado, 0);
	console.log(
		'PASS: reopening preserves prior report; new closure increments version; final-outcome filters include unprocessed rows.'
	);
	await owner.query(
		"INSERT INTO admission_processes (id,num_asignacion,is_enabled) VALUES (2,'UA999/01-01-26',1)"
	);
	await owner.query("INSERT INTO ocre_types (id,code,name) VALUES (1,'ADM','ADMISION')");
	const today = processing.caracasDateKey();
	await owner.query('INSERT INTO ap_active_dates (code_id,active_date) VALUES (2,?)', [today]);
	const raw = {
		Num_Asignacion: 'UA999/01-01-26',
		Ced_estudiante: 'V000000010',
		Apel_Nom: 'IMPORTACION PRUEBA',
		Periodo_ingreso: 'A2026',
		Fecha_asignacion: '01/01/2026',
		Opcion: '0001',
		Moda_Ingre: 'AR',
		Cod_Ocre: 'ADM',
		Ano: 2026,
		Proceso: 1
	};
	const spreadsheet = (rows) => {
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Admisiones');
		return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
	};
	async function draft(rows) {
		const form = new FormData();
		form.set('sourceFile', new File([spreadsheet(rows)], 'admisiones.xlsx'));
		form.set('estadisticaFile', new File(['%PDF-1.4\n'], 'estadistica.pdf'));
		form.set('manifestFile', new File(['%PDF-1.4\n'], 'manifiesto.pdf'));
		const result = await importer.createDraftBatch(form, 'admission-test', context);
		const [[batch]] = await owner.query(
			'SELECT source_file_path FROM admission_import_batches WHERE id=?',
			[result.batchId]
		);
		uploadedDirectories.add(path.dirname(batch.source_file_path));
		return result;
	}
	const batch = await draft([raw, { ...raw, Moda_Ingre: 'CV' }]);
	assert.equal(batch.preview.errors.length, 0);
	assert.ok(batch.preview.warnings.some((w) => w.message.includes('varias modalidades')));
	const saved = await importer.saveAdmissionBatch(batch.batchId, context);
	assert.equal(saved.insertedCount, 2);
	const changedProfile = await draft([
		{
			...raw,
			Ced_estudiante: 'V-000000010',
			Moda_Ingre: 'AR',
			Apel_Nom: 'OTRO NOMBRE',
			Telefono: '000000',
			Correo_e: 'otra@example.invalid'
		}
	]);
	assert.equal(changedProfile.preview.rows[0].existingAdmissionId !== null, true);
	assert.ok(changedProfile.preview.warnings.some((w) => w.message.includes('datos personales')));
	await importer.saveAdmissionBatch(changedProfile.batchId, context);
	const [[preserved]] = await owner.query(
		"SELECT apellidos_nombres,telefono,correo FROM students WHERE identity_key='V000000010'"
	);
	assert.deepEqual(preserved, {
		apellidos_nombres: 'IMPORTACION PRUEBA',
		telefono: null,
		correo: null
	});
	await owner.query(
		"INSERT INTO admission_modalities (id,codigo_admission,nombre) VALUES (3,'EX','EXTRA DE PRUEBA')"
	);
	const extraModality = await draft([
		{
			...raw,
			Ced_estudiante: 'v 000000010',
			Moda_Ingre: 'EX',
			Apel_Nom: 'NOMBRE QUE NO DEBE GUARDARSE',
			Telefono: '00000',
			Correo_e: 'cambio@example.invalid'
		}
	]);
	assert.ok(extraModality.preview.warnings.some((w) => w.message.includes('datos personales')));
	assert.equal(
		(await importer.saveAdmissionBatch(extraModality.batchId, context)).insertedCount,
		1
	);
	const [[stillPreserved]] = await owner.query(
		"SELECT apellidos_nombres,telefono,correo FROM students WHERE identity_key='V000000010'"
	);
	assert.deepEqual(stillPreserved, preserved);
	const firstRowWins = await draft([
		{ ...raw, Ced_estudiante: 'V000000011', Apel_Nom: 'PERFIL ORIGINAL' },
		{ ...raw, Ced_estudiante: 'V-000000011', Moda_Ingre: 'CV', Apel_Nom: 'PERFIL DIFERENTE' }
	]);
	assert.ok(firstRowWins.preview.warnings.some((w) => w.message.includes('datos personales')));
	await importer.saveAdmissionBatch(firstRowWins.batchId, context);
	const [[inFileProfile]] = await owner.query(
		"SELECT apellidos_nombres FROM students WHERE identity_key='V000000011'"
	);
	assert.equal(inFileProfile.apellidos_nombres, 'PERFIL ORIGINAL');
	const legacyVariant = await importer.previewAdmissionFile(
		spreadsheet([{ ...raw, Ced_estudiante: 'v 12345678' }])
	);
	assert.equal(legacyVariant.rows[0].cedula, 'V012345678');
	const legacyDraft = await draft([{ ...raw, Ced_estudiante: 'V 12345678', Apel_Nom: 'NOMBRE IGNORADO' }]);
	await importer.saveAdmissionBatch(legacyDraft.batchId, context);
	const [[sameLegacy]] = await owner.query('SELECT id,cedula,apellidos_nombres FROM students WHERE id=44');
	assert.deepEqual(sameLegacy, { id: 44, cedula: 'V-12345678', apellidos_nombres: 'LEGADO CON FORMATO' });
	const legacySearch = await planilla.searchActiveAdmissionsForPlanilla('V-12.345.678', today);
	assert.equal(legacySearch.length, 1); assert.equal(legacySearch[0].cedula, 'V-12345678');
	const legacySpec = stats.parseStatisticsSpec(new URL('http://test/?reportMode=matricula&filter_process=UA999%2F01-01-26&search=V%2012345678')).spec;
	assert.equal((await stats.buildStatisticsReport(legacySpec)).enrollment.rows[0].studentId, 44);
	const invalidIdentity = await importer.previewAdmissionFile(
		spreadsheet([{ ...raw, Ced_estudiante: 'V12X34' }])
	);
	assert.ok(invalidIdentity.errors.some((e) => e.message.includes('Cédula inválida')));
	const again = await draft([raw, { ...raw, Moda_Ingre: 'CV' }]);
	const skipped = await importer.saveAdmissionBatch(again.batchId, context);
	assert.equal(skipped.insertedCount, 0);
	assert.equal(skipped.skippedCount, 2);
	const conflicting = await importer.previewAdmissionFile(
		spreadsheet([{ ...raw, Periodo_ingreso: 'B2026' }])
	);
	assert.ok(conflicting.errors.some((e) => e.message.includes('datos distintos')));
	const repeated = await importer.previewAdmissionFile(spreadsheet([raw, raw]));
	assert.ok(repeated.errors.some((e) => e.message.includes('duplicada')));
	const [imported] = await owner.query(
		"SELECT a.id FROM admissions a JOIN students s ON s.id=a.student_id WHERE a.proceso_id=2 AND s.identity_key='V000000010' ORDER BY a.id"
	);
	const forms = await Promise.all(
		imported.map((r) => planilla.getActiveAdmissionForPlanilla(r.id, today))
	);
	const planillaFields = forms.map(planilla.buildLegacyPlanillaFields);
	assert.equal(planillaFields[0].planilla, planillaFields[1].planilla);
	assert.notEqual(planillaFields[0].admissionReference, planillaFields[1].admissionReference);
	const pending = await processing.ensureAdmissionProcessing(
		imported[0].id,
		'admission-test',
		today,
		context
	);
	await review.reviewAdmissions([pending.processing.id], 'matriculado', '', context);
	await assert.rejects(
		processing.ensureAdmissionProcessing(imported[1].id, 'admission-test', today, context),
		/otra modalidad seleccionada/
	);
	console.log(
		'PASS: upload preview/save/reimport/conflict detection and unprinted-alternative exclusion.'
	);
	// A review racing closure must either finish before the snapshot, or be rejected.
	await owner.query(
		"INSERT INTO admission_processes (id,num_asignacion,is_enabled) VALUES (3,'CIERRE-CONCURRENTE',1)"
	);
	await owner.query("INSERT INTO ap_active_dates (code_id,active_date) VALUES (3,'2026-01-01')");
	const [raceAdmission] = await owner.query(
		"INSERT INTO admissions (student_id,career_id,proceso_id,modality_id,opcion,periodo_ingreso,fecha_asignacion,ano,proceso) VALUES (3,1,3,1,'0001','A2026','2026-01-01',2026,1)"
	);
	const [raceProcessing] = await owner.query(
		"INSERT INTO admission_processings (admission_id,processing_date,generated_by_user_id,status) VALUES (?,'2026-01-01','admission-test','pendiente')",
		[raceAdmission.insertId]
	);
	const race = await Promise.allSettled([
		enrollment.closeAdmissionProcess(3, 'CIERRE CONCURRENTE', context),
		review.reviewAdmissions([raceProcessing.insertId], 'matriculado', '', context)
	]);
	assert.equal(race[0].status, 'fulfilled');
	const raceClosure = await enrollment.getClosure(race[0].value.closureId);
	assert.equal(raceClosure.report.totals.matriculado, race[1].status === 'fulfilled' ? 1 : 0);
	console.log('PASS: concurrent closure and review produce a coherent official report.');
	// Reproduce the reported 122 offers / 111 assignments using entirely fictitious people.
	await owner.query(
		"INSERT INTO admission_processes (id,num_asignacion,is_enabled) VALUES (4,'CONCILIACION-111',1)"
	);
	const identities = Array.from({ length: 111 }, (_, i) => [
		`V${String(60000001 + i).padStart(9, '0')}`,
		`ESTUDIANTE FICTICIO ${i + 1}`
	]);
	await owner.query('INSERT INTO students (cedula,apellidos_nombres) VALUES ?', [identities]);
	const [cohortStudents] = await owner.query(
		"SELECT id FROM students WHERE cedula LIKE 'V060000%' ORDER BY id"
	);
	assert.equal(cohortStudents.length, 111);
	const cohortOffers = cohortStudents.map((student) => [
		student.id,
		1,
		4,
		1,
		'0001',
		'A2026',
		'2026-01-01',
		2026,
		1
	]);
	cohortOffers.push(
		...cohortStudents
			.slice(0, 11)
			.map((student) => [student.id, 1, 4, 2, '0001', 'A2026', '2026-01-01', 2026, 1])
	);
	await owner.query(
		'INSERT INTO admissions (student_id,career_id,proceso_id,modality_id,opcion,periodo_ingreso,fecha_asignacion,ano,proceso) VALUES ?',
		[cohortOffers]
	);
	const [cohortPrimary] = await owner.query(
		'SELECT id FROM admissions WHERE proceso_id=4 AND modality_id=1 ORDER BY id'
	);
	const cohortProcessingIds = [];
	for (const admission of cohortPrimary.slice(0, 4)) {
		const [insert] = await owner.query(
			"INSERT INTO admission_processings (admission_id,processing_date,generated_by_user_id,status) VALUES (?,'2026-01-02','admission-test','pendiente')",
			[admission.id]
		);
		cohortProcessingIds.push(insert.insertId);
	}
	await review.reviewAdmissions(cohortProcessingIds.slice(0, 2), 'matriculado', '', context);
	await review.reviewAdmissions(
		[cohortProcessingIds[3]],
		'devuelto',
		'DOCUMENTOS DE PRUEBA',
		context
	);
	const reconciliationSpec = stats.parseStatisticsSpec(
		new URL(
			'http://test/?reportMode=reconciliacion&dateBasis=asignacion&dateFrom=2026-01-01&dateTo=2026-12-31&filter_process=CONCILIACION-111&matrixDimension=modalidad'
		)
	).spec;
	const reconciliation = (await stats.buildStatisticsReport(reconciliationSpec)).reconciliation;
	assert.equal(reconciliation.asignados, 111);
	assert.equal(reconciliation.ofertas, 122);
	assert.equal(reconciliation.noProcesados, 107);
	assert.equal(reconciliation.procesados, 4);
	assert.equal(reconciliation.byStatus.matriculado, 2);
	assert.equal(reconciliation.rates.matriculadosSobreAsignados, 2 / 111);
	assert.equal(reconciliation.rates.noPresentacion, 107 / 111);
	assert.equal(reconciliation.matrix.totals.total, 111);
	const modalityFiltered = (
		await stats.buildStatisticsReport({
			...reconciliationSpec,
			filters: { ...reconciliationSpec.filters, modality: ['CV'] }
		})
	).reconciliation;
	assert.equal(modalityFiltered.asignados, 9);
	assert.equal(modalityFiltered.noProcesados, 7);
	console.log(
		'PASS: Conciliación reports 111 assignments / 122 offers, 107 no-processed, and correct rates, including modality filters.'
	);
	const verify = spawnSync(
		process.execPath,
		['--import', 'tsx', 'scripts/audit-ledger.ts', 'verify'],
		{
			env: { ...process.env, DATABASE_URL: serverUrl.toString() },
			encoding: 'utf8',
			windowsHide: true
		}
	);
	assert.equal(verify.status, 0, verify.stderr || verify.stdout);
	console.log('PASS: audit chain and trigger definitions verify after the complete workflow.');
	if (process.argv.includes('--browser')) {
		const { testAdmissionsBrowser } = await import('./lib/admissions-browser.mjs');
		await testAdmissionsBrowser(owner, appUrl.toString(), closed.closureId);
	}
	// Fresh-install path, independent of the upgrade fixture.
	await pool.end();
	pool = null;
	const fresh = `${database}_fresh`;
	await owner.query(
		`CREATE DATABASE \`${fresh}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`
	);
	try {
		await owner.query(`USE \`${fresh}\``);
		for (const entry of journal.entries) await migration(entry);
		console.log('PASS: complete migration history applies to an empty database.');
	} finally {
		await owner.query(`DROP DATABASE \`${fresh}\``);
	}
} finally {
	if (pool) await pool.end();
	if (vite) await vite.close();
	if (created) {
		await owner.query(`USE \`${database}\``);
		const [batches] = await owner
			.query('SELECT source_file_path FROM admission_import_batches')
			.catch(() => [[]]);
		for (const batch of batches) uploadedDirectories.add(path.dirname(batch.source_file_path));
		await owner.query(`DROP DATABASE \`${database}\``);
	}
	await owner.query('DROP USER IF EXISTS ?@?', [testUser, '%']);
	const uploadRoot = path.resolve('var/uploads/admisiones');
	for (const directory of uploadedDirectories) {
		const relative = path.relative(uploadRoot, path.resolve(directory));
		assert.ok(
			relative && !relative.startsWith('..') && !path.isAbsolute(relative),
			'Refusing to remove a path outside test upload directories'
		);
		await rm(directory, { recursive: true, force: true });
	}
	await owner.end();
}
