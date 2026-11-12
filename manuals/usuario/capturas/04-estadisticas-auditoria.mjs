// Fase 5: Estadísticas, Auditor y acciones exclusivas del Administrador.
import { writeFileSync } from 'node:fs';
import { abrir, entrar, foto, ir, BASE, USUARIOS, CLAVE_PRUEBA, credencialesAdmin } from './comun.mjs';

const PROCESO = '.UA900/26-11-11';
const TMP = 'C:/Users/fj/AppData/Local/Temp/claude/f1aea47da2c3c27b/37d7ee64-0e09-4ab6-b4fe-b3552c6e6348/scratchpad';
// Solo eventos de esta sesión de capturas (todas las acciones de prueba son posteriores).
const AUDIT_DESDE = '2026-11-11T17:30';

// ---------------------------------------------------------------- Estadísticas
{
	const { browser, page } = await abrir();
	try {
		await entrar(page, USUARIOS.estadisticas.correo, CLAVE_PRUEBA);
		await ir(page, '/digaipe');
		await foto(page, 'inicio-estadisticas');
		await ir(page, '/digaipe/estadisticas');
		await foto(page, 'estadisticas-vacio', { completa: true });

		const base = new URLSearchParams({ dateBasis: 'asignacion', dateFrom: '2026-11-01', dateTo: '2026-11-30', filter_process: PROCESO });
		for (const modo of ['general', 'consolidado', 'estadisticas', 'reconciliacion']) {
			const q = new URLSearchParams(base);
			q.set('reportMode', modo);
			await ir(page, `/digaipe/estadisticas?${q}`);
			await foto(page, `estadisticas-${modo}`, { completa: true });
			if (modo === 'estadisticas' || modo === 'general') {
				const res = await page.request.get(`${BASE}/digaipe/estadisticas/pdf?${q}`);
				writeFileSync(`${TMP}/reporte-${modo}.pdf`, await res.body());
				console.log('pdf', modo, res.status());
			}
		}
	} finally {
		await browser.close();
	}
}

// ---------------------------------------------------------------- Auditor (solo lectura)
{
	const { browser, page } = await abrir();
	try {
		await entrar(page, USUARIOS.auditor.correo, CLAVE_PRUEBA);
		await ir(page, '/digaipe');
		await foto(page, 'inicio-auditor');
		await ir(page, '/digaipe/admin');
		await foto(page, 'auditor-admin');
		await ir(page, `/digaipe/revision-documentos?dateFrom=2026-11-01&dateTo=2026-11-30&process=${encodeURIComponent(PROCESO)}`);
		await foto(page, 'auditor-revision', { completa: true });
		await ir(page, `/digaipe/admin/audit?from=${AUDIT_DESDE}&to=2026-11-11T23:59`);
		await foto(page, 'auditoria', { completa: true });
		await ir(page, `/digaipe/admin/audit?from=${AUDIT_DESDE}&to=2026-11-11T23:59&action=admission_processing.reviewed`);
		await foto(page, 'auditoria-filtrada', { completa: true });
	} finally {
		await browser.close();
	}
}

// ---------------------------------------------------------------- Administrador: acciones exclusivas
{
	const { browser, page } = await abrir();
	try {
		const admin = credencialesAdmin();
		await entrar(page, admin.correo, admin.clave);

		// Desactivar proceso: se muestra el formulario lleno, sin enviarlo.
		await ir(page, '/digaipe/procesos-adm');
		const fila = page.locator(`tr:has(td:text-is("${PROCESO}"))`);
		await fila.locator('input[name=reason]').fill('Cierre anticipado del proceso.');
		await foto(page, 'admin-procesos', { completa: true });

		// Eliminar el borrador de prueba (el lote con error), nunca otros lotes.
		await ir(page, '/digaipe/admisiones/cargar');
		const borrador = page.locator('tr:has(td:text-is("PRUEBA UA900 A2026 con error.xlsx")), tr:has(a:text-is("PRUEBA UA900 A2026 con error.xlsx"))');
		if (await borrador.count()) {
			await borrador.first().locator('input[name=reason]').fill('Archivo cargado con un código de carrera errado.');
			await foto(page, 'admin-eliminar-borrador', { completa: true });
			page.once('dialog', (d) => d.accept());
			await Promise.all([page.waitForLoadState('networkidle'), borrador.first().locator('button:has-text("Eliminar")').click()]);
			await page.waitForTimeout(800);
			await foto(page, 'admin-borrador-eliminado', { completa: true });
		} else {
			console.log('AVISO: no se encontró el borrador de prueba');
		}
	} finally {
		await browser.close();
	}
}
