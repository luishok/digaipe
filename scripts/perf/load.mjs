// Load test against the production build, using the digaipe_perf database.
//
//   npm run build
//   node scripts/perf/load.mjs [--users 5] [--realistic 180] [--stress 120] [--port 3100]
//
// Starts `node build` itself (PORT/ORIGIN overridden, DATABASE_URL → digaipe_perf), signs in
// one session per virtual user, then runs three phases:
//   1. baseline  – every scenario 3× by a single user (no contention)
//   2. realistic – N users, 3–10 s think time between requests (normal office use)
//   3. stress    – N users, no think time (everyone clicking at once, worst case)
// Reports latency percentiles, errors and payload size per scenario, plus server memory.
import { spawn, execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import mysql from 'mysql2/promise';
import { perfEnv } from './with-perf-db.mjs';

const arg = (name, fallback) => {
	const i = process.argv.indexOf(`--${name}`);
	return i > 0 ? Number(process.argv[i + 1]) : fallback;
};
const USERS = arg('users', 5);
const REALISTIC_S = arg('realistic', 180);
const STRESS_S = arg('stress', 120);
const PORT = arg('port', 3100);
const BASE = `http://localhost:${PORT}`;
const OUT = process.env.PERF_OUT ?? 'perf-results.json';

const env = {
	...process.env,
	...perfEnv(),
	PORT: String(PORT),
	ORIGIN: BASE,
	NODE_ENV: 'production'
};

// ── fixtures from the synthetic data (fictional) ─────────────────────────────
const conn = await mysql.createConnection(env.DATABASE_URL);
const [[sample]] = await conn.query(
	'SELECT s.cedula, s.apellidos_nombres AS name FROM students s WHERE LENGTH(s.cedula) = 10 ORDER BY s.id DESC LIMIT 1'
);
await conn.end();
const digits = sample.cedula.replace(/^\D0*/, '');
const typedCedula = `V-${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const [w1, , w3] = sample.name.split(' ');

const iso = (d) => d.toISOString().slice(0, 10);
const today = new Date();
const ago = (days) => iso(new Date(today.getTime() - days * 86_400_000));
const T = iso(today);
const stats = (p) =>
	`/digaipe/estadisticas?${new URLSearchParams({ dateBasis: 'asignacion', dateTo: T, ...p })}`;

// weight = how often a real user would do this, relative to others
const SCENARIOS = [
	{ name: 'dashboard', weight: 4, path: '/digaipe' },
	{ name: 'admisiones list', weight: 4, path: '/digaipe/admisiones' },
	{
		name: 'admisiones search cédula',
		weight: 3,
		path: `/digaipe/admisiones?search=${encodeURIComponent(typedCedula)}`
	},
	{
		name: 'planilla search name',
		weight: 3,
		path: `/digaipe/generacion-planilla?search=${encodeURIComponent(`${w1} ${w3}`)}`
	},
	{ name: 'revisión today', weight: 4, path: '/digaipe/revision-documentos' },
	{
		name: 'revisión 30 days',
		weight: 2,
		path: `/digaipe/revision-documentos?dateFrom=${ago(30)}&dateTo=${T}`
	},
	{ name: 'stats form (empty)', weight: 2, path: '/digaipe/estadisticas' },
	{
		name: 'stats general 1 month',
		weight: 3,
		path: stats({ reportMode: 'general', dateFrom: ago(30) })
	},
	{
		name: 'stats general 1 year',
		weight: 2,
		path: stats({ reportMode: 'general', dateFrom: ago(365) })
	},
	{
		name: 'stats general 2 years',
		weight: 1,
		path: stats({ reportMode: 'general', dateFrom: ago(730) })
	},
	{
		name: 'stats estadísticas 1 year',
		weight: 2,
		path: stats({ reportMode: 'estadisticas', dateFrom: ago(365) })
	},
	{
		name: 'stats consolidado 1 month +stud',
		weight: 2,
		path: stats({ reportMode: 'consolidado', dateFrom: ago(30), includeStudentData: 'on' })
	},
	{
		name: 'stats reconciliación 1 year',
		weight: 2,
		path: stats({ reportMode: 'reconciliacion', dateFrom: ago(365) })
	},
	{
		name: 'stats reconciliación 2 years',
		weight: 1,
		path: stats({ reportMode: 'reconciliacion', dateFrom: ago(730), includeStudentData: 'on' })
	},
	{
		name: 'stats search cédula 2 years',
		weight: 2,
		path: stats({ reportMode: 'general', dateFrom: ago(730), search: typedCedula })
	},
	{
		name: 'stats search name 2 years',
		weight: 2,
		path: stats({ reportMode: 'general', dateFrom: ago(730), search: `${w3} ${w1}` })
	},
	{
		name: 'CSV general 1 year',
		weight: 1,
		path: stats({ reportMode: 'general', dateFrom: ago(365) }).replace(
			'/estadisticas?',
			'/estadisticas/csv?'
		)
	},
	{
		name: 'PDF estadísticas 1 year',
		weight: 1,
		path: stats({ reportMode: 'estadisticas', dateFrom: ago(365) }).replace(
			'/estadisticas?',
			'/estadisticas/pdf?'
		)
	},
	{
		name: 'PDF general 1 month',
		weight: 1,
		path: stats({ reportMode: 'general', dateFrom: ago(30) }).replace(
			'/estadisticas?',
			'/estadisticas/pdf?'
		)
	},
	{ name: 'audit log page 1', weight: 1, path: '/digaipe/admin/audit' },
	{ name: 'audit log page 500', weight: 1, path: '/digaipe/admin/audit?page=500' }
];

// ── server lifecycle ────────────────────────────────────────────────────────
const server = spawn(process.execPath, ['build'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
const serverLog = [];
server.stdout.on('data', (d) => serverLog.push(String(d)));
server.stderr.on('data', (d) => serverLog.push(String(d)));
const stop = () => server.kill();
process.on('exit', stop);

for (let i = 0; ; i++) {
	try {
		await fetch(`${BASE}/login`);
		break;
	} catch {
		if (i > 60) throw new Error(`server did not start:\n${serverLog.join('')}`);
		await new Promise((r) => setTimeout(r, 500));
	}
}

function memoryMb() {
	try {
		const out = execSync(
			`powershell -NoProfile -Command "(Get-Process -Id ${server.pid}).WorkingSet64"`,
			{ encoding: 'utf8' }
		);
		return Math.round(Number(out.trim()) / 1048576);
	} catch {
		return null;
	}
}

async function signIn() {
	const body = new URLSearchParams({
		email: env.BOOTSTRAP_ADMIN_EMAIL,
		password: env.BOOTSTRAP_ADMIN_PASSWORD
	});
	const res = await fetch(`${BASE}/login?/signInEmail`, {
		method: 'POST',
		body,
		redirect: 'manual',
		headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded' }
	});
	const cookie = res.headers
		.getSetCookie()
		.map((c) => c.split(';')[0])
		.join('; ');
	if (!cookie.includes('session')) throw new Error(`sign-in failed: HTTP ${res.status}`);
	return cookie;
}

// ── measurement ─────────────────────────────────────────────────────────────
const results = {}; // phase → scenario → samples
async function hit(phase, scenario, cookie) {
	const started = performance.now();
	let status = 0;
	let bytes = 0;
	let note = '';
	try {
		const res = await fetch(BASE + scenario.path, { headers: { cookie }, redirect: 'manual' });
		status = res.status;
		const buf = await res.arrayBuffer();
		bytes = buf.byteLength;
		if (status >= 300 && status < 400) note = `redirect → ${res.headers.get('location')}`;
		if (status >= 500) note = Buffer.from(buf).toString('utf8').slice(0, 200);
	} catch (error) {
		note = String(error);
	}
	const ms = performance.now() - started;
	((results[phase] ??= {})[scenario.name] ??= []).push({ ms, status, bytes, note });
}

const weighted = SCENARIOS.flatMap((s) => Array(s.weight).fill(s));
const pickScenario = () => weighted[Math.floor(Math.random() * weighted.length)];

async function runUsers(phase, seconds, thinkMs, cookies) {
	const until = Date.now() + seconds * 1000;
	const memory = [];
	const sampler = setInterval(() => memory.push(memoryMb()), 5000);
	await Promise.all(
		cookies.map(async (cookie) => {
			while (Date.now() < until) {
				await hit(phase, pickScenario(), cookie);
				if (thinkMs)
					await new Promise((r) =>
						setTimeout(r, thinkMs[0] + Math.random() * (thinkMs[1] - thinkMs[0]))
					);
			}
		})
	);
	clearInterval(sampler);
	return memory.filter((m) => m !== null);
}

const pct = (sorted, p) =>
	sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
function summarize(phase) {
	return Object.entries(results[phase] ?? {}).map(([name, samples]) => {
		const ms = samples.map((s) => s.ms).sort((a, b) => a - b);
		const errors = samples.filter((s) => s.status !== 200);
		return {
			scenario: name,
			n: samples.length,
			p50: Math.round(pct(ms, 50)),
			p95: Math.round(pct(ms, 95)),
			max: Math.round(ms[ms.length - 1]),
			kb: Math.round(samples.reduce((a, s) => a + s.bytes, 0) / samples.length / 1024),
			errors: errors.length,
			firstError: errors[0] ? `${errors[0].status} ${errors[0].note}`.slice(0, 160) : ''
		};
	});
}

// ── run ─────────────────────────────────────────────────────────────────────
const cookies = [];
for (let i = 0; i < USERS; i++) cookies.push(await signIn());
const report = {
	users: USERS,
	startedAt: new Date().toISOString(),
	memoryAtStartMb: memoryMb(),
	phases: {}
};

console.log('Phase 1: baseline (1 user, each scenario 3×)');
for (const scenario of SCENARIOS)
	for (let i = 0; i < 3; i++) await hit('baseline', scenario, cookies[0]);
report.phases.baseline = { rows: summarize('baseline') };
console.table(report.phases.baseline.rows);

console.log(`Phase 2: realistic (${USERS} users, 3–10 s think time, ${REALISTIC_S} s)`);
let memory = await runUsers('realistic', REALISTIC_S, [3000, 10000], cookies);
report.phases.realistic = {
	rows: summarize('realistic'),
	memoryMb: { max: Math.max(...memory), last: memory.at(-1) }
};
console.table(report.phases.realistic.rows);

console.log(`Phase 3: stress (${USERS} users, no think time, ${STRESS_S} s)`);
memory = await runUsers('stress', STRESS_S, null, cookies);
const stressCount = Object.values(results.stress ?? {}).flat().length;
report.phases.stress = {
	rows: summarize('stress'),
	throughputPerSecond: +(stressCount / STRESS_S).toFixed(2),
	memoryMb: { max: Math.max(...memory), last: memory.at(-1) }
};
console.table(report.phases.stress.rows);
console.log(
	'stress throughput req/s',
	report.phases.stress.throughputPerSecond,
	'memory MB',
	report.phases.stress.memoryMb
);

// Distinct root causes (the MySQL message under drizzle's 'Failed query' wrapper), with counts.
const causes = {};
for (const raw of serverLog.join('').split('\n')) {
	const line = raw.trim().slice(0, 200);
	if (/sqlMessage|^\[?cause|Error:|code: '/.test(line) && !/Failed query/.test(line))
		causes[line] = (causes[line] ?? 0) + 1;
}
report.serverErrorCauses = causes;
writeFileSync(OUT.replace(/\.json$/, '.server.log'), serverLog.join(''));
writeFileSync(OUT, JSON.stringify(report, null, 2));
console.log(`full results: ${OUT}`);
stop();
process.exit(0);
