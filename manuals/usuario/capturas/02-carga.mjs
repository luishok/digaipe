// Fase 2: rol Carga de admisiones. Crea el proceso de prueba, carga el lote ficticio y
// recorre listas y parámetros.
import { abrir, entrar, foto, ir, USUARIOS, CLAVE_PRUEBA, DATOS } from './comun.mjs';

const PROCESO = '.UA900/26-11-11';
const FECHAS = ['2026-11-11', '2026-11-12'];

const { browser, page } = await abrir();
try {
	await entrar(page, USUARIOS.cargador.correo, CLAVE_PRUEBA);
	await ir(page, '/digaipe');
	await foto(page, 'inicio-carga');

	// ---- Procesos de admisión
	await ir(page, '/digaipe/procesos-adm');
	await foto(page, 'procesos-vacio', { completa: true });
	if (!(await page.locator(`td:text-is("${PROCESO}")`).count())) {
		await page.fill('#process-code', PROCESO);
		await foto(page, 'procesos-codigo');
		await page.click('#create-process-form button[type=submit]');
		await page.waitForSelector('#active-dates-input');
		await page.waitForTimeout(500);
		for (const f of FECHAS) {
			await page.fill('#active-dates-input', f);
			await page.click('#active-dates-input + button');
		}
		await foto(page, 'procesos-fechas', { completa: true });
		await page.click('.save-dates-form button[type=submit]');
		await page.waitForSelector('.mensaje-exito');
		await foto(page, 'procesos-fechas-guardadas', { completa: true });
		await page.waitForTimeout(4500); // la página se recarga sola
	}
	await ir(page, '/digaipe/procesos-adm');
	await foto(page, 'procesos-lista', { completa: true });

	// ---- Cargar admisiones: primero un archivo con un error, luego el correcto
	await ir(page, '/digaipe/admisiones/cargar');
	await foto(page, 'cargar-vacio', { completa: true });

	async function previsualizar(xlsx, nombre) {
		await ir(page, '/digaipe/admisiones/cargar');
		await page.setInputFiles('#file-xlsx', `${DATOS}/${xlsx}`);
		await page.setInputFiles('#estadistica-pdf', `${DATOS}/PRUEBA estadistica firmada.pdf`);
		await page.setInputFiles('#manifest-pdf', `${DATOS}/PRUEBA manifiesto.pdf`);
		await page.waitForTimeout(300);
		if (nombre === 'cargar-con-error') await foto(page, 'cargar-archivos-listos', { completa: true });
		await Promise.all([page.waitForLoadState('networkidle'), page.click('form[action="?/preview"] button[type=submit]')]);
		await page.waitForTimeout(800);
		await foto(page, nombre, { completa: true });
	}
	await previsualizar('PRUEBA UA900 A2026 con error.xlsx', 'cargar-con-error');
	await previsualizar('PRUEBA UA900 A2026.xlsx', 'cargar-vista-previa');

	const guardar = page.locator('form[action="?/save"] button');
	if (await guardar.count()) {
		await Promise.all([page.waitForLoadState('networkidle'), guardar.click()]);
		await page.waitForTimeout(800);
		await foto(page, 'cargar-guardado', { completa: true });
	} else {
		console.log('AVISO: no apareció el botón Guardar admisiones');
	}

	// ---- Gestión de aspirantes, filtrada por el proceso de prueba
	await ir(page, `/digaipe/admisiones?process=${encodeURIComponent(PROCESO)}`);
	await foto(page, 'aspirantes', { completa: true });

	// ---- Parámetros
	await ir(page, '/digaipe/carreras');
	await foto(page, 'carreras');
	await page.click('button:has-text("Subir Archivo")');
	await page.waitForTimeout(400);
	await foto(page, 'carreras-subir');
	await ir(page, '/digaipe/modalidades-adm');
	await foto(page, 'modalidades');
} finally {
	await browser.close();
}
