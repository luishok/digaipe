// Times the statistics report modes on ~2 years of FICTITIOUS data (30k assignments, 10% with an
// extra modality) in a disposable localhost database that is dropped at the end.
//   node scripts/perf-statistics-alternatives.mjs
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import { createServer } from 'vite';

const serverUrl = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(serverUrl.hostname)) throw new Error('localhost only');
const database = `digaipe_admission_test_${Date.now()}`;
serverUrl.pathname = '/';
const owner = await mysql.createConnection({ uri: serverUrl.toString() });
let vite, pool, created = false;
const testUser = `adm_test_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
const testPassword = randomUUID();
try {
	await owner.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
	created = true;
	await owner.query(`USE \`${database}\``);
	serverUrl.pathname = `/${database}`;
	const journal = JSON.parse(await readFile('drizzle/meta/_journal.json', 'utf8'));
	for (const entry of journal.entries)
		for (const s of (await readFile(`drizzle/${entry.tag}.sql`, 'utf8')).split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean))
			await owner.query(s);
	const q = (sql, args) => owner.query(sql, args);
	const t0 = Date.now();
	await q("INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES ('perf','PERF','perf@example.invalid',1,NOW(),NOW())");
	await q("INSERT INTO careers (id,programa_academico,ofae,facultad,nucleo) SELECT n, CONCAT('CARRERA ',n), LPAD(n,4,'0'), CONCAT('FACULTAD ',n%8), 'M' FROM (WITH RECURSIVE s(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM s WHERE n<60) SELECT n FROM s) x");
	await q("INSERT INTO admission_modalities (id,codigo_admission,nombre) VALUES (1,'OPS','OPSU'),(2,'PS','PRUEBA'),(3,'AR','ALTO RENDIMIENTO'),(4,'CV','CONVENIO')");
	await q("INSERT INTO admission_processes (id,num_asignacion,is_enabled) SELECT n, CONCAT('UA',n,'/PERF'), 1 FROM (WITH RECURSIVE s(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM s WHERE n<48) SELECT n FROM s) x");
	await q('SET SESSION cte_max_recursion_depth = 100000');
	await q("INSERT INTO students (id,cedula,apellidos_nombres) SELECT n, CONCAT('V', 20000000+n), CONCAT('FICTICIO ', n) FROM (WITH RECURSIVE s(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM s WHERE n<30000) SELECT n FROM s) x");
	// One primary offer per student; process = month bucket over 2 years.
	await q(`INSERT INTO admissions (id,student_id,career_id,proceso_id,modality_id,opcion,periodo_ingreso,fecha_asignacion,ano,proceso)
		SELECT id, id, 1+id%60, 1+(id%48), 1+id%2, '0001', 'A2026', DATE_SUB(CURDATE(), INTERVAL (id%730) DAY), 2026, 1 FROM students`);
	// 10% get an alternative modality (AR/CV) for the same assignment.
	await q(`INSERT INTO admissions (id,student_id,career_id,proceso_id,modality_id,opcion,periodo_ingreso,fecha_asignacion,ano,proceso)
		SELECT 100000+id, id, 1+id%60, 1+(id%48), 3+id%2, '0001', 'A2026', DATE_SUB(CURDATE(), INTERVAL (id%730) DAY), 2026, 1 FROM students WHERE id%10=0`);
	// 70% of primaries processed; 60% of those matriculado (selected), rest pendiente/devuelto.
	await q(`INSERT INTO admission_processings (admission_id,processing_date,generated_by_user_id,status)
		SELECT id, fecha_asignacion + INTERVAL 2 DAY, 'perf', CASE WHEN id%10<6 THEN 'matriculado' WHEN id%10<8 THEN 'pendiente' ELSE 'devuelto' END
		FROM admissions WHERE id<100000 AND id%10<7`);
	// Half of the alternatives were printed too (left pendiente).
	await q(`INSERT INTO admission_processings (admission_id,processing_date,generated_by_user_id,status)
		SELECT id, fecha_asignacion + INTERVAL 3 DAY, 'perf', 'pendiente' FROM admissions WHERE id>=100000 AND id%20=0`);
	await q(`INSERT INTO admission_selections (student_id,career_id,proceso_id,admission_id,selected_by_user_id)
		SELECT a.student_id,a.career_id,a.proceso_id,a.id,'perf' FROM admissions a JOIN admission_processings p ON p.admission_id=a.id WHERE p.status='matriculado'`);
	const [[counts]] = await q('SELECT (SELECT COUNT(*) FROM admissions) offers, (SELECT COUNT(*) FROM admission_processings) processings, (SELECT COUNT(*) FROM admission_selections) selections');
	console.log(`Seeded in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${JSON.stringify(counts)}`);

	const grants = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/grant-db-users.ts'], {
		env: { ...process.env, DATABASE_URL: serverUrl.toString(), APP_DB_USER: testUser, APP_DB_PASSWORD: testPassword, BACKUP_DB_PASSWORD: '', READONLY_DB_PASSWORD: '' }, encoding: 'utf8', windowsHide: true });
	if (grants.status !== 0) throw new Error(grants.stderr || grants.stdout);
	const appUrl = new URL(serverUrl); appUrl.username = testUser; appUrl.password = testPassword;
	process.env.DATABASE_URL = appUrl.toString();
	vite = await createServer({
		configFile: false, server: { middlewareMode: true, watch: null },
		resolve: { alias: { $lib: path.resolve('src/lib') } },
		plugins: [{ name: 'rt', resolveId(id) { if (id === '$env/dynamic/private' || id === '$app/environment') return `\0t:${id}`; },
			load(id) { if (id === '\0t:$env/dynamic/private') return 'export const env = process.env'; if (id === '\0t:$app/environment') return 'export const building = false'; } }]
	});
	const stats = await vite.ssrLoadModule('/src/lib/server/admisiones/statistics.ts');
	pool = (await vite.ssrLoadModule('/src/lib/server/db/index.ts')).db.$client;
	const ago = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
	const today = new Date().toISOString().slice(0, 10);
	const cases = [
		['reconciliación 1 mes', `reportMode=reconciliacion&dateFrom=${ago(30)}&dateTo=${today}`],
		['reconciliación 1 año', `reportMode=reconciliacion&dateFrom=${ago(365)}&dateTo=${today}`],
		['reconciliación 2 años', `reportMode=reconciliacion&dateFrom=${ago(730)}&dateTo=${today}&includeStudentData=on`],
		['reconciliación 1 proceso', `reportMode=reconciliacion&dateFrom=${ago(730)}&dateTo=${today}&filter_process=UA7/PERF`],
		['matrícula 1 proceso', 'reportMode=matricula&filter_process=UA7/PERF'],
		['matrícula 12 procesos', `reportMode=matricula&${Array.from({ length: 12 }, (_, i) => `filter_process=UA${i + 1}/PERF`).join('&')}`],
		['general 1 año', `reportMode=general&dateFrom=${ago(365)}&dateTo=${today}`]
	];
	for (const [name, qs] of cases) {
		const { spec, errors } = stats.parseStatisticsSpec(new URL(`http://t/?${qs}`));
		if (errors.length) throw new Error(`${name}: ${errors}`);
		await stats.buildStatisticsReport(spec); // warm-up
		const times = [];
		for (let i = 0; i < 5; i++) { const s = performance.now(); await stats.buildStatisticsReport(spec); times.push(performance.now() - s); }
		times.sort((a, b) => a - b);
		const r = await stats.buildStatisticsReport(spec);
		const size = r.reconciliation ? `asignados=${r.reconciliation.asignados} ofertas=${r.reconciliation.ofertas}` : r.enrollment ? `asignados=${r.enrollment.totals.assigned}` : `rows=${r.totalAdmissions}`;
		console.log(`${name.padEnd(26)} median ${times[2].toFixed(0).padStart(5)} ms  max ${times[4].toFixed(0).padStart(5)} ms  (${size})`);
	}
	const mem = process.memoryUsage();
	console.log(`heap used ${(mem.heapUsed / 1048576).toFixed(0)} MB`);
} finally {
	if (pool) await pool.end();
	if (vite) await vite.close();
	if (created) await owner.query(`DROP DATABASE \`${database}\``);
	await owner.query('DROP USER IF EXISTS ?@?', [testUser, '%']);
	await owner.end();
}
