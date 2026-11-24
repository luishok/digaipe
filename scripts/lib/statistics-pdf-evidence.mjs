import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Uses the authenticated test browser and the fictitious 111-assignment/122-offer fixture.
export async function captureStatisticsPdfs(page, base, owner) {
	const root = path.resolve('artifacts/statistics-review');
	await mkdir(root, { recursive: true });
	const reports = [],
		screens = [];
	const visit = async (url) => {
		await page.goto(`${base}${url}`);
		await page.waitForLoadState('networkidle');
	};
	const screenshot = async (name, title) => {
		await page.screenshot({ path: path.join(root, `${name}.png`), animations: 'disabled' });
		screens.push({ name, title });
	};
	async function exportPdf(name, title, url, expected) {
		const response = await page.request.get(`${base}${url}`);
		assert.equal(response.status(), 200, `${name}: download failed`);
		assert.match(response.headers()['content-type'], /application\/pdf/);
		const file = path.join(root, `${name}.pdf`);
		await writeFile(file, await response.body());
		const inspect = spawnSync('python', ['scripts/lib/inspect-statistics-pdf.py', file], {
			encoding: 'utf8',
			windowsHide: true
		});
		assert.equal(inspect.status, 0, inspect.stderr);
		const extracted = JSON.parse(inspect.stdout);
		const flat = extracted.text.replace(/\s+/g, ' ');
		for (const value of expected) assert.ok(flat.includes(value), `${name}: missing ${value}`);
		reports.push({ name, title, pages: extracted.pages, checked: expected });
		return extracted;
	}
	const common = new URLSearchParams({
		filter_process: 'CONCILIACION-111',
		dateFrom: '2026-01-01',
		dateTo: '2026-12-31',
		includeStudentData: 'on'
	});
	await exportPdf(
		'01-general',
		'General: 111 asignaciones y 122 ofertas',
		`/digaipe/estadisticas/pdf?${common}&reportMode=general&dateBasis=asignacion`,
		['Total de asignaciones: 111', 'Ofertas: 122', 'Estudiantes únicos: 111']
	);
	await exportPdf(
		'02-consolidado',
		'Consolidado: 4 asignaciones procesadas',
		`/digaipe/estadisticas/pdf?${common}&reportMode=consolidado&dateBasis=digaipe`,
		['Total de asignaciones: 4', 'matriculado', 'pendiente', 'devuelto', 'TOTAL GENERAL']
	);
	await exportPdf(
		'03-estadisticas',
		'Estadísticas: 2 matriculados, 1 pendiente y 1 devuelto',
		`/digaipe/estadisticas/pdf?${common}&reportMode=estadisticas&dateBasis=digaipe`,
		['Total de asignaciones: 4', 'Asignaciones procesadas', '50.0%', '25.0%']
	);
	await exportPdf(
		'04-conciliacion',
		'Conciliación: 111 asignaciones, 122 ofertas y 107 sin trámite',
		`/digaipe/estadisticas/pdf?${common}&reportMode=reconciliacion&dateBasis=asignacion&matrixDimension=modalidad`,
		['111 asignaciones y 122 ofertas', '107', '1.8%', '96.4%', '50.0%']
	);
	await exportPdf(
		'05-matricula-antes-cierre',
		'Antes del cierre: 2 matriculados y 109 pendientes',
		'/digaipe/estadisticas/pdf?reportMode=matricula&filter_process=CONCILIACION-111&includeStudentData=on',
		[
			'Asignados: 111',
			'Matriculados: 2',
			'No matriculados: 0',
			'Pendientes: 109',
			'Resultado provisional'
		]
	);

	// Give this test process a past active date, then close it through the actual office UI.
	await owner.query("INSERT INTO ap_active_dates (code_id,active_date) VALUES (4,'2026-01-01')");
	await page.setViewportSize({ width: 1900, height: 1100 });
	await visit('/digaipe/procesos-adm');
	const processRow = page.locator('tbody tr').filter({ hasText: 'CONCILIACION-111' });
	assert.match(await processRow.innerText(), /pendiente de cierre/);
	await processRow
		.locator('form[action="?/close"] [name=reason]')
		.fill('CIERRE DEMOSTRACION: REVISION DE 111 ASIGNACIONES');
	await processRow
		.getByRole('button', { name: 'Cerrar proceso', exact: true })
		.scrollIntoViewIfNeeded();
	await screenshot(
		'06-proceso-antes-cierre',
		'Paso 1: plazo finalizado, motivo completado y botón Cerrar proceso'
	);
	let confirmation = '';
	page.once('dialog', async (dialog) => {
		confirmation = dialog.message();
		await dialog.accept();
	});
	await processRow.getByRole('button', { name: 'Cerrar proceso', exact: true }).click();
	await processRow.getByRole('button', { name: 'Reabrir proceso', exact: true }).waitFor();
	assert.match(confirmation, /No matriculado/);
	assert.match(await processRow.innerText(), /Cerrado el/);
	assert.match(await processRow.innerText(), /Informe oficial v1/);
	await screenshot('07-proceso-cerrado', 'Paso 2: proceso cerrado e informe oficial v1 disponible');
	const [[closure]] = await owner.query(
		'SELECT * FROM admission_process_closures WHERE proceso_id=4 AND version=1'
	);
	assert.deepEqual(closure.report.totals, {
		assigned: 111,
		offers: 122,
		matriculado: 2,
		no_matriculado: 109,
		pendiente: 0
	});
	const reasons = Object.fromEntries(
		['Sin trámite registrado', 'Trámite incompleto', 'Documentación devuelta'].map((reason) => [
			reason,
			closure.report.rows.filter((r) => r.reason === reason).length
		])
	);
	assert.deepEqual(reasons, {
		'Sin trámite registrado': 107,
		'Trámite incompleto': 1,
		'Documentación devuelta': 1
	});
	await visit(`/digaipe/estadisticas/cierres/${closure.id}`);
	await screenshot(
		'08-informe-oficial-pantalla',
		'Paso 3: informe oficial con 2 matriculados, 109 no matriculados y 0 pendientes'
	);
	await exportPdf(
		'09-cierre-oficial',
		'Informe oficial del cierre: 111 asignaciones, 2 matriculados y 109 no matriculados',
		`/digaipe/estadisticas/cierres/${closure.id}/pdf`,
		[
			'Informe oficial de cierre',
			'Asignados: 111',
			'Matriculados: 2',
			'No matriculados: 109',
			'Pendientes: 0',
			'Sin trámite registrado',
			'Documentación devuelta',
			'Trámite incompleto',
			closure.sha256
		]
	);
	await exportPdf(
		'10-no-matriculados',
		'Listado final de los 109 no matriculados',
		'/digaipe/estadisticas/pdf?reportMode=matricula&filter_process=CONCILIACION-111&filter_status=no_matriculado&includeStudentData=on',
		['Asignados: 109', 'Matriculados: 0', 'No matriculados: 109', 'Pendientes: 0']
	);
	await visit(
		'/digaipe/revision-documentos?process=CONCILIACION-111&dateFrom=2026-01-01&dateTo=2026-12-31'
	);
	assert.equal(await page.locator('[name=processingId]:enabled').count(), 0);
	assert.equal(await page.locator('button.btn-unlock:enabled').count(), 0);
	await screenshot(
		'11-revision-bloqueada',
		'Paso 4: revisión y desbloqueo bloqueados después del cierre'
	);
	await writeFile(
		path.join(root, 'manifest.json'),
		JSON.stringify(
			{ reports, screens, totals: closure.report.totals, reasons, confirmation },
			null,
			2
		)
	);
	const guide = spawnSync(
		'python',
		[
			'-c',
			`import fitz,sys,json,pathlib
root=pathlib.Path(sys.argv[1]); data=json.loads((root/'manifest.json').read_text(encoding='utf-8')); doc=fitz.open()
for step in data['screens']:
 p=doc.new_page(width=842,height=595); p.insert_text((25,30),step['title'],fontsize=13); p.insert_text((25,50),'Demostracion con datos ficticios: 111 asignaciones, 122 ofertas; cierre = 2 matriculados + 109 no matriculados.',fontsize=9); p.insert_image(fitz.Rect(20,65,822,575),filename=str(root/(step['name']+'.png')),keep_proportion=True)
doc.save(root/'12-proceso-de-cierre.pdf')`,
			root
		],
		{ encoding: 'utf8', windowsHide: true }
	);
	assert.equal(guide.status, 0, guide.stderr);
	const html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Estadísticas y cierre: evidencia</title><style>body{font:16px system-ui;max-width:1200px;margin:2rem auto;background:#eef2f6;color:#183050;padding:1rem}section{background:white;padding:1.2rem;margin:1rem 0}img{max-width:100%;height:auto}a{color:#124ba1}</style><h1>Estadísticas verificadas y cierre del proceso</h1><p>Datos ficticios. Antes del cierre: 111 asignaciones, 122 ofertas, 2 matriculados y 109 pendientes. Después: 2 matriculados, 109 no matriculados y 0 pendientes. De los no matriculados: 107 sin trámite, 1 incompleto y 1 devuelto.</p><p><a href="12-proceso-de-cierre.pdf">Ver proceso de cierre completo (PDF)</a></p>${reports.map((r) => `<section><h2><a href="${r.name}.pdf">${r.title}</a></h2><p>${r.pages} página(s). Exportación real de la aplicación; texto y límites de página verificados.</p><a href="${r.name}.pdf"><img src="${r.name}.png"></a></section>`).join('')}${screens.map((s) => `<section><h2>${s.title}</h2><a href="${s.name}.png"><img src="${s.name}.png"></a></section>`).join('')}</html>`;
	await writeFile(path.join(root, 'index.html'), html);
	console.log(
		`PASS: ${reports.length} verified application PDFs, closing-process PDF and ${screens.length} screenshots saved in artifacts/statistics-review.`
	);
}
