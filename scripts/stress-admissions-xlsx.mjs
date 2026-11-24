// Stress test for alternative modalities using the real UA136-26 Nutrición spreadsheet.
// Runs ONLY against a new localhost disposable database (digaipe_admission_test_*), which it
// drops at the end. Never prints student names/cédulas: rows are referred to by sheet row number
// and admission id.
//   node scripts/stress-admissions-xlsx.mjs [path/to/file.xlsx]
import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import { createServer } from 'vite';
import * as XLSX from 'xlsx';

const XLSX_PATH = process.argv[2] ?? 'UA136-26 Lista de Admitidos Nutricion U2026.xlsx';
const results = [];
async function check(name, fn) {
	try {
		await fn();
		results.push({ name, ok: true });
		console.log(`PASS  ${name}`);
	} catch (error) {
		results.push({ name, ok: false, error });
		console.log(`FAIL  ${name}\n      ${String(error?.message ?? error).split('\n').slice(0, 6).join('\n      ')}`);
	}
}

const serverUrl = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(serverUrl.hostname))
	throw new Error('Requires a localhost MySQL server.');
const database = `digaipe_admission_test_${Date.now()}`;
assert.match(database, /^digaipe_admission_test_\d+$/);
serverUrl.pathname = '/';
const owner = await mysql.createConnection({ uri: serverUrl.toString(), connectTimeout: 5000 });
let vite, pool, created = false;
const testUser = `adm_test_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
const testPassword = randomUUID();
const uploadedDirectories = new Set();
console.log(`Process TZ: ${process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone}`);

try {
	await owner.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
	created = true;
	await owner.query(`USE \`${database}\``);
	serverUrl.pathname = `/${database}`;
	const ownerDbUrl = serverUrl.toString();
	const journal = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8'));
	for (const entry of journal.entries) {
		const contents = await readFile(`drizzle/${entry.tag}.sql`, 'utf8');
		for (const s of contents.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean))
			await owner.query(s);
	}
	for (const loader of ['scripts/load_careers.ts', 'scripts/load_admission_mod.ts', 'scripts/load_ocre_types.ts']) {
		const r = spawnSync(process.execPath, ['--import', 'tsx', loader], {
			env: { ...process.env, DATABASE_URL: ownerDbUrl }, encoding: 'utf8', windowsHide: true
		});
		assert.equal(r.status, 0, `${loader}: ${r.stderr || r.stdout}`);
	}
	for (const [id, name] of [['stress-a', 'REVISOR A'], ['stress-b', 'REVISOR B']])
		await owner.query('INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,NOW(),NOW())',
			[id, name, `${id}@example.invalid`]);
	const grants = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/grant-db-users.ts'], {
		env: { ...process.env, DATABASE_URL: ownerDbUrl, APP_DB_USER: testUser, APP_DB_PASSWORD: testPassword,
			BACKUP_DB_PASSWORD: '', READONLY_DB_PASSWORD: '' }, encoding: 'utf8', windowsHide: true
	});
	assert.equal(grants.status, 0, grants.stderr || grants.stdout);
	const appUrl = new URL(serverUrl);
	appUrl.username = testUser;
	appUrl.password = testPassword;
	process.env.DATABASE_URL = appUrl.toString();

	vite = await createServer({
		configFile: false,
		server: { middlewareMode: true, watch: null },
		resolve: { alias: { $lib: path.resolve('src/lib') } },
		plugins: [{
			name: 'stress-runtime',
			resolveId(id) { if (id === '$env/dynamic/private' || id === '$app/environment') return `\0test:${id}`; },
			load(id) {
				if (id === '\0test:$env/dynamic/private') return 'export const env = process.env';
				if (id === '\0test:$app/environment') return 'export const building = false';
			}
		}]
	});
	const load = (p) => vite.ssrLoadModule(p);
	const enrollment = await load('/src/lib/server/admisiones/enrollment.ts');
	const review = await load('/src/lib/server/admisiones/review.ts');
	const stats = await load('/src/lib/server/admisiones/statistics.ts');
	const exporter = await load('/src/lib/server/admisiones/enrollment-export.ts');
	const importer = await load('/src/lib/server/admisiones/import.ts');
	const processing = await load('/src/lib/server/admisiones/processing.ts');
	const planilla = await load('/src/lib/server/admisiones/planilla.ts');
	const schema = await load('/src/lib/server/db/schema.ts');
	const orm = await load('drizzle-orm');
	const dbModule = await load('/src/lib/server/db/index.ts');
	const db = dbModule.db;
	pool = db.$client;
	const ctx = (actor = 'stress-a') => ({ actorUserId: actor, actorName: actor, actorEmail: `${actor}@example.invalid`,
		correlationId: randomUUID(), ipAddress: null, userAgent: 'stress-test' });

	const today = processing.caracasDateKey();
	const yesterday = processing.caracasDateKey(new Date(Date.now() - 86400000));
	const PROC = 'UA136/26-11-09';
	const [p1] = await owner.query('INSERT INTO admission_processes (num_asignacion,is_enabled) VALUES (?,1)', [PROC]);
	const procId = p1.insertId;
	await owner.query('INSERT INTO ap_active_dates (code_id,active_date) VALUES (?,?)', [procId, today]);

	// ---------- Real file ----------
	const realBytes = await readFile(XLSX_PATH);
	const wb = XLSX.read(realBytes, { type: 'buffer', cellDates: true });
	const realRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
	const groupsInFile = new Map();
	realRows.forEach((r, i) => {
		const k = `${String(r.Ced_estudiante).trim().toUpperCase()}|${r.Opcion}|${r.Num_Asignacion}`;
		groupsInFile.set(k, [...(groupsInFile.get(k) ?? []), { sheetRow: i + 2, raw: r }]);
	});
	const multi = [...groupsInFile.values()].filter((g) => g.length > 1);
	console.log(`File: ${realRows.length} rows, ${groupsInFile.size} assignments, ${multi.length} with alternatives (sheet rows ${multi.map((g) => g.map((x) => x.sheetRow).join('+')).join(', ')})`);

	const sheet = (rows) => {
		const w = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(w, XLSX.utils.json_to_sheet(rows), 'Admision');
		return XLSX.write(w, { type: 'buffer', bookType: 'xlsx' });
	};
	async function draft(bytes, actor = 'stress-a') {
		const form = new FormData();
		form.set('sourceFile', new File([bytes], 'admisiones.xlsx'));
		form.set('estadisticaFile', new File(['%PDF-1.4\n'], 'estadistica.pdf'));
		form.set('manifestFile', new File(['%PDF-1.4\n'], 'manifiesto.pdf'));
		const result = await importer.createDraftBatch(form, actor, ctx(actor));
		const [[b]] = await owner.query('SELECT source_file_path FROM admission_import_batches WHERE id=?', [result.batchId]);
		uploadedDirectories.add(path.dirname(b.source_file_path));
		return result;
	}
	const q = async (sql, args = []) => (await owner.query(sql, args))[0];
	const admissionOf = async (cedula, modality, proc = procId) => (await q(
		`SELECT a.id FROM admissions a JOIN students s ON s.id=a.student_id JOIN admission_modalities m ON m.id=a.modality_id
		 WHERE s.cedula=? AND m.codigo_admission=? AND a.proceso_id=?`, [cedula, modality, proc]))[0]?.id;
	const processingOf = async (admissionId) => (await q('SELECT id,status FROM admission_processings WHERE admission_id=?', [admissionId]))[0];
	const print = (admissionId) => processing.ensureAdmissionProcessing(admissionId, 'stress-a', today, ctx());
	const report = (codes = [PROC]) => enrollment.getEnrollmentReport(db, codes);

	let firstDraft;
	await check('real file: preview has 0 errors and warns exactly the alternative rows', async () => {
		firstDraft = await draft(realBytes);
		const p = firstDraft.preview;
		assert.equal(p.errors.length, 0, JSON.stringify(p.errors.slice(0, 5)));
		const warned = p.rows.filter((r) => r.warnings.some((w) => w.message.includes('varias modalidades'))).map((r) => r.row).sort((a, b) => a - b);
		assert.deepEqual(warned, multi.flatMap((g) => g.map((x) => x.sheetRow)).sort((a, b) => a - b));
	});
	await check('real file: save inserts every row, one student per cédula', async () => {
		const s = await importer.saveAdmissionBatch(firstDraft.batchId, ctx());
		assert.equal(s.insertedCount, realRows.length);
		assert.equal((await q('SELECT COUNT(*) n FROM students'))[0].n, groupsInFile.size);
		assert.equal((await q('SELECT COUNT(*) n FROM admissions'))[0].n, realRows.length);
	});
	await check('real file: saving the same draft twice is rejected', async () => {
		await assert.rejects(importer.saveAdmissionBatch(firstDraft.batchId, ctx()), /ya fue guardado/);
	});
	await check('real file: re-upload skips all rows, inserts none', async () => {
		const d = await draft(realBytes);
		assert.equal(d.preview.errors.length, 0, JSON.stringify(d.preview.errors.slice(0, 3)));
		const s = await importer.saveAdmissionBatch(d.batchId, ctx());
		assert.equal(s.insertedCount, 0);
		assert.equal(s.skippedCount, realRows.length);
	});
	await check('live report: all assignments pending, offers counted once each', async () => {
		const r = await report();
		assert.deepEqual(r.totals, { assigned: groupsInFile.size, offers: realRows.length, matriculado: 0, no_matriculado: 0, pendiente: groupsInFile.size });
		const alt = r.rows.filter((x) => x.offerIds.length > 1);
		assert.equal(alt.length, multi.length);
	});

	const [gX, gY] = multi; // X = AR+PS, Y = CV+PS in the real file
	const cedX = String(gX[0].raw.Ced_estudiante).trim().toUpperCase();
	const cedY = String(gY[0].raw.Ced_estudiante).trim().toUpperCase();
	const [modX1, modX2] = gX.map((x) => String(x.raw.Moda_Ingre).trim().toUpperCase());
	const [modY1, modY2] = gY.map((x) => String(x.raw.Moda_Ingre).trim().toUpperCase());
	const aX1 = await admissionOf(cedX, modX1), aX2 = await admissionOf(cedX, modX2);
	const aY1 = await admissionOf(cedY, modY1), aY2 = await admissionOf(cedY, modY2);
	console.log(`Student X: admissions ${aX1}(${modX1}) ${aX2}(${modX2}); student Y: ${aY1}(${modY1}) ${aY2}(${modY2})`);

	await check('planilla search lists both alternatives with alternativeCount=2', async () => {
		const rows = await planilla.searchActiveAdmissionsForPlanilla(cedX, today);
		assert.deepEqual(rows.map((r) => r.id).sort(), [aX1, aX2].sort());
		assert.ok(rows.every((r) => Number(r.alternativeCount) === 2), JSON.stringify(rows.map((r) => r.alternativeCount)));
	});

	let pX1, pX2;
	await check('both alternatives can print a planilla while nothing is selected', async () => {
		pX1 = (await print(aX1)).processing.id;
		pX2 = (await print(aX2)).processing.id;
		const again = await print(aX1);
		assert.equal(again.created, false);
	});
	await check('legacy planilla number stays unchanged; admission references distinguish modalities', async () => {
		const a = await planilla.getActiveAdmissionForPlanilla(aX1, today);
		const b = await planilla.getActiveAdmissionForPlanilla(aX2, today);
		const fa = planilla.buildLegacyPlanillaFields(a), fb = planilla.buildLegacyPlanillaFields(b);
		assert.equal(fa.planilla, fb.planilla, 'the office keeps the legacy planilla number');
		assert.notEqual(fa.admissionReference, fb.admissionReference, 'admission references must distinguish modalities');
	});
	await check('one review batch with both alternatives as matriculado is rejected atomically', async () => {
		await assert.rejects(review.reviewAdmissions([pX1, pX2], 'matriculado', '', ctx()), /solo una modalidad/);
		assert.equal((await processingOf(aX1)).status, 'pendiente');
		assert.equal((await processingOf(aX2)).status, 'pendiente');
		assert.equal((await q('SELECT COUNT(*) n FROM admission_selections'))[0].n, 0);
	});
	await check('duplicate processing ids in one batch are handled', async () => {
		// The route de-duplicates; call the service directly with a duplicate to see what happens.
		await assert.rejects(review.reviewAdmissions([pX2, pX2], 'matriculado', '', ctx()));
		assert.equal((await processingOf(aX2)).status, 'pendiente');
	});
	await check('matricular X2 → X1 becomes No matriculado (otra modalidad)', async () => {
		await review.reviewAdmissions([pX2], 'matriculado', '', ctx());
		const r = await report();
		const row = r.rows.find((x) => x.offerIds.includes(aX1));
		assert.equal(row.outcome, 'matriculado');
		assert.equal(row.admissionId, aX2);
		assert.equal(r.totals.matriculado, 1);
		assert.equal(r.totals.assigned, groupsInFile.size);
	});
	await check('after selection: X1 cannot be matriculado, devuelto, or unlocked', async () => {
		await assert.rejects(review.reviewAdmissions([pX1], 'matriculado', '', ctx()), /Ya existe una matrícula/);
		await assert.rejects(review.reviewAdmissions([pX1], 'devuelto', 'X', ctx()), /Ya existe una matrícula/);
		await assert.rejects(review.unlockAdmission(pX1, 'X', ctx()), /pendiente|Desbloquee/);
	});
	await check('after selection: X1 hidden from planilla search and detail, printing blocked', async () => {
		const rows = await planilla.searchActiveAdmissionsForPlanilla(cedX, today);
		assert.deepEqual(rows.map((r) => r.id), [aX2]);
		assert.equal(await planilla.getActiveAdmissionForPlanilla(aX1, today), null);
		await assert.rejects(print(aX1), /otra modalidad/);
	});
	await check('a mixed batch (other student + discarded alternative) fails without partial writes', async () => {
		const other = (await q('SELECT a.id FROM admissions a WHERE a.id NOT IN (?,?,?,?) ORDER BY a.id LIMIT 1', [aX1, aX2, aY1, aY2]))[0].id;
		const pOther = (await print(other)).processing.id;
		await assert.rejects(review.reviewAdmissions([pOther, pX1], 'matriculado', '', ctx()));
		assert.equal((await processingOf(other)).status, 'pendiente');
		await review.reviewAdmissions([pOther], 'devuelto', 'FALTA PARTIDA', ctx());
	});
	await check('swap modality: unlock X2 (cancel) then matricular X1', async () => {
		await review.unlockAdmission(pX2, 'MODALIDAD EQUIVOCADA', ctx());
		assert.equal((await q('SELECT COUNT(*) n FROM admission_selections'))[0].n, 0);
		await review.reviewAdmissions([pX1], 'matriculado', '', ctx('stress-b'));
		const [sel] = await q('SELECT admission_id, selected_by_user_id FROM admission_selections');
		assert.equal(sel.admission_id, aX1);
		assert.equal(sel.selected_by_user_id, 'stress-b');
		const r = await report();
		assert.equal(r.rows.find((x) => x.offerIds.includes(aX1)).admissionId, aX1);
	});
	await check('Y: only Y1 printed; matricular Y1 blocks printing Y2 that never had a planilla', async () => {
		const pY1 = (await print(aY1)).processing.id;
		await review.reviewAdmissions([pY1], 'matriculado', '', ctx());
		await assert.rejects(print(aY2), /otra modalidad/);
		assert.equal(await processingOf(aY2), undefined);
	});
	await check('devuelto → matriculado same day is allowed; sibling then blocked', async () => {
		// third group created from the file's single-modality students: give one student an extra modality via upload
		const base = realRows.find((r) => ![cedX, cedY].includes(String(r.Ced_estudiante).trim().toUpperCase()) && r.Moda_Ingre !== 'AR');
		const d = await draft(sheet([{ ...base, Moda_Ingre: 'AR', Cod_Via_Ingreoso: 'AR' }]));
		assert.equal(d.preview.errors.length, 0, JSON.stringify(d.preview.errors));
		assert.ok(d.preview.warnings.some((w) => w.message.includes('Ya existe otra modalidad')), JSON.stringify(d.preview.warnings));
		assert.equal((await importer.saveAdmissionBatch(d.batchId, ctx())).insertedCount, 1);
		const ced = String(base.Ced_estudiante).trim().toUpperCase();
		const a1 = await admissionOf(ced, String(base.Moda_Ingre).trim()), a2 = await admissionOf(ced, 'AR');
		const pa1 = (await print(a1)).processing.id, pa2 = (await print(a2)).processing.id;
		await review.reviewAdmissions([pa1, pa2], 'devuelto', 'DOCUMENTOS INCOMPLETOS', ctx());
		await review.reviewAdmissions([pa2], 'matriculado', '', ctx());
		await assert.rejects(review.reviewAdmissions([pa1], 'matriculado', '', ctx()), /Ya existe una matrícula/);
		const r = await report();
		const row = r.rows.find((x) => x.offerIds.includes(a1));
		assert.equal(row.outcome, 'matriculado');
		assert.equal(row.offerIds.length, 2);
	});

	// ---------- Upload edge cases ----------
	const pick = (i) => realRows[i];
	await check('upload: new 3rd modality for already-matriculated X is accepted with the "ya existe una matrícula" warning', async () => {
		const d = await draft(sheet([{ ...gX[0].raw, Moda_Ingre: 'OPS', Cod_Via_Ingreoso: 'OPSU' }]));
		assert.equal(d.preview.errors.length, 0);
		assert.ok(d.preview.warnings.some((w) => w.message.includes('Ya existe una matrícula')));
		assert.equal((await importer.saveAdmissionBatch(d.batchId, ctx())).insertedCount, 1);
		const r = await report();
		const row = r.rows.find((x) => x.offerIds.includes(aX1));
		assert.equal(row.offerIds.length, 3);
		assert.equal(row.outcome, 'matriculado');
		await assert.rejects(print(await admissionOf(cedX, 'OPS')), /otra modalidad/);
	});
	await check('upload: an existing admission with different data blocks the whole batch (nothing inserted)', async () => {
		const before = (await q('SELECT COUNT(*) n FROM admissions'))[0].n;
		const fresh = { ...pick(5), Ced_estudiante: 'V099000001', Apel_Nom: 'NUEVO FICTICIO' };
		const changed = { ...pick(6), Periodo_ingreso: 'A2027' };
		const d = await draft(sheet([fresh, changed]));
		assert.ok(d.preview.errors.some((e) => e.message.includes('datos distintos')));
		await assert.rejects(importer.saveAdmissionBatch(d.batchId, ctx()), /errores/);
		assert.equal((await q('SELECT COUNT(*) n FROM admissions'))[0].n, before);
		assert.equal((await q("SELECT COUNT(*) n FROM students WHERE cedula='V099000001'"))[0].n, 0);
	});
	await check('upload: other field changes on an existing admission (fecha, ano, proceso, Cod_Ocre) are each detected', async () => {
		for (const patch of [{ Fecha_asignacion: '10-11-2026' }, { Ano: 2027 }, { Proceso: 1 }, { Cod_Ocre: 'DIFMAT' }]) {
			const p = await importer.previewAdmissionFile(sheet([{ ...pick(7), ...patch }]));
			assert.ok(p.errors.some((e) => e.message.includes('datos distintos')), `${JSON.stringify(patch)} not detected`);
		}
	});
	await check('upload: same row twice in file (same modality) is an error', async () => {
		const p = await importer.previewAdmissionFile(sheet([pick(8), pick(8)]));
		assert.ok(p.errors.some((e) => e.message.includes('duplicada')));
	});
	await check('upload: modality code with spaces/lowercase/leading dot is treated as the same modality', async () => {
		const p = await importer.previewAdmissionFile(sheet([{ ...pick(9), Moda_Ingre: ` .${String(pick(9).Moda_Ingre).toLowerCase()} ` }]));
		assert.equal(p.errors.length, 0, JSON.stringify(p.errors));
		assert.notEqual(p.rows[0].existingAdmissionId, null);
	});
	await check('upload: in-file duplicate hidden by modality normalization (PS vs " ps") is an error', async () => {
		const p = await importer.previewAdmissionFile(sheet([{ ...pick(10), Ced_estudiante: 'V099000002' }, { ...pick(10), Ced_estudiante: 'V099000002', Moda_Ingre: ` ${String(pick(10).Moda_Ingre).toLowerCase()}` }]));
		assert.ok(p.errors.some((e) => e.message.includes('duplicada')), JSON.stringify(p.errors));
	});
	await check('upload: cédula formatting variant (lowercase / inner space / dash) maps to the same student', async () => {
		const ced = String(pick(12).Ced_estudiante).trim().toUpperCase();
		const variants = [ced.toLowerCase(), ced.replace(/^([A-Z])/, '$1 '), ced.replace(/^([A-Z])/, '$1-')];
		const bad = [];
		for (const v of variants) {
			const p = await importer.previewAdmissionFile(sheet([{ ...pick(12), Ced_estudiante: v }]));
			if (p.rows[0].existingAdmissionId === null) bad.push(JSON.stringify(v.replace(/\d/g, '9')));
		}
		assert.deepEqual(bad, [], `treated as a NEW student: ${bad.join(', ')}`);
	});
	await check('upload: unknown modality is an error and does not produce the alternatives warning by itself', async () => {
		const p = await importer.previewAdmissionFile(sheet([{ ...pick(13), Moda_Ingre: 'ZZZ' }]));
		assert.ok(p.errors.some((e) => e.message.includes('No existe la modalidad')));
	});
	await check('upload: alternative row preserves the existing student profile and warns about differences', async () => {
		const base = pick(14);
		const ced = String(base.Ced_estudiante).trim().toUpperCase();
		const [{ apellidos_nombres: before }] = await q('SELECT apellidos_nombres FROM students WHERE cedula=?', [ced]);
		const d = await draft(sheet([{ ...base, Moda_Ingre: 'ATL', Apel_Nom: 'NOMBRE CAMBIADO' }]));
		assert.ok(d.preview.warnings.some((w) => w.message.includes('datos personales')));
		await importer.saveAdmissionBatch(d.batchId, ctx());
		const [{ apellidos_nombres: after }] = await q('SELECT apellidos_nombres FROM students WHERE cedula=?', [ced]);
		assert.ok(after === before, 'student name was overwritten by the alternative-modality row');
	});
	await check('upload: same student, other career and other process are independent groups', async () => {
		const [p2] = await owner.query("INSERT INTO admission_processes (num_asignacion,is_enabled) VALUES ('UA200/26-11-20',1)");
		await owner.query('INSERT INTO ap_active_dates (code_id,active_date) VALUES (?,?)', [p2.insertId, today]);
		const base = gY[0].raw;
		const d = await draft(sheet([
			{ ...base, Opcion: 'AA' },
			{ ...base, Num_Asignacion: '. UA200/26-11-20' }
		]));
		assert.equal(d.preview.errors.length, 0, JSON.stringify(d.preview.errors));
		assert.ok(!d.preview.warnings.some((w) => /modalidad/.test(w.message)), JSON.stringify(d.preview.warnings));
		assert.equal((await importer.saveAdmissionBatch(d.batchId, ctx())).insertedCount, 2);
		const other = await admissionOf(cedY, modY1, p2.insertId);
		const pOther = (await print(other)).processing.id;
		await review.reviewAdmissions([pOther], 'matriculado', '', ctx());
		const all = await enrollment.getEnrollmentReport(db);
		const mine = all.rows.filter((r) => r.cedula === cedY);
		assert.equal(mine.length, 3);
		assert.equal(mine.filter((r) => r.outcome === 'matriculado').length, 2);
	});

	// ---------- Concurrency ----------
	await check('concurrency: 12 parallel reviews of 3 alternatives → exactly one selection', async () => {
		const base = realRows.find((r) => r.Moda_Ingre === 'OPS' && ![cedX, cedY].includes(String(r.Ced_estudiante).trim().toUpperCase()));
		const ced = String(base.Ced_estudiante).trim().toUpperCase();
		const d = await draft(sheet([{ ...base, Moda_Ingre: 'CP' }, { ...base, Moda_Ingre: 'REC' }]));
		await importer.saveAdmissionBatch(d.batchId, ctx());
		const ids = [];
		for (const m of ['OPS', 'CP', 'REC']) ids.push((await print(await admissionOf(ced, m))).processing.id);
		const runs = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => review.reviewAdmissions([ids[i % 3]], 'matriculado', '', ctx(i % 2 ? 'stress-a' : 'stress-b'))));
		assert.equal(runs.filter((r) => r.status === 'fulfilled').length, 1, runs.filter((r) => r.status === 'rejected').map((r) => r.reason.message).join(' | '));
		const unexpected = runs.filter((r) => r.status === 'rejected' && !/matrícula|Solo se pueden/.test(r.reason.message));
		assert.deepEqual(unexpected.map((r) => r.reason.message), []);
		const sel = await q('SELECT s.* FROM admission_selections s JOIN students st ON st.id=s.student_id WHERE st.cedula=?', [ced]);
		assert.equal(sel.length, 1);
		const matr = await q("SELECT COUNT(*) n FROM admission_processings p JOIN admissions a ON a.id=p.admission_id JOIN students st ON st.id=a.student_id WHERE st.cedula=? AND p.status='matriculado'", [ced]);
		assert.equal(matr[0].n, 1);
	});
	await check('concurrency: unlock racing a review of the sibling never leaves two selections', async () => {
		const base = realRows.find((r) => r.Moda_Ingre === 'PS' && ![cedX, cedY].includes(String(r.Ced_estudiante).trim().toUpperCase()));
		const ced = String(base.Ced_estudiante).trim().toUpperCase();
		const d = await draft(sheet([{ ...base, Moda_Ingre: 'TRA' }]));
		await importer.saveAdmissionBatch(d.batchId, ctx());
		const pa = (await print(await admissionOf(ced, 'PS'))).processing.id;
		const pb = (await print(await admissionOf(ced, 'TRA'))).processing.id;
		for (let i = 0; i < 8; i++) {
			const [cur] = await q('SELECT admission_id FROM admission_selections s JOIN students st ON st.id=s.student_id WHERE st.cedula=?', [ced]);
			const aIds = { [await admissionOf(ced, 'PS')]: pa, [await admissionOf(ced, 'TRA')]: pb };
			let selectedP = cur ? aIds[cur.admission_id] : null;
			if (!selectedP) { await review.reviewAdmissions([pa], 'matriculado', '', ctx()); selectedP = pa; }
			const otherP = selectedP === pa ? pb : pa;
			await Promise.allSettled([
				review.unlockAdmission(selectedP, `RACE ${i}`, ctx()),
				review.reviewAdmissions([otherP], 'matriculado', '', ctx('stress-b'))
			]);
			const matr = await q("SELECT COUNT(*) n FROM admission_processings p JOIN admissions a ON a.id=p.admission_id JOIN students st ON st.id=a.student_id WHERE st.cedula=? AND p.status='matriculado'", [ced]);
			const sel = await q('SELECT admission_id FROM admission_selections s JOIN students st ON st.id=s.student_id WHERE st.cedula=?', [ced]);
			assert.ok(matr[0].n <= 1 && sel.length <= 1, `iteration ${i}: ${matr[0].n} matriculado, ${sel.length} selections`);
			assert.equal(matr[0].n, sel.length, `iteration ${i}: processing status and selection disagree`);
		}
	});
	await check('concurrency: two drafts adding the same new alternative saved in parallel → inserted once', async () => {
		const base = pick(20);
		const row = { ...base, Moda_Ingre: 'SAB' };
		const [d1, d2] = [await draft(sheet([row])), await draft(sheet([row]))];
		const runs = await Promise.allSettled([importer.saveAdmissionBatch(d1.batchId, ctx()), importer.saveAdmissionBatch(d2.batchId, ctx('stress-b'))]);
		const ok = runs.filter((r) => r.status === 'fulfilled');
		assert.ok(ok.length >= 1, runs.map((r) => r.reason?.message).join(' | '));
		assert.equal(ok.reduce((n, r) => n + r.value.insertedCount, 0), 1);
		const n = await q("SELECT COUNT(*) n FROM admissions a JOIN students s ON s.id=a.student_id JOIN admission_modalities m ON m.id=a.modality_id WHERE s.cedula=? AND m.codigo_admission='SAB'", [String(base.Ced_estudiante).trim().toUpperCase()]);
		assert.equal(n[0].n, 1);
	});
	await check('concurrency: same draft saved 5× in parallel → saved once', async () => {
		const d = await draft(sheet([{ ...pick(21), Moda_Ingre: 'EQU' }]));
		const runs = await Promise.allSettled(Array.from({ length: 5 }, () => importer.saveAdmissionBatch(d.batchId, ctx())));
		assert.equal(runs.filter((r) => r.status === 'fulfilled').length, 1, runs.map((r) => r.reason?.message).join(' | '));
	});
	await check('concurrency: printing an alternative while its sibling is being matriculado', async () => {
		const base = pick(22);
		const ced = String(base.Ced_estudiante).trim().toUpperCase();
		const d = await draft(sheet([{ ...base, Moda_Ingre: 'RU' }]));
		await importer.saveAdmissionBatch(d.batchId, ctx());
		const aMain = await admissionOf(ced, String(base.Moda_Ingre).trim()), aAlt = await admissionOf(ced, 'RU');
		const pMain = (await print(aMain)).processing.id;
		const runs = await Promise.allSettled([review.reviewAdmissions([pMain], 'matriculado', '', ctx()), print(aAlt)]);
		assert.equal(runs[0].status, 'fulfilled');
		const alt = await processingOf(aAlt);
		// Either printed before selection (then stays pendiente but blocked) or rejected.
		if (runs[1].status === 'rejected') assert.match(runs[1].reason.message, /otra modalidad/);
		else assert.equal(alt.status, 'pendiente');
	});

	// ---------- Statistics / exports while open ----------
	await check('statistics matricula mode: modality filter follows the selected offer', async () => {
		const spec = (qs) => stats.parseStatisticsSpec(new URL(`http://t/?reportMode=matricula&filter_process=${encodeURIComponent(PROC)}&${qs}`));
		const discarded = spec(`filter_modality=${modX2}`); // X selected X1, X2 discarded
		assert.deepEqual(discarded.errors, []);
		const r = await stats.buildStatisticsReport(discarded.spec);
		assert.ok(!r.enrollment.rows.some((x) => x.cedula === cedX && x.outcome !== 'matriculado'), 'X shown as not enrolled under discarded modality');
		const sel = await stats.buildStatisticsReport(spec(`filter_modality=${modX1}`).spec);
		assert.ok(sel.enrollment.rows.some((x) => x.cedula === cedX && x.outcome === 'matriculado'));
		const pend = await stats.buildStatisticsReport(spec('filter_status=pendiente').spec);
		assert.ok(!pend.enrollment.rows.some((x) => x.cedula === cedX));
	});
	await check('official letter totals per modality (11/2/1/5/44/49 = 112) match the offers loaded from the file', async () => {
		const rows = await q(`SELECT m.codigo_admission c, COUNT(*) n FROM admissions a JOIN admission_modalities m ON m.id=a.modality_id
			WHERE a.import_batch_id=? GROUP BY c ORDER BY c`, [firstDraft.batchId]);
		assert.deepEqual(Object.fromEntries(rows.map((r) => [r.c, Number(r.n)])), { AR: 11, ATL: 2, COP: 1, CV: 5, OPS: 44, PS: 49 });
	});
	await check('reconciliation mode does not count a discarded, never-printed alternative as "no procesado"', async () => {
		const spec = stats.parseStatisticsSpec(new URL(`http://t/?reportMode=reconciliacion&dateFrom=2026-11-09&dateTo=2026-11-09&filter_process=${encodeURIComponent(PROC)}`));
		assert.deepEqual(spec.errors, []);
		const r = await stats.buildStatisticsReport(spec.spec);
		const m = await report();
		const discardedUnprinted = (await q(`SELECT COUNT(*) n FROM admissions a JOIN admission_selections s
			ON s.student_id=a.student_id AND s.career_id=a.career_id AND s.proceso_id=a.proceso_id AND s.admission_id<>a.id
			LEFT JOIN admission_processings p ON p.admission_id=a.id WHERE a.proceso_id=? AND p.id IS NULL`, [procId]))[0].n;
		console.log(`      reconciliación: asignados=${r.reconciliation.asignados} noProcesados=${r.reconciliation.noProcesados} matriculado=${r.reconciliation.byStatus.matriculado} rate=${r.reconciliation.rates.matriculadosSobreAsignados.toFixed(4)} | matrícula mode: assigned=${m.totals.assigned} offers=${m.totals.offers} | discarded never-printed offers=${discardedUnprinted}`);
		assert.equal(r.reconciliation.asignados, m.totals.assigned, 'asignados counts offers, not assignments');
	});
	await check('re-upload with Fecha_asignacion as a real Excel date cell is still recognised as the same admission', async () => {
		const w = XLSX.utils.book_new();
		const ws = XLSX.utils.json_to_sheet([{ ...pick(40), Fecha_asignacion: new Date(2026, 10, 9) }], { cellDates: true });
		XLSX.utils.book_append_sheet(w, ws, 'Admision');
		const p = await importer.previewAdmissionFile(XLSX.write(w, { type: 'buffer', bookType: 'xlsx', cellDates: true }));
		assert.equal(p.errors.length, 0, JSON.stringify(p.errors.map((e) => e.message)));
		assert.notEqual(p.rows[0].existingAdmissionId, null);
		const w2 = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(w2, XLSX.utils.json_to_sheet([{ ...pick(41), Fecha_asignacion: 46335 }]), 'Admision'); // serial for 2026-11-09
		const p2 = await importer.previewAdmissionFile(XLSX.write(w2, { type: 'buffer', bookType: 'xlsx' }));
		assert.equal(p2.errors.length, 0, JSON.stringify(p2.errors.map((e) => e.message)));
	});
	await check('statistics matricula mode without a process is rejected', async () => {
		const p = stats.parseStatisticsSpec(new URL('http://t/?reportMode=matricula'));
		assert.ok(p.errors.length > 0);
	});
	await check('admisiones outcome SQL agrees with the JS outcome for every admission', async () => {
		const { eq } = orm;
		const rows = await db.select({
			admissionId: schema.admissions.id, selectedAdmissionId: schema.admissionSelections.admissionId,
			closedAt: schema.proceso_admission.closedAt, processingStatus: schema.admissionProcessings.status,
			sqlOutcome: enrollment.admissionOutcomeSql(), alternatives: enrollment.alternativeCountSql()
		}).from(schema.admissions)
			.innerJoin(schema.proceso_admission, eq(schema.proceso_admission.id, schema.admissions.procesoId))
			.leftJoin(schema.admissionSelections, enrollment.selectionScope())
			.leftJoin(schema.admissionProcessings, eq(schema.admissionProcessings.admissionId, schema.admissions.id));
		const { admissionOutcome } = await load('/src/lib/admission-outcomes.ts');
		const mismatch = rows.filter((r) => admissionOutcome(r).outcome !== r.sqlOutcome);
		assert.deepEqual(mismatch, []);
		assert.equal((await q('SELECT COUNT(*) n FROM admissions'))[0].n, rows.length, 'joins duplicated rows');
	});
	await check('live CSV and PDF export of real data', async () => {
		const r = await report();
		const csv = exporter.buildEnrollmentCsv(r, true);
		assert.equal(csv.split(/\r?\n/).filter((l) => l.includes(PROC)).length >= r.totals.assigned, true);
		const pdf = await exporter.buildEnrollmentPdf(r, true);
		assert.equal(Buffer.from(pdf).subarray(0, 4).toString(), '%PDF');
	});

	// ---------- Closure ----------
	let closure;
	await check('closure refused while today is still an active date', async () => {
		await assert.rejects(enrollment.closeAdmissionProcess(procId, 'CIERRE', ctx()), /última fecha activa/);
	});
	await owner.query('UPDATE ap_active_dates SET active_date=? WHERE code_id=?', [yesterday, procId]);
	await check('closure: official report has correct totals and per-row reasons', async () => {
		const live = await report();
		closure = await enrollment.closeAdmissionProcess(procId, 'CIERRE DE PRUEBA', ctx());
		const snap = await enrollment.getClosure(closure.closureId);
		const t = snap.report.totals;
		assert.equal(t.assigned, live.totals.assigned);
		assert.equal(t.offers, live.totals.offers);
		assert.equal(t.pendiente, 0);
		assert.equal(t.matriculado, live.totals.matriculado);
		assert.equal(t.no_matriculado, live.totals.assigned - live.totals.matriculado);
		const reasons = new Set(snap.report.rows.map((r) => r.reason));
		for (const r of ['Matrícula registrada', 'Sin trámite registrado', 'Documentación devuelta']) assert.ok(reasons.has(r), `missing reason ${r}: ${[...reasons]}`);
		assert.equal(snap.report.rows.filter((r) => r.reason === 'Otra modalidad seleccionada').length, 0, 'group rows should resolve to the selected offer');
	});
	await check('closed: upload, review, unlock, print, toggle-dates all blocked', async () => {
		const p = await importer.previewAdmissionFile(sheet([{ ...pick(30), Moda_Ingre: 'CU' }]));
		assert.ok(p.errors.some((e) => e.message.includes('cerrado')));
		await assert.rejects(review.reviewAdmissions([pX2], 'matriculado', '', ctx()), /cerrado/);
		await assert.rejects(review.unlockAdmission(pX1, 'X', ctx()), /cerrado/);
		await assert.rejects(print(aX1), /cerrado|no está activo/);
		assert.equal((await planilla.searchActiveAdmissionsForPlanilla(cedX, yesterday)).length, 0);
	});
	await check('closed: admissions outcome = no_matriculado for every non-selected offer', async () => {
		const r = await report();
		assert.equal(r.totals.pendiente, 0);
	});
	await check('closed: CSV/PDF from the snapshot with 110+ rows', async () => {
		const snap = await enrollment.getClosure(closure.closureId);
		const pdf = await exporter.buildEnrollmentPdf(snap.report, true);
		assert.equal(Buffer.from(pdf).subarray(0, 4).toString(), '%PDF');
		assert.match(exporter.buildEnrollmentCsv(snap.report, true), /Sin trámite registrado/);
	});
	await check('double close is rejected', async () => {
		await assert.rejects(enrollment.closeAdmissionProcess(procId, 'OTRA VEZ', ctx()), /cerrado/);
	});
	await check('parallel reopen x3 → only one succeeds', async () => {
		const runs = await Promise.allSettled([1, 2, 3].map(() => enrollment.reopenAdmissionProcess(procId, 'REAPERTURA', ctx())));
		assert.equal(runs.filter((r) => r.status === 'fulfilled').length, 1);
	});
	await check('after reopen: snapshot unchanged; swap X back; re-close gives v2 reflecting it', async () => {
		const before = await enrollment.getClosure(closure.closureId);
		await owner.query('INSERT INTO ap_active_dates (code_id,active_date) VALUES (?,?)', [procId, today]);
		await review.unlockAdmission(pX1, 'CORRECCION POST CIERRE', ctx());
		await review.reviewAdmissions([pX2], 'matriculado', '', ctx());
		await owner.query('DELETE FROM ap_active_dates WHERE code_id=? AND active_date=?', [procId, today]);
		const second = await enrollment.closeAdmissionProcess(procId, 'SEGUNDO CIERRE', ctx());
		assert.equal(second.version, 2);
		const s1 = await enrollment.getClosure(closure.closureId), s2 = await enrollment.getClosure(second.closureId);
		assert.equal(s1.sha256, before.sha256);
		assert.equal(s1.report.rows.find((r) => r.cedula === cedX).admissionId, aX1);
		assert.equal(s2.report.rows.find((r) => r.cedula === cedX).admissionId, aX2);
	});
	await check('tampering with a stored snapshot is impossible (triggers) and detected if done', async () => {
		await assert.rejects(owner.query("UPDATE admission_process_closures SET reason='X' WHERE id=?", [closure.closureId]), /inmutables/);
	});
	await check('audit chain verifies after the full workflow', async () => {
		const v = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/audit-ledger.ts', 'verify'], {
			env: { ...process.env, DATABASE_URL: ownerDbUrl }, encoding: 'utf8', windowsHide: true
		});
		assert.equal(v.status, 0, v.stderr || v.stdout);
	});
	await check('invariant: no group has more than one matriculado processing or selection', async () => {
		const bad = await q(`SELECT a.student_id, a.career_id, a.proceso_id, COUNT(*) n FROM admissions a
			JOIN admission_processings p ON p.admission_id=a.id WHERE p.status='matriculado'
			GROUP BY a.student_id,a.career_id,a.proceso_id HAVING n>1`);
		assert.deepEqual(bad, []);
		const orphan = await q(`SELECT COUNT(*) n FROM admission_processings p LEFT JOIN admission_selections s ON s.admission_id=p.admission_id
			WHERE p.status='matriculado' AND s.admission_id IS NULL`);
		assert.equal(orphan[0].n, 0);
		const stale = await q(`SELECT COUNT(*) n FROM admission_selections s JOIN admission_processings p ON p.admission_id=s.admission_id
			WHERE p.status<>'matriculado'`);
		assert.equal(stale[0].n, 0);
	});
} finally {
	if (pool) await pool.end();
	if (vite) await vite.close();
	if (created && !process.env.KEEP_DB) await owner.query(`DROP DATABASE \`${database}\``);
	if (process.env.KEEP_DB) console.log(`Kept database ${database}`);
	await owner.query('DROP USER IF EXISTS ?@?', [testUser, '%']);
	const uploadRoot = path.resolve('var/uploads/admisiones');
	for (const directory of uploadedDirectories) {
		const relative = path.relative(uploadRoot, path.resolve(directory));
		assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
		await rm(directory, { recursive: true, force: true });
	}
	await owner.end();
	const failed = results.filter((r) => !r.ok);
	console.log(`\n${results.length - failed.length}/${results.length} passed`);
	if (failed.length) { console.log('Failed:\n' + failed.map((f) => ` - ${f.name}`).join('\n')); process.exitCode = 1; }
}
