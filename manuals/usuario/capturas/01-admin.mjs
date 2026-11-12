// Fase 1: inicio de sesión, menú y administración de usuarios. Crea las cuentas de prueba.
import { abrir, entrar, foto, ir, credencialesAdmin, USUARIOS, CLAVE_PRUEBA } from './comun.mjs';

const { browser, page } = await abrir();
try {
	await ir(page, '/login');
	await foto(page, 'login');

	const admin = credencialesAdmin();
	await entrar(page, admin.correo, admin.clave);
	await ir(page, '/digaipe');
	await foto(page, 'inicio-admin');

	// Menú desplegable de Admisiones abierto.
	await page.hover('li.menu-dropdown >> nth=0');
	await page.waitForTimeout(400);
	await foto(page, 'menu-admisiones');

	await ir(page, '/digaipe/admin');
	await foto(page, 'admin-inicio');

	// Crear las cuentas de prueba que todavía no existan.
	for (const u of Object.values(USUARIOS)) {
		await ir(page, `/digaipe/admin/roles?search=${encodeURIComponent(u.correo)}`);
		if (await page.locator(`td:has-text("${u.correo}")`).count()) continue;
		await page.fill('#name', u.nombre);
		await page.fill('#email', u.correo);
		await page.fill('#password', CLAVE_PRUEBA);
		await page.check(`form[action="?/create"] input[name=roles][value=${u.rol}]`);
		if (u === USUARIOS.estadisticas) await foto(page, 'admin-agregar-usuario-lleno');
		await page.click('form[action="?/create"] button[type=submit]');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(800);
		if (u === USUARIOS.estadisticas) await foto(page, 'admin-usuario-creado');
	}

	await ir(page, '/digaipe/admin/roles');
	await foto(page, 'admin-usuarios', { completa: true });

	// Detalle "Eliminar usuario" abierto en la fila del auditor de prueba.
	await ir(page, '/digaipe/admin/roles?search=auditor%40digaipe.ula');
	await page.click('summary:has-text("Eliminar usuario")');
	await foto(page, 'admin-eliminar-usuario', { completa: true });
} finally {
	await browser.close();
}
