// Statistics vs alternative modalities, on a hand-built FICTITIOUS dataset with known answers.
// Disposable localhost database only (digaipe_admission_test_*), dropped at the end.
//   node scripts/stress-statistics-alternatives.mjs
import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import { createServer } from 'vite';

const results = [];
async function check(name, fn) {
	try { await fn(); results.push({ ok: true }); console.log(`PASS  ${name}`); }
	catch (error) { results.push({ ok: false, name }); console.log(`FAIL  ${name}\n      ${String(error?.message ?? error).split('\n').filter(Boolean).slice(0, 4).join('\n      ')}`); }
}
const serverUrl = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(serverUrl.hostname)) throw new Error('localhost only');
const database = `digaipe_admission_test_${Date.now()}`;
serverUrl.pathname = '/';
const owner = await mysql.createConnection({ uri: serverUrl.toString(), multipleStatements: false });
let vite, pool, created = false;
const testUser = `adm_test_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
const testPassword = randomUUID();
try {
	await owner.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
	created = true;
	await owner.query(`USE \`${database}\``);
	serverUrl.pathname = `/${database}`;
	const ownerDbUrl = serverUrl.toString();
	const journal = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8'));
	for (const entry of journal.entries)
		for (const s of (await readFile(`drizzle/${entry.tag}.sql`, 'utf8')).split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean))
			await owner.query(s);
	const q = async (sql, args = []) => (await owner.query(sql, args))[0];
	await q("INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES ('stats','STATS','stats@example.invalid',1,NOW(),NOW())");
	await q("INSERT INTO careers (id,programa_academico,ofae,facultad,nucleo) VALUES (1,'CARRERA UNO','0001','FACULTAD A','T'),(2,'CARRERA DOS','0002','FACULTAD A','T')");
	await q("INSERT INTO admission_modalities (id,codigo_admission,nombre) VALUES (1,'AR','ALTO RENDIMIENTO'),(2,'CV','CONVENIO'),(3,'EX','EXTRA')");
	await q("INSERT INTO admission_processes (id,num_asignacion,is_enabled) VALUES (1,'PROC-STATS',1),(2,'PROC-OTRO',1)");

	// ── Fixture. D1 = assignment date, P1/P2 = processing dates. ──
	const D1 = '2026-03-02', D2 = '2026-03-20', P1 = '2026-03-05', P2 = '2026-03-06';
	let nextAdmission = 1, nextStudent = 1;
	const student = async (label) => {
		const id = nextStudent++;
		await q('INSERT INTO students (id,cedula,apellidos_nombres) VALUES (?,?,?)', [id, `V-0770${String(id).padStart(5, '0')}`, `FICTICIO ${label}`]);
		return id;
	};
	const offer = async (s, modality, { career = 1, proc = 1, date = D1, status = null, pdate = P1 } = {}) => {
		const id = nextAdmission++;
		await q("INSERT INTO admissions (id,student_id,career_id,proceso_id,modality_id,opcion,periodo_ingreso,fecha_asignacion,ano,proceso) VALUES (?,?,?,?,?,'0001','A2026',?,2026,1)",
			[id, s, career, proc, { AR: 1, CV: 2, EX: 3 }[modality], date]);
		if (status) await q("INSERT INTO admission_processings (admission_id,processing_date,generated_by_user_id,status) VALUES (?,?,'stats',?)", [id, pdate, status]);
		return id;
	};
	const select = async (admissionId) => {
		const [a] = await q('SELECT student_id,career_id,proceso_id FROM admissions WHERE id=?', [admissionId]);
		await q('INSERT INTO admission_selections (student_id,career_id,proceso_id,admission_id,selected_by_user_id) VALUES (?,?,?,?,?)', [a.student_id, a.career_id, a.proceso_id, admissionId, 'stats']);
	};
	const devueltoEvent = async (admissionId) => {
		const [p] = await q('SELECT id FROM admission_processings WHERE admission_id=?', [admissionId]);
		await q("CALL append_audit_event(UUID(),'app','admission_document.reviewed','success',NULL,NULL,NULL,NULL,NULL,NULL,'admission_processing',?,JSON_OBJECT('status','pendiente'),JSON_OBJECT('status','devuelto'),NULL)", [String(p.id)]);
	};
	// G1: AR matriculado (selected); CV printed on P2 and left pendiente → discarded.
	const s1 = await student('G1');
	const g1ar = await offer(s1, 'AR', { status: 'matriculado' }); await select(g1ar);
	await offer(s1, 'CV', { status: 'pendiente', pdate: P2 });
	// G2: CV matriculado; AR never printed.
	const s2 = await student('G2');
	await offer(s2, 'AR'); await select(await offer(s2, 'CV', { status: 'matriculado' }));
	// G3: AR + CV, nothing printed.
	const s3 = await student('G3'); await offer(s3, 'AR'); await offer(s3, 'CV');
	// G4: AR devuelto, CV pendiente, no selection.
	const s4 = await student('G4');
	const g4ar = await offer(s4, 'AR', { status: 'devuelto' }); await devueltoEvent(g4ar);
	await offer(s4, 'CV', { status: 'pendiente' });
	// G5: AR only, matriculado.  G6: AR only, never printed.  G8: AR only, pendiente.
	const s5 = await student('G5'); await select(await offer(s5, 'AR', { status: 'matriculado' }));
	const s6 = await student('G6'); await offer(s6, 'AR');
	const s8 = await student('G8'); await offer(s8, 'AR', { status: 'pendiente' });
	// G7: AR devuelto (discarded), CV matriculado.
	const s7 = await student('G7');
	const g7ar = await offer(s7, 'AR', { status: 'devuelto' }); await devueltoEvent(g7ar);
	await select(await offer(s7, 'CV', { status: 'matriculado' }));
	// G9: same student as G1, other career → independent, matriculado.
	await select(await offer(s1, 'AR', { career: 2, status: 'matriculado' }));
	// G10: AR assigned D1 (not printed); EX alternative added by a later upload dated D2, matriculado.
	const s10 = await student('G10');
	await offer(s10, 'AR'); await select(await offer(s10, 'EX', { date: D2, status: 'matriculado', pdate: P2 }));
	// Noise in another process (must never leak into PROC-STATS results).
	const s11 = await student('G11'); await offer(s11, 'AR', { proc: 2 }); await offer(s11, 'CV', { proc: 2 });

	const grants = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/grant-db-users.ts'], {
		env: { ...process.env, DATABASE_URL: ownerDbUrl, APP_DB_USER: testUser, APP_DB_PASSWORD: testPassword, BACKUP_DB_PASSWORD: '', READONLY_DB_PASSWORD: '' }, encoding: 'utf8', windowsHide: true });
	assert.equal(grants.status, 0, grants.stderr || grants.stdout);
	const appUrl = new URL(serverUrl); appUrl.username = testUser; appUrl.password = testPassword;
	process.env.DATABASE_URL = appUrl.toString();
	vite = await createServer({
		configFile: false, server: { middlewareMode: true, watch: null },
		resolve: { alias: { $lib: path.resolve('src/lib') } },
		plugins: [{ name: 'rt', resolveId(id) { if (id === '$env/dynamic/private' || id === '$app/environment') return `\0t:${id}`; },
			load(id) { if (id === '\0t:$env/dynamic/private') return 'export const env = process.env'; if (id === '\0t:$app/environment') return 'export const building = false'; } }]
	});
	const stats = await vite.ssrLoadModule('/src/lib/server/admisiones/statistics.ts');
	const exporter = await vite.ssrLoadModule('/src/lib/server/admisiones/statistics-export.ts');
	pool = (await vite.ssrLoadModule('/src/lib/server/db/index.ts')).db.$client;
	const run = async (qs) => {
		const parsed = stats.parseStatisticsSpec(new URL(`http://t/?${qs}`));
		assert.deepEqual(parsed.errors, []);
		return stats.buildStatisticsReport(parsed.spec);
	};
	const recon = (extra = '') => run(`reportMode=reconciliacion&dateBasis=asignacion&dateFrom=2026-03-01&dateTo=2026-03-31&filter_process=PROC-STATS${extra}`);
	const summary = (r) => { const x = r.reconciliation; return { asignados: x.asignados, ofertas: x.ofertas, noProcesados: x.noProcesados, procesados: x.procesados, ...x.byStatus }; };

	// Expected: 10 assignments (G1..G10), 16 offers. No processing at all: G3, G6.
	// Representative status: matriculado G1 G2 G5 G7 G9 G10 = 6; pendiente G4 G8 = 2; devuelto 0.
	await check('Conciliación totals: 10 asignaciones / 16 ofertas / 2 sin trámite / 6 matriculadas / 2 pendientes / 0 devueltas', async () => {
		assert.deepEqual(summary(await recon()), { asignados: 10, ofertas: 16, noProcesados: 2, procesados: 8, pendiente: 2, matriculado: 6, devuelto: 0 });
	});
	await check('Conciliación rates are per assignment (6/10 matriculados, 2/10 no presentación)', async () => {
		const r = (await recon()).reconciliation.rates;
		assert.equal(r.matriculadosSobreAsignados, 0.6);
		assert.equal(r.noPresentacion, 0.2);
	});
	await check('Conciliación other process never leaks in; unique students = 9 (G1/G9 same person)', async () => {
		const r = await recon();
		assert.equal(r.totalUniqueStudents, 9);
	});
	await check('Conciliación status=pendiente → only G4, G8 (G1\'s discarded pendiente CV excluded)', async () => {
		assert.equal((await recon('&filter_status=pendiente')).reconciliation.asignados, 2);
	});
	await check('Conciliación status=devuelto → 0 (discarded AR devueltos of G4/G7 not counted)', async () => {
		assert.equal((await recon('&filter_status=devuelto')).reconciliation.asignados, 0);
	});
	await check('Conciliación modality=CV → G2 G3 G4 G7 (selected CV or unselected with CV); G1 excluded', async () => {
		assert.equal((await recon('&filter_modality=CV')).reconciliation.asignados, 4);
	});
	await check('Conciliación modality=AR → G1 G3 G4 G5 G6 G8 G9 (G2/G7/G10 chose another modality)', async () => {
		assert.equal((await recon('&filter_modality=AR')).reconciliation.asignados, 7);
	});
	await check('Conciliación devoluciones: returned assignments G4 (now pendiente) and G7 (now matriculado)', async () => {
		const x = (await recon()).reconciliation;
		const d = (await recon()).reconciliation.devoluciones;
		console.log(`      devoluciones: ${JSON.stringify(d)}`);
		assert.equal(d.everDevueltas, 2);
		assert.equal(d.sinRetornar, 0);
		assert.equal(d.reingresadasMatriculadas, 1);
		assert.equal(d.reingresadasPendientes, 1);
	});
	await check('Conciliación date basis digaipe P2 only: G10 (selected EX processed P2); G1\'s CV printed P2 is discarded → not counted', async () => {
		const r = await run('reportMode=reconciliacion&dateBasis=digaipe&dateFrom=2026-03-06&dateTo=2026-03-06&filter_process=PROC-STATS');
		assert.equal(r.reconciliation.procesados, 1);
	});
	await check('Conciliación assignment range 2026-03-20 only: G10 has an offer assigned that day (EX, matriculado)', async () => {
		const r = await run('reportMode=reconciliacion&dateBasis=asignacion&dateFrom=2026-03-20&dateTo=2026-03-20&filter_process=PROC-STATS');
		assert.equal(r.reconciliation.asignados, 1, 'group dated by its earliest offer (D1), so the D2 offer that was actually enrolled disappears from a D2-only range');
	});
	await check('Conciliación search by cédula in another format finds the group', async () => {
		for (const term of ['V-77.000.001', 'v77000001', '77000001', 'V 077000001'])
			assert.equal((await recon('&search=' + encodeURIComponent(term))).reconciliation.asignados, 2, term); // G1 + G9 (same person, 2 careers)
	});
	await check('Conciliación CSV and PDF include the ofertas line', async () => {
		const r = await recon();
		assert.match(exporter.buildStatisticsCsv(r), /Ofertas de admisi[oó]n[^\n]*16/);
		const pdf = await exporter.buildStatisticsPdf(r);
		assert.equal(Buffer.from(pdf).subarray(0, 4).toString(), '%PDF');
	});
	await check('Matrícula mode agrees with Conciliación (10 asignaciones, 6 matriculadas, 4 pendientes)', async () => {
		const r = await run('reportMode=matricula&filter_process=PROC-STATS');
		assert.deepEqual(r.enrollment.totals, { assigned: 10, offers: 16, matriculado: 6, no_matriculado: 0, pendiente: 4 });
	});
	for (const mode of ['general', 'consolidado', 'estadisticas']) {
		await check(`${mode}: a discarded alternative (G1 CV, pendiente forever) is not reported as Pendiente`, async () => {
			const r = await run(`reportMode=${mode}&dateBasis=digaipe&dateFrom=2026-03-01&dateTo=2026-03-31&filter_process=PROC-STATS`);
			const estado = Object.fromEntries((r.breakdowns.Estado ?? []).map((b) => [b.label, b.count]));
			console.log(`      ${mode}: rows=${r.totalAdmissions} unique=${r.totalUniqueStudents} Estado=${JSON.stringify(estado)}`);
			assert.equal(estado.pendiente ?? 0, 2, 'counts discarded offers (G1 CV) as pendiente; expected 2 (G4, G8)');
		});
	}
	await check('general (asignación basis): totals count assignments, not offers', async () => {
		const r = await run('reportMode=general&dateBasis=asignacion&dateFrom=2026-03-01&dateTo=2026-03-31&filter_process=PROC-STATS');
		console.log(`      general/asignación: totalAdmissions=${r.totalAdmissions} unique=${r.totalUniqueStudents}`);
		assert.equal(r.totalAdmissions, 10, 'reports offers as admissions');
		assert.equal(r.totalOffers, 16);
	});
	for (const mode of ['general', 'consolidado', 'estadisticas']) {
		await check(`${mode}: assignment date filtering and daily groups follow the selected date basis`, async () => {
			const r = await run(`reportMode=${mode}&dateBasis=asignacion&dateFrom=2026-03-20&dateTo=2026-03-20&filter_process=PROC-STATS`);
			assert.equal(r.totalAdmissions, 1);
			assert.equal(r.rows[0].modality, 'EX');
			assert.equal(r.pivot[0].date, '2026-03-20');
			assert.equal(r.breakdowns.Diario[0].label, '20-03-2026');
		});
	}
	await q("UPDATE admissions SET periodo_ingreso='U2026' WHERE id=?", [g1ar]);
	for (const mode of ['general', 'consolidado', 'estadisticas', 'reconciliacion']) {
		await check(`${mode}: an old-period alternative cannot hide its selected offer and revive pending status`, async () => {
			const r = await run(`reportMode=${mode}&dateBasis=asignacion&dateFrom=2026-03-01&dateTo=2026-03-31&filter_process=PROC-STATS&filter_period=A2026`);
			if (mode === 'reconciliacion') { assert.equal(r.reconciliation.asignados, 9); assert.equal(r.reconciliation.byStatus.pendiente, 2); }
			else { assert.ok(r.rows.every((row) => !row.offerIds.includes(g1ar))); assert.equal(r.breakdowns.Estado.find((x) => x.label === 'pendiente').count, 2); }
		});
	}
} finally {
	if (pool) await pool.end();
	if (vite) await vite.close();
	if (created) await owner.query(`DROP DATABASE \`${database}\``);
	await owner.query('DROP USER IF EXISTS ?@?', [testUser, '%']);
	await owner.end();
	const failed = results.filter((r) => !r.ok);
	console.log(`\n${results.length - failed.length}/${results.length} passed`);
	if (failed.length) process.exitCode = 1;
}
