import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import * as XLSX from 'xlsx';

// Every person/file in this gallery is fictitious. The caller supplies a disposable database.
// The optional real-structure scenario reads the UA136-26 spreadsheet only for its shape
// (modalities, dates, which rows are alternatives); names, cédulas, phones and e-mails are
// replaced before anything is uploaded or rendered.
const REAL_STRUCTURE_XLSX = 'UA136-26 Lista de Admitidos Nutricion U2026.xlsx';

export async function captureAdmissionsEvidence(page, base, owner) {
	const root = path.resolve('artifacts/admission-review');
	await mkdir(root, { recursive: true });
	const images = [];

	// Banner + numbered red boxes drawn into the page itself, removed right after the capture.
	async function annotate(target, title, kind, marks) {
		await target.evaluate(
			({ title, kind }) => {
				const b = document.createElement('div');
				b.dataset.annot = '1';
				b.style.cssText = `display:block;font:600 18px/1.35 system-ui,sans-serif;padding:14px 20px;color:#fff;background:${kind === 'error' ? '#b42318' : '#067647'};letter-spacing:.01em`;
				// Title via ::before so text locators for the marks can never match the banner itself.
				b.dataset.title = `${kind === 'error' ? '✖ ERROR DETECTADO' : '✔ FUNCIONA'} — ${title}`;
				const style = document.createElement('style');
				style.dataset.annot = '1';
				style.textContent = '[data-annot][data-title]::before{content:attr(data-title)}';
				document.head.appendChild(style);
				document.body.prepend(b);
			},
			{ title, kind }
		);
		let n = 0;
		const notes = [];
		for (const mark of marks) {
			const count = Math.min(await mark.locator.count(), mark.max ?? 4);
			if (!count && mark.optional) { console.log(`  (annotation skipped, not on page: ${mark.note})`); continue; }
			assert.ok(count > 0, `Annotation target not found: ${mark.note}`);
			const number = ++n;
			notes.push(`${number}. ${mark.note}`);
			for (let i = 0; i < count; i++) {
				const box = await mark.locator.nth(i).boundingBox();
				if (!box) continue;
				await target.evaluate(
					({ box, label }) => {
						const x = box.x + scrollX, y = box.y + scrollY;
						const frame = document.createElement('div');
						frame.dataset.annot = '1';
						frame.style.cssText = `position:absolute;left:${x - 4}px;top:${y - 4}px;width:${box.width + 8}px;height:${box.height + 8}px;border:3px solid #e11d48;border-radius:6px;box-shadow:0 0 0 4px rgba(225,29,72,.2);pointer-events:none;z-index:2147483646`;
						document.documentElement.appendChild(frame);
						if (!label) return;
						const tag = document.createElement('div');
						tag.dataset.annot = '1';
						tag.textContent = label;
						tag.style.cssText = `position:absolute;left:${Math.max(0, x - 4)}px;top:${Math.max(0, y - 34)}px;max-width:620px;background:#e11d48;color:#fff;font:600 13px/1.3 system-ui,sans-serif;padding:5px 9px;border-radius:5px;z-index:2147483647;pointer-events:none`;
						document.documentElement.appendChild(tag);
						// Labels go above their box; if that hides an earlier label or box, put it below.
						const placed = (window.__annotPlaced ??= []);
						const hits = (r) => placed.some((o) => r.left < o.right && r.right > o.left && r.top < o.bottom && r.bottom > o.top);
						if (hits(tag.getBoundingClientRect())) tag.style.top = `${y + box.height + 8}px`;
						placed.push(tag.getBoundingClientRect(), frame.getBoundingClientRect());
					},
					{ box, label: i === 0 ? `${number}. ${mark.note}` : '' }
				);
			}
		}
		return notes;
	}
	const capture = async (name, title, target = page, { kind = 'ok', marks = [] } = {}) => {
		const notes = await annotate(target, title, kind, marks);
		await target.screenshot({ path: path.join(root, `${name}.png`), fullPage: true, animations: 'disabled' });
		await target.evaluate(() => { document.querySelectorAll('[data-annot]').forEach((e) => e.remove()); window.__annotPlaced = []; });
		images.push({ name, title, kind, notes });
	};
	const visible = (locator) => locator.filter({ visible: true });
	const text = (target, pattern) => visible(target.getByText(pattern));
	const row = (target, pattern) => visible(target.locator('tr').filter({ hasText: pattern }));
	const visit = async (url, target = page) => {
		await target.goto(`${base}${url}`);
		await target.waitForLoadState('networkidle');
	};
	const raw = {
		Num_Asignacion: 'UA999/01-01-26',
		Ced_estudiante: 'V000000020',
		Apel_Nom: 'ESTUDIANTE DEMOSTRACION',
		Telefono: '04120000000',
		Correo_e: 'demo@example.invalid',
		Sex: 'F',
		Periodo_ingreso: 'A2026',
		Fecha_asignacion: '01/01/2026',
		Opcion: '0001',
		Moda_Ingre: 'AR',
		Cod_Ocre: 'ADM',
		Ano: 2026,
		Proceso: 1
	};
	const sheet = (rows) => {
		const book = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Admisiones');
		return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
	};
	const upload = async (rows) => {
		await visit('/digaipe/admisiones/cargar');
		await page.locator('[name=sourceFile]').setInputFiles({
			name: 'datos-ficticios.xlsx',
			mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			buffer: sheet(rows)
		});
		for (const name of ['estadisticaFile', 'manifestFile'])
			await page.locator(`[name=${name}]`).setInputFiles({
				name: `${name}.pdf`,
				mimeType: 'application/pdf',
				buffer: Buffer.from('%PDF-1.4\n')
			});
		await page.getByRole('button', { name: 'Previsualizar', exact: true }).click();
		await page.waitForLoadState('networkidle');
	};
	const saveButton = () => page.getByRole('button', { name: 'Guardar admisiones', exact: true });
	const today = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Caracas',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date());

	// ── 00: the real file's structure, anonymized ──
	if (existsSync(REAL_STRUCTURE_XLSX)) {
		await owner.query(
			"INSERT INTO careers (programa_academico,ofae,facultad,nucleo) SELECT 'NUTRICION Y DIETETICA','MN','MEDICINA','M' WHERE NOT EXISTS (SELECT 1 FROM careers WHERE ofae='MN')"
		);
		for (const [code, name] of [['PS', 'IPES: PRUEBA DE HABILIDADES ESPECIFICAS'], ['OPS', 'OPSU'], ['ATL', 'ATLETA'], ['COP', 'CAMBIO DE OPCION']])
			await owner.query(
				'INSERT INTO admission_modalities (codigo_admission,nombre) SELECT ?,? WHERE NOT EXISTS (SELECT 1 FROM admission_modalities WHERE codigo_admission=?)',
				[code, name, code]
			);
		const [proc] = await owner.query("INSERT INTO admission_processes (num_asignacion,is_enabled) VALUES ('UA136/26-11-09',1)");
		await owner.query('INSERT INTO ap_active_dates (code_id,active_date) VALUES (?,?)', [proc.insertId, today]);
		const book = XLSX.read(await readFile(REAL_STRUCTURE_XLSX), { type: 'buffer', cellDates: true });
		const source = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: '' });
		const fake = new Map();
		const anonymized = source.map((r) => {
			const key = String(r.Ced_estudiante).toUpperCase().replace(/[^VE0-9]/g, '');
			if (!fake.has(key)) fake.set(key, fake.size + 1);
			const i = fake.get(key);
			return { ...r, Ced_estudiante: `V088${String(i).padStart(6, '0')}`, Apel_Nom: `ESTUDIANTE FICTICIO ${String(i).padStart(3, '0')}`,
				Telefono: '04140000000', Correo_e: `ficticio${i}@example.invalid` };
		});
		assert.equal(anonymized.length, 112);
		assert.equal(fake.size, 110);
		await upload(anonymized);
		assert.match(await page.locator('body').innerText(), /112 filas/);
		assert.equal(await row(page, /varias modalidades/).count(), 4);
		await capture('00a-archivo-real-anonimizado-vista-previa',
			'Archivo UA136-26 (112 filas, datos personales sustituidos): 0 errores, solo las 4 filas alternativas advertidas', page, {
				marks: [
					{ locator: text(page, /112 filas/), note: '112 filas leídas, 0 errores' },
					{ locator: row(page, /varias modalidades/), note: '4 advertencias: 2 estudiantes con 2 modalidades cada uno (filas 11+107 y 16+80)', max: 4 },
					{ locator: saveButton(), note: 'Sin errores: el lote se puede guardar' }
				]
			});
		await saveButton().click();
		await page.waitForLoadState('networkidle');
		assert.match(await page.locator('body').innerText(), /Se guardaron 112 admisiones/);
		await capture('00b-archivo-real-anonimizado-guardado', 'Las 112 ofertas se guardan para 110 estudiantes', page, {
			marks: [{ locator: text(page, /Se guardaron 112 admisiones/), note: '112 insertadas, 0 omitidas' }]
		});
		await visit('/digaipe/admisiones?process=UA136%2F26-11-09');
		await capture('00c-archivo-real-anonimizado-listado', 'Listado: las ofertas alternativas quedan marcadas y pendientes', page, {
			marks: [
				{ locator: text(page, /2 modalidades alternativas/), note: 'Marcadas como alternativas de la misma asignación', max: 4 },
				{ locator: text(page, /Sin trámite registrado/).first(), note: 'Resultado: Pendiente, sin trámite todavía', optional: true }
			]
		});
	}

	// ── 01–04: alternatives and identity ──
	await upload([
		raw,
		{ ...raw, Ced_estudiante: 'v-000000020', Moda_Ingre: 'CV', Apel_Nom: 'NOMBRE DIFERENTE EN ARCHIVO' }
	]);
	assert.match(await page.locator('body').innerText(), /varias modalidades/);
	assert.match(await page.locator('body').innerText(), /datos personales difieren/);
	await capture('01-alternativas-advertencias', 'Carga válida: modalidades alternativas y advertencia de datos personales distintos', page, {
		marks: [
			{ locator: row(page, /varias modalidades/), note: '"v-000000020" se reconoce como V000000020: misma persona, dos modalidades', max: 2 },
			{ locator: row(page, /datos personales difieren/), note: 'Nombre distinto en el archivo: se advierte, no se sobrescribe' },
			{ locator: saveButton(), note: 'Son advertencias, no errores: se puede guardar' }
		]
	});
	await saveButton().click();
	await page.waitForLoadState('networkidle');
	assert.match(await page.locator('body').innerText(), /Se guardaron 2 admisiones/);
	await capture('02-carga-guardada', 'Dos modalidades guardadas para un solo estudiante', page, {
		marks: [{ locator: text(page, /Se guardaron 2 admisiones/), note: 'AR y CV guardadas' }]
	});
	await upload([
		{ ...raw, Ced_estudiante: 'V 000000020', Moda_Ingre: 'EX', Apel_Nom: 'OTRO NOMBRE', Telefono: '09999999999', Correo_e: 'otro@example.invalid' }
	]);
	assert.match(await page.locator('body').innerText(), /Se conservarán los datos originales/);
	await capture('03-perfil-protegido-advertencia', 'Modalidad adicional: se advierte que el perfil existente se conservará', page, {
		marks: [
			{ locator: row(page, /Se conservarán los datos originales/), note: '"V 000000020" con otro nombre/teléfono/correo: se conserva el perfil original' },
			{ locator: row(page, /Ya existe otra modalidad/), note: 'Tercera modalidad (EX) para la misma asignación', optional: true }
		]
	});
	await saveButton().click();
	await page.waitForLoadState('networkidle');
	const [[student]] = await owner.query("SELECT * FROM students WHERE identity_key='V000000020'");
	assert.equal(student.apellidos_nombres, raw.Apel_Nom);
	assert.equal(student.telefono, raw.Telefono);
	assert.equal(student.correo, raw.Correo_e);
	const [[studentCount]] = await owner.query("SELECT COUNT(*) n FROM students WHERE identity_key='V000000020'");
	assert.equal(studentCount.n, 1);
	await visit('/digaipe/admisiones?process=UA999%2F01-01-26&search=V000000020');
	assert.match(await page.locator('table').innerText(), /ESTUDIANTE DEMOSTRACION/);
	assert.doesNotMatch(await page.locator('table').innerText(), /OTRO NOMBRE/);
	await capture('04-perfil-original-conservado', 'Tres modalidades, una identidad y los datos personales originales intactos', page, {
		marks: [
			{ locator: row(page, /ESTUDIANTE DEMOSTRACION/), note: '3 filas (AR, CV, EX), un solo estudiante, nombre original', max: 3 },
			{ locator: text(page, /3 modalidades alternativas/), note: 'Cada fila indica las 3 alternativas', max: 3, optional: true }
		]
	});

	// ── 05–07: upload errors ──
	for (const [name, title, rows, expected, note] of [
		['05-error-duplicado', 'Error: la misma modalidad repetida en el archivo impide guardar',
			[raw, { ...raw, Ced_estudiante: 'V-000000020' }], /duplicada dentro del archivo/,
			'"V-000000020" = V000000020 con la misma modalidad AR: duplicado'],
		['06-error-cedula', 'Error: una cédula con letras dentro del número se rechaza',
			[{ ...raw, Ced_estudiante: 'V12X34' }], /Cédula inválida/, '"V12X34" no es una cédula válida'],
		['07-error-conflicto', 'Error: una admisión existente con otro período no se sobrescribe',
			[{ ...raw, Periodo_ingreso: 'B2026' }], /datos distintos/, 'Período B2026 ≠ A2026 guardado: no se sobrescribe']
	]) {
		await upload(rows);
		assert.match(await page.locator('body').innerText(), expected);
		assert.equal(await saveButton().count(), 0);
		await capture(name, title, page, {
			kind: 'error',
			marks: [
				{ locator: row(page, expected), note },
				{ locator: text(page, /Corrija los errores/), note: 'No aparece "Guardar admisiones": el lote no se puede guardar' }
			]
		});
	}

	// ── 08–09: planilla numbers and unique references ──
	const [offers] = await owner.query(
		'SELECT a.id,m.codigo_admission modality,m.nombre modalityName FROM admissions a JOIN admission_modalities m ON m.id=a.modality_id WHERE a.student_id=? AND a.proceso_id=2 ORDER BY a.id',
		[student.id]
	);
	const primary = offers.find((r) => r.modality === 'AR');
	const alternative = offers.find((r) => r.modality === 'CV');
	const numbers = [];
	for (const [offer, name] of [[primary, '08-planilla-ar'], [alternative, '09-planilla-convenio']]) {
		await visit(`/digaipe/generacion-planilla/${offer.id}`);
		numbers.push(await page.locator('#planilla').inputValue());
		assert.equal(await page.locator('#admission-reference').inputValue(), `ADM-${offer.id}`);
		await capture(name, `Número de planilla conservado y referencia única ADM-${offer.id} (${offer.modality})`, page, {
			marks: [
				{ locator: page.locator('#planilla'), note: 'Número de planilla legado: igual en ambas modalidades' },
				{ locator: page.locator('#admission-reference'), note: `Referencia única ADM-${offer.id} distingue la modalidad ${offer.modality}` },
				{ locator: text(page, /modalidades para esta carrera/), note: 'Aviso: el estudiante tiene alternativas', optional: true }
			]
		});
		const response = await page.request.post(`${base}/digaipe/generacion-planilla/${offer.id}/pdf`, {
			form: { confirmado: 'on' },
			headers: { origin: base }
		});
		assert.equal(response.status(), 200);
		const pdfPath = path.join(root, `${name}.pdf`);
		const pngPath = path.join(root, `${name}-pdf.png`);
		await writeFile(pdfPath, await response.body());
		const render = spawnSync('python', ['-c', `
import fitz, sys
d = fitz.open(sys.argv[1]); p = d[0]
ref, number, modality = sys.argv[3], sys.argv[4], sys.argv[5]
assert ref in p.get_text()
red = (0.88, 0.11, 0.28)
def mark(needle, label, below=False):
    hits = p.search_for(needle)
    for i, r in enumerate(hits[:2]):
        p.draw_rect(fitz.Rect(r.x0-3, r.y0-3, r.x1+3, r.y1+3), color=red, width=1.8)
        if i == 0:
            spot = fitz.Rect(r.x0, r.y1+4, r.x0+260, r.y1+14) if below else fitz.Rect(r.x0, r.y0-14, r.x0+260, r.y0-4)
            p.draw_rect(spot, color=None, fill=(1, 1, 1))
            p.insert_text((spot.x0+1, spot.y1-2), label, fontsize=7.5, color=red)
    return bool(hits)
assert mark(ref, '1. Referencia unica de la modalidad')
mark(number.strip(), '2. Numero de planilla legado (igual en ambas)', below=True)
mark(modality, '3. Modalidad impresa', below=True)
w, h = p.rect.width, p.rect.height
p.draw_rect(fitz.Rect(w-250, h-22, w-8, h-6), color=None, fill=(0.02, 0.46, 0.28))
p.insert_text((w-244, h-10), 'FUNCIONA - PDF real generado: ' + ref, fontsize=8.5, color=(1, 1, 1))
p.get_pixmap(matrix=fitz.Matrix(1.6, 1.6)).save(sys.argv[2])
`, pdfPath, pngPath, `ADM-${offer.id}`, numbers.at(-1), offer.modalityName], { encoding: 'utf8', windowsHide: true });
		assert.equal(render.status, 0, render.stderr);
		images.push({
			name: `${name}-pdf`,
			title: `PDF real: referencia ADM-${offer.id} y modalidad ${offer.modality}`,
			kind: 'ok',
			notes: ['1. Referencia única impresa al pie', '2. Número de planilla legado', '3. Modalidad']
		});
	}
	assert.equal(numbers[0], numbers[1]);

	// ── 10–12: review ──
	const [processings] = await owner.query('SELECT id,admission_id FROM admission_processings WHERE admission_id IN (?,?)', [primary.id, alternative.id]);
	const primaryProcessing = processings.find((p) => p.admission_id === primary.id).id;
	const otherProcessing = processings.find((p) => p.admission_id === alternative.id).id;
	const reviewUrl = `/digaipe/revision-documentos?dateFrom=${today}&dateTo=${today}&process=UA999%2F01-01-26&search=V000000020`;
	const checkbox = (target, id) => target.locator(`[name=processingId][value="${id}"]`);
	await visit(reviewUrl);
	await checkbox(page, primaryProcessing).check();
	await checkbox(page, otherProcessing).check();
	await page.getByRole('button', { name: 'Guardar decisión', exact: true }).click();
	await page.getByText('Seleccione solo una modalidad por estudiante, carrera y proceso.', { exact: true }).waitFor();
	await capture('10-error-doble-matricula', 'Error: no se pueden matricular dos modalidades del mismo estudiante en un lote', page, {
		kind: 'error',
		marks: [
			{ locator: text(page, 'Seleccione solo una modalidad por estudiante, carrera y proceso.'), note: 'Rechazado: dos modalidades en el mismo lote; no se guardó nada' },
			{ locator: row(page, /ESTUDIANTE DEMOSTRACION/), note: 'Las dos ofertas siguen Pendientes', max: 3 }
		]
	});
	// Two real browser pages retain their own selections; the second submits stale state.
	const stale = await page.context().newPage();
	await visit(reviewUrl, stale);
	await checkbox(stale, otherProcessing).check();
	await visit(reviewUrl);
	await checkbox(page, primaryProcessing).check();
	await page.getByRole('button', { name: 'Guardar decisión', exact: true }).click();
	await page.getByText('1 admisión(es) actualizada(s).', { exact: true }).waitFor();
	await capture('11-matricula-seleccionada', 'Matrícula exitosa: Alto rendimiento seleccionado y Convenio excluido', page, {
		marks: [
			{ locator: text(page, '1 admisión(es) actualizada(s).'), note: 'Revisor 1 matricula AR' },
			{ locator: row(page, /ESTUDIANTE DEMOSTRACION/), note: 'AR matriculado; CV y EX pasan a "No matriculado — otra modalidad"', max: 3 }
		]
	});
	await stale.getByRole('button', { name: 'Guardar decisión', exact: true }).click();
	await stale.getByText(/Ya existe una matrícula para este estudiante/).waitFor();
	await capture('12-error-revisor-desactualizado', 'Error: un segundo revisor con una pantalla anterior no puede crear otra matrícula', stale, {
		kind: 'error',
		marks: [{ locator: text(stale, /Ya existe una matrícula para este estudiante/), note: 'Revisor 2 (pantalla abierta antes) intenta matricular CV: rechazado' }]
	});
	await stale.close();

	// ── 13–14: outcomes and statistics ──
	await visit('/digaipe/admisiones?process=UA999%2F01-01-26&search=V000000020&outcome=no_matriculado');
	assert.match(await page.locator('table').innerText(), /Otra modalidad seleccionada/);
	await capture('13-alternativa-sin-planilla-excluida', 'Alternativas excluidas: incluye la modalidad EX que nunca generó planilla', page, {
		marks: [
			{ locator: page.locator('#outcome'), note: 'Filtro Resultado = No matriculado' },
			{ locator: row(page, /Otra modalidad seleccionada/), note: 'CV (con planilla) y EX (sin planilla) excluidas por la matrícula en AR', max: 3 }
		]
	});
	await visit('/digaipe/estadisticas?reportMode=reconciliacion&dateBasis=asignacion&dateFrom=2026-01-01&dateTo=2026-12-31&filter_process=CONCILIACION-111&matrixDimension=modalidad');
	const funnel = page.locator('table').filter({ has: page.locator('caption', { hasText: 'Etapas del embudo' }) });
	assert.match(await funnel.innerText(), /Asignados\s+111/i);
	assert.match(await funnel.innerText(), /Ofertas[^\n]*\s+122/i);
	await capture('14-conciliacion-corregida', 'Conciliación corregida: 111 asignaciones, 122 ofertas, 107 sin trámite y tasas por asignación', page, {
		marks: [
			{ locator: funnel.locator('tr').filter({ hasText: /Asignados/i }).first(), note: 'Asignados = 111 asignaciones (no 122)' },
			{ locator: funnel.locator('tr').filter({ hasText: /Ofertas/i }).first(), note: 'Ofertas por modalidad = 122, mostradas aparte' }
		]
	});

	const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
	await writeFile(
		path.join(root, 'index.html'),
		`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admisiones: evidencia</title><style>body{font:16px system-ui;background:#edf1f7;color:#172b4d;max-width:1450px;margin:2rem auto;padding:0 1rem}article{background:#fff;padding:1rem;margin:1.5rem 0;border-radius:10px}img{display:block;max-width:100%;height:auto;border:1px solid #ddd}.ok{color:#067647}.error{color:#b42318}ol{margin:.25rem 0 1rem}</style><h1>Admisiones: casos exitosos y errores</h1><p>Datos ficticios, base de pruebas desechable. Capturas reales de Chrome y de los PDF generados. ${new Date().toISOString()}.</p>${images.map((e) => `<article><h2 class="${e.kind}">${e.kind === 'error' ? '✖' : '✔'} ${esc(e.title)}</h2><ol>${e.notes.map((n) => `<li>${esc(n.replace(/^\d+\.\s*/, ''))}</li>`).join('')}</ol><a href="${e.name}.png"><img src="${e.name}.png" loading="lazy" alt="${esc(e.title)}"></a></article>`).join('')}</html>`
	);
	await writeFile(path.join(root, 'manifest.json'), JSON.stringify(images, null, 2));
	console.log(`PASS: ${images.length} annotated screenshots and gallery saved in artifacts/admission-review/index.html.`);
}
