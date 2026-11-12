// Fills the performance database with ~2 years of synthetic DIGAIPE activity.
//
//   node scripts/perf/with-perf-db.mjs npx tsx scripts/perf/seed.ts [--years 2] [--per-year 15000] [--views-per-day 60]
//
// Everything is fictional (generated names, random cédulas). Rows are inserted through the
// normal tables, so the audit triggers fire and the ledger grows the way it would in
// production; review and page-view audit events are appended through append_audit_event.
// Deterministic: the same arguments always produce the same data.
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';

const args = Object.fromEntries(
	process.argv
		.slice(2)
		.join(' ')
		.split('--')
		.filter(Boolean)
		.map((pair) => pair.trim().split(/\s+/) as [string, string])
);
const YEARS = Number(args.years ?? 2);
const PER_YEAR = Number(args['per-year'] ?? 15_000);
const VIEWS_PER_DAY = Number(args['views-per-day'] ?? 60);

const url = process.env.DATABASE_URL ?? '';
if (!/\/digaipe_perf(\?|$)/.test(url))
	throw new Error('Aborted: run through scripts/perf/with-perf-db.mjs (digaipe_perf only).');

// ── deterministic randomness ────────────────────────────────────────────────
let seed = 20261112;
const rand = () => {
	seed |= 0;
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

const SURNAMES = [
	'ROJAS',
	'PEÑA',
	'MÁRQUEZ',
	'SUÁREZ',
	'ARAUJO',
	'QUINTERO',
	'MOLINA',
	'RANGEL',
	'DÁVILA',
	'PAREDES',
	'URDANETA',
	'BRICEÑO',
	'GUERRERO',
	'MÉNDEZ',
	'ALBORNOZ',
	'SALCEDO',
	'TORRES',
	'VIELMA',
	'MONSALVE',
	'CARRERO',
	'OSORIO',
	'ZAMBRANO',
	'LOBO',
	'PERNÍA',
	'UZCÁTEGUI',
	'BALZA',
	'CEGARRA',
	'NAVA',
	'FERNÁNDEZ',
	'CONTRERAS'
];
const NAMES_F = [
	'MARÍA',
	'ANA',
	'LUISA',
	'CARMEN',
	'VALENTINA',
	'DANIELA',
	'GABRIELA',
	'ANDREA',
	'SOFÍA',
	'ISABEL',
	'PAOLA',
	'ROSA',
	'NATALIA',
	'ELENA',
	'VICTORIA'
];
const NAMES_M = [
	'JOSÉ',
	'LUIS',
	'CARLOS',
	'JUAN',
	'MIGUEL',
	'ANDRÉS',
	'DANIEL',
	'JESÚS',
	'GABRIEL',
	'DIEGO',
	'RAFAEL',
	'ÁNGEL',
	'SEBASTIÁN',
	'DAVID',
	'MANUEL'
];

const day = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const TODAY = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
const START = addDays(TODAY, -365 * YEARS);

const pool = mysql.createPool({ uri: url, connectionLimit: 6, multipleStatements: false });
const q = async <T = mysql.RowDataPacket[]>(sql: string, params: unknown[] = []) =>
	(await pool.query(sql, params))[0] as T;

async function insertMany(table: string, columns: string[], rows: unknown[][], chunk = 1000) {
	let firstId = 0;
	for (let i = 0; i < rows.length; i += chunk) {
		const slice = rows.slice(i, i + chunk);
		const result = await q<mysql.ResultSetHeader>(
			`INSERT INTO \`${table}\` (${columns.map((c) => `\`${c}\``).join(',')}) VALUES ?`,
			[slice]
		);
		if (i === 0) firstId = result.insertId;
	}
	return firstId;
}

async function appendAudit(
	conn: mysql.PoolConnection,
	e: {
		action: string;
		entityType: string;
		entityId: string;
		after?: unknown;
		metadata?: unknown;
		actor: Actor;
	}
) {
	// Must run inside a transaction: in autocommit mode the procedure's SELECT … FOR UPDATE on
	// audit_chain_state is released right after that statement, and concurrent appends collide.
	await conn.beginTransaction();
	await conn.query('CALL append_audit_event(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
		randomUUID(),
		'application',
		e.action,
		'success',
		e.actor.id,
		e.actor.name,
		e.actor.email,
		randomUUID(),
		'127.0.0.1',
		'perf-seed',
		e.entityType,
		e.entityId,
		'null',
		JSON.stringify(e.after ?? null),
		JSON.stringify(e.metadata ?? null)
	]);
	await conn.commit();
}

/** Runs audit appends on a few connections; the ledger lock serializes them anyway. */
async function appendAll(events: Parameters<typeof appendAudit>[1][], label: string) {
	let next = 0;
	const started = Date.now();
	await Promise.all(
		Array.from({ length: 4 }, async () => {
			const conn = await pool.getConnection();
			try {
				while (next < events.length) {
					const event = events[next++];
					await appendAudit(conn, event);
					if (next % 20_000 === 0) console.log(`  ${label}: ${next}/${events.length}`);
				}
			} finally {
				conn.release();
			}
		})
	);
	console.log(`  ${label}: ${events.length} in ${((Date.now() - started) / 1000).toFixed(0)} s`);
}

type Actor = { id: string; name: string; email: string };

async function main() {
	const [existing] = await q('SELECT COUNT(*) n FROM admissions');
	if (Number(existing.n) > 0)
		throw new Error('digaipe_perf already has admissions; drop it to reseed.');

	const [admin] = await q("SELECT id, name, email FROM user WHERE role = 'admin' LIMIT 1");
	const actors: Actor[] = [{ id: admin.id, name: admin.name, email: admin.email }];
	const careers = await q('SELECT id, clave FROM careers');
	const modalities = await q('SELECT id FROM admission_modalities');
	const ocres = await q('SELECT id FROM ocre_types');
	console.log(`Seeding ${YEARS} year(s), ${PER_YEAR}/year, from ${day(START)} to ${day(TODAY)}`);

	// ── processes: per year, two periods (A, U) × 4 assignment rounds, ~3 weeks active ──
	type Proc = { id: number; period: string; year: number; start: Date; days: Date[] };
	const procs: Proc[] = [];
	for (let y = 0; y < YEARS; y++) {
		for (const [p, period] of ['A', 'U'].entries()) {
			for (let round = 0; round < 4; round++) {
				const start = addDays(START, y * 365 + p * 182 + round * 40 + 5);
				if (start >= TODAY) continue;
				const year = start.getUTCFullYear();
				const code = `UP${String(procs.length + 1).padStart(3, '0')}${period}${year}`;
				const [res] = await pool.query<mysql.ResultSetHeader>(
					'INSERT INTO admission_processes (num_asignacion, is_enabled) VALUES (?, true)',
					[code]
				);
				const days = Array.from({ length: 21 }, (_, i) => addDays(start, i)).filter(
					(d) => d <= TODAY
				);
				await insertMany(
					'ap_active_dates',
					['code_id', 'active_date'],
					days.map((d) => [res.insertId, day(d)])
				);
				procs.push({ id: res.insertId, period: `${period}${year}`, year, start, days });
			}
		}
	}
	console.log(`  processes: ${procs.length}`);

	// ── students & admissions ──
	const perProc = Math.round((PER_YEAR * YEARS) / procs.length);
	const cedulas = new Set<string>();
	const studentRows: unknown[][] = [];
	const newStudent = () => {
		let cedula: string;
		do {
			const foreign = rand() < 0.02;
			cedula = foreign ? `E0${int(80_000_000, 89_999_999)}` : `V0${int(25_000_000, 34_999_999)}`;
			if (rand() < 0.06) cedula = cedula.replace(/^(.)0/, '$1'); // some legacy unpadded
		} while (cedulas.has(cedula));
		cedulas.add(cedula);
		const female = rand() < 0.56;
		const name = `${pick(SURNAMES)} ${pick(SURNAMES)} ${pick(female ? NAMES_F : NAMES_M)} ${pick(female ? NAMES_F : NAMES_M)}`;
		studentRows.push([
			cedula,
			name,
			`0414${int(1_000_000, 9_999_999)}`,
			`est${cedulas.size}@ejemplo.test`,
			female ? 'F' : 'M'
		]);
		return studentRows.length - 1; // index → id after insert
	};

	type Adm = {
		studentIdx: number;
		career: mysql.RowDataPacket;
		proc: Proc;
		assigned: Date;
		stage: number;
	};
	const adms: Adm[] = [];
	const studentsByProcYear = new Map<number, number[]>();
	for (const proc of procs) {
		for (let i = 0; i < perProc; i++) {
			// ~8% are reassignments of a student already assigned that year
			const pool = studentsByProcYear.get(proc.year) ?? [];
			const reassigned = pool.length > 50 && rand() < 0.08;
			const studentIdx = reassigned ? pick(pool) : newStudent();
			if (!reassigned) pool.push(studentIdx);
			studentsByProcYear.set(proc.year, pool);
			adms.push({
				studentIdx,
				career: pick(careers),
				proc,
				assigned: pick(proc.days.slice(0, 7)),
				stage: reassigned ? 2 : 1
			});
		}
	}
	let t = Date.now();
	const firstStudentId = await insertMany(
		'students',
		['cedula', 'apellidos_nombres', 'telefono', 'correo', 'genero'],
		studentRows
	);
	console.log(`  students: ${studentRows.length} in ${((Date.now() - t) / 1000).toFixed(0)} s`);

	// unique (student, career, process): drop accidental duplicates
	const seen = new Set<string>();
	const uniqueAdms = adms.filter((a) => {
		const key = `${a.studentIdx}|${a.career.id}|${a.proc.id}`;
		return !seen.has(key) && seen.add(key);
	});
	t = Date.now();
	const firstAdmissionId = await insertMany(
		'admissions',
		[
			'student_id',
			'career_id',
			'proceso_id',
			'modality_id',
			'opcion',
			'ocre_type_id',
			'periodo_ingreso',
			'fecha_asignacion',
			'ano',
			'proceso'
		],
		uniqueAdms.map((a) => [
			firstStudentId + a.studentIdx,
			a.career.id,
			a.proc.id,
			pick(modalities).id,
			a.career.clave,
			pick(ocres).id,
			a.proc.period,
			day(a.assigned),
			a.proc.year,
			a.stage
		])
	);
	console.log(`  admissions: ${uniqueAdms.length} in ${((Date.now() - t) / 1000).toFixed(0)} s`);

	// ── processings: ~85% show up; status depends on age; ~15% were returned at some point ──
	const processingRows: unknown[][] = [];
	const reviewEvents: Parameters<typeof appendAudit>[1][] = [];
	type Pending = { idx: number; everReturned: boolean; status: string };
	const pending: Pending[] = [];
	uniqueAdms.forEach((a, i) => {
		if (rand() > 0.85) return;
		const processed = addDays(a.assigned, int(0, 14));
		if (processed > TODAY) return;
		const age = (TODAY.getTime() - processed.getTime()) / 86_400_000;
		const everReturned = rand() < 0.15;
		let status: string;
		if (age < 3) status = 'pendiente';
		else if (everReturned)
			status = rand() < 0.6 ? 'matriculado' : rand() < 0.5 ? 'devuelto' : 'pendiente';
		else status = rand() < 0.95 ? 'matriculado' : 'pendiente';
		const reviewed = status !== 'pendiente' || everReturned;
		processingRows.push([
			firstAdmissionId + i,
			day(processed),
			admin.id,
			status,
			reviewed ? `${day(addDays(processed, int(0, 5)))} 10:00:00.000` : null,
			reviewed ? admin.id : null,
			status === 'devuelto' ? 'Documento ilegible (dato sintético)' : null
		]);
		pending.push({ idx: processingRows.length - 1, everReturned, status });
	});
	t = Date.now();
	const firstProcessingId = await insertMany(
		'admission_processings',
		[
			'admission_id',
			'processing_date',
			'generated_by_user_id',
			'status',
			'reviewed_at',
			'reviewed_by_user_id',
			'return_reason'
		],
		processingRows
	);
	console.log(
		`  processings: ${processingRows.length} in ${((Date.now() - t) / 1000).toFixed(0)} s`
	);
	for (const p of pending) {
		const entityId = String(firstProcessingId + p.idx);
		const base = {
			action: 'admission_document.reviewed',
			entityType: 'admission_processing',
			entityId,
			actor: actors[0]
		};
		if (p.everReturned) reviewEvents.push({ ...base, after: { status: 'devuelto' } });
		if (p.status !== 'pendiente' && !(p.everReturned && p.status === 'devuelto'))
			reviewEvents.push({ ...base, after: { status: p.status } });
	}
	await appendAll(reviewEvents, 'review events');

	// ── page-view history: what 5 users viewing student data for 2 years leaves in the ledger ──
	const pages = [
		'/digaipe/estadisticas',
		'/digaipe/admisiones',
		'/digaipe/revision-documentos',
		'/digaipe/generacion-planilla'
	];
	const workDays = Math.round(YEARS * 240);
	const totalAdm = uniqueAdms.length;
	const views: Parameters<typeof appendAudit>[1][] = [];
	for (let d = 0; d < workDays * VIEWS_PER_DAY; d++) {
		const page = pick(pages);
		const resultCount = page === '/digaipe/estadisticas' ? int(50, 8000) : int(1, 50);
		const shown = Math.min(resultCount, 500);
		const start = int(0, Math.max(0, totalAdm - shown));
		views.push({
			action: 'student_data.viewed',
			entityType: 'page',
			entityId: page,
			actor: actors[0],
			metadata: {
				recordType: 'admission',
				resultCount,
				recordIds: Array.from({ length: shown }, (_, k) => firstAdmissionId + start + k),
				recordIdsTruncated: resultCount > 500,
				filters: {},
				searchHash: null
			}
		});
	}
	await appendAll(views, 'view events');

	const sizes = await q(
		`SELECT table_name t, table_rows n, ROUND((data_length + index_length) / 1048576) mb
		 FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY data_length + index_length DESC LIMIT 8`
	);
	console.table(sizes);
	await pool.end();
}

main().catch(async (error) => {
	console.error(error);
	await pool.end();
	process.exit(1);
});
