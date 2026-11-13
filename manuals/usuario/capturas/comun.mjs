// Utilidades compartidas por los guiones de capturas del manual de usuario.
// Usan el Chromium de Playwright en modo headless contra la app local (http://localhost:5173).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire('C:/Users/fj/WebstormProjects/digaipe2/package.json');
export const { chromium } = require('playwright');

export const BASE = 'http://localhost:5173';
export const IMG = 'C:/Users/fj/WebstormProjects/digaipe2/manuals/usuario/img';
export const DATOS = 'C:/Users/fj/WebstormProjects/digaipe2/manuals/usuario/datos-prueba';

// Cuentas de prueba (ficticias) creadas por 01-admin.mjs, una por rol.
export const CLAVE_PRUEBA = 'Prueba-Manual-2026';
export const USUARIOS = {
	cargador: { nombre: 'Carla Méndez', correo: 'carga@digaipe.ula', rol: 'cargador' },
	planillas: { nombre: 'Pedro Salas', correo: 'planillas@digaipe.ula', rol: 'planillas' },
	revisor: { nombre: 'Luisa Rivas', correo: 'revision@digaipe.ula', rol: 'revisor' },
	estadisticas: { nombre: 'Andrés Toro', correo: 'estadisticas@digaipe.ula', rol: 'estadisticas' },
	auditor: { nombre: 'Elena Prieto', correo: 'auditor@digaipe.ula', rol: 'auditor' }
};

export function credencialesAdmin() {
	const env = readFileSync('C:/Users/fj/WebstormProjects/digaipe2/.env', 'utf8');
	const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1].trim().replace(/^"|"$/g, '');
	return { correo: get('BOOTSTRAP_ADMIN_EMAIL'), clave: get('BOOTSTRAP_ADMIN_PASSWORD') };
}

export async function abrir() {
	const browser = await chromium.launch({ args: ['--lang=es-419'] });
	const context = await browser.newContext({
		viewport: { width: 1366, height: 800 },
		deviceScaleFactor: 2,
		locale: 'es-VE',
		timezoneId: 'America/Caracas'
	});
	const page = await context.newPage();
	return { browser, context, page };
}

export async function entrar(page, correo, clave) {
	await ir(page, '/login');
	await page.fill('input[name=email]', correo);
	await page.fill('input[name=password]', clave);
	await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 }), page.click('button.btn-full')]);
	await page.waitForLoadState('networkidle');
}

// Navega y espera a que SvelteKit termine de hidratar (si no, borra lo que se escriba).
export async function ir(page, ruta) {
	await page.goto(`${BASE}${ruta}`);
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(600);
}

export async function salir(page) {
	await page.context().clearCookies();
}

// Captura de la ventana visible (o de la página completa con completa=true).
export async function foto(page, nombre, opciones = {}) {
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(300);
	await page.screenshot({ path: `${IMG}/${nombre}.png`, fullPage: !!opciones.completa, clip: opciones.clip });
	console.log('captura', nombre);
}
