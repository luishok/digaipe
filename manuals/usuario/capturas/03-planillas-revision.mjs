// Fase 3: rol Generación de planillas. Fase 4: rol Matrícula y devolución.
import { writeFileSync } from 'node:fs';
import { abrir, entrar, foto, ir, BASE, USUARIOS, CLAVE_PRUEBA } from './comun.mjs';

const PROCESO = '.UA900/26-11-11';
const PDF_DIR = 'C:/Users/fj/AppData/Local/Temp/claude/f1aea47da2c3c27b/37d7ee64-0e09-4ab6-b4fe-b3552c6e6348/scratchpad';

// ---------------------------------------------------------------- Planillas
{
	const { browser, page } = await abrir();
	try {
		await entrar(page, USUARIOS.planillas.correo, CLAVE_PRUEBA);
		await ir(page, '/digaipe');
		await foto(page, 'inicio-planillas');
		await ir(page, '/digaipe/generacion-planilla');
		await foto(page, 'planilla-lista', { completa: true });

		await page.fill('#search', 'V99000001');
		await Promise.all([page.waitForURL(/search=/), page.click('form.search-form button[type=submit]')]);
		await page.waitForLoadState('networkidle');
		await foto(page, 'planilla-busqueda');

		// Enlaces "Seleccionar" de todas las admisiones de prueba.
		await ir(page, '/digaipe/generacion-planilla?search=V990000');
		const enlaces = await page.locator('a:text-is("Seleccionar")').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
		enlaces.sort();
		console.log('admisiones de prueba:', enlaces.length);

		let primera = true;
		for (const href of enlaces.slice(0, 8)) {
			await ir(page, href);
			if (primera) {
				await foto(page, 'planilla-detalle', { completa: true });
				await page.selectOption('#genero', 'F');
				await page.fill('#telefono', '0414-555-0199');
				await Promise.all([page.waitForLoadState('networkidle'), page.click('form[action="?/updateStudent"] button[type=submit]')]);
				await page.waitForTimeout(600);
				await foto(page, 'planilla-datos-guardados');
			}
			if (await page.locator('button:has-text("Generar planilla PDF")').count()) {
				const res = await page.request.post(`${BASE}${href}/pdf`, { headers: { Origin: BASE }, multipart: {} });
				const pdf = await res.body();
				if (primera) writeFileSync(`${PDF_DIR}/planilla-prueba.pdf`, pdf);
				console.log(href, res.status(), pdf.length, 'bytes');
			}
			if (primera) {
				await ir(page, href);
				await foto(page, 'planilla-generada', { completa: true });
			}
			primera = false;
		}
		await ir(page, '/digaipe/generacion-planilla?search=V990000');
		await foto(page, 'planilla-lista-estados', { completa: true });
	} finally {
		await browser.close();
	}
}

// ---------------------------------------------------------------- Revisión de documentos
{
	const { browser, page } = await abrir();
	try {
		await entrar(page, USUARIOS.revisor.correo, CLAVE_PRUEBA);
		await ir(page, '/digaipe');
		await foto(page, 'inicio-revision');
		const filtro = `/digaipe/revision-documentos?dateFrom=2026-11-01&dateTo=2026-11-30&process=${encodeURIComponent(PROCESO)}`;
		await ir(page, filtro);
		await foto(page, 'revision-lista', { completa: true });

		const casillas = page.locator('input.row-checkbox:not([disabled])');
		const n = await casillas.count();
		console.log('filas revisables:', n);
		// Matricular las tres primeras.
		for (let i = 0; i < Math.min(3, n); i++) await casillas.nth(i).check();
		await page.check('input[name=status][value=matriculado]', { force: true });
		await foto(page, 'revision-matricular', { completa: true });
		await Promise.all([page.waitForLoadState('networkidle'), page.click('form.data-section button.btn-submit')]);
		await page.waitForTimeout(800);
		await foto(page, 'revision-matriculados', { completa: true });

		// Devolver la cuarta con motivo.
		await ir(page, filtro);
		await page.locator('input.row-checkbox:not([disabled])').nth(3).check();
		await page.check('input[name=status][value=devuelto]', { force: true });
		await page.fill('[name=reason]', 'Falta copia de la cédula de identidad.');
		await foto(page, 'revision-devolver', { completa: true });
		await Promise.all([page.waitForLoadState('networkidle'), page.click('form.data-section button.btn-submit')]);
		await page.waitForTimeout(800);
		await foto(page, 'revision-devuelto', { completa: true });

		// Desbloquear una matriculada.
		await ir(page, filtro);
		const motivo = page.locator('input[placeholder="Motivo de desbloqueo..."]').first();
		await motivo.fill('Se corrigió el teléfono del estudiante.');
		await foto(page, 'revision-desbloquear', { completa: true });
		await Promise.all([page.waitForLoadState('networkidle'), page.locator('button[name=unlockProcessingId]').first().click()]);
		await page.waitForTimeout(800);
		await foto(page, 'revision-desbloqueado', { completa: true });
	} finally {
		await browser.close();
	}
}
