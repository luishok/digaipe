import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import { hashPassword } from 'better-auth/crypto';

// Uses only the disposable database created by test-admissions-db.mjs.
export async function testAdmissionsBrowser(owner, databaseUrl, closureId) {
	assert.match(new URL(databaseUrl).pathname, /^\/digaipe_admission_test_\d+$/);
	const password = `Prueba-${randomUUID()}`;
	await owner.query("UPDATE user SET role='admin' WHERE id='admission-test'");
	await owner.query(
		"INSERT INTO account (id,account_id,provider_id,user_id,password,updated_at) VALUES ('admission-test','admission-test','credential','admission-test',?,NOW())",
		[await hashPassword(password)]
	);
	const socket = createServer();
	socket.listen(0, '127.0.0.1');
	await once(socket, 'listening');
	const port = socket.address().port;
	await new Promise((resolve) => socket.close(resolve));
	const base = `http://127.0.0.1:${port}`;
	const child = spawn(
		process.execPath,
		[
			'node_modules/vite/bin/vite.js',
			'--host',
			'127.0.0.1',
			'--port',
			String(port),
			'--strictPort'
		],
		{
			env: {
				...process.env,
				DATABASE_URL: databaseUrl,
				ORIGIN: base,
				BETTER_AUTH_SECRET: randomUUID() + randomUUID()
			},
			stdio: ['ignore', 'pipe', 'pipe'],
			windowsHide: true
		}
	);
	let logs = '';
	child.stdout.on('data', (chunk) => {
		logs = (logs + chunk).slice(-10000);
	});
	child.stderr.on('data', (chunk) => {
		logs = (logs + chunk).slice(-10000);
	});
	let browser;
	try {
		let ready = false;
		for (let i = 0; i < 120; i++) {
			try {
				if ((await fetch(`${base}/login`)).ok) {
					ready = true;
					break;
				}
			} catch {
				/* server starting */
			}
			if (child.exitCode !== null) throw new Error(`Test server exited: ${logs}`);
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		assert.ok(ready, `Browser test server did not start: ${logs}`);
		browser = await chromium.launch({ channel: 'chrome', headless: true });
		const browserContext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
		const page = await browserContext.newPage();
		const errors = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.goto(`${base}/login`);
		await page.waitForLoadState('networkidle');
		await page.locator('[name=email]').fill('admission-test@example.invalid');
		await page.locator('[name=password]').fill(password);
		await Promise.all([
			page.waitForURL('**/digaipe'),
			page.getByRole('button', { name: 'Iniciar sesión' }).click()
		]);
		await page.goto(`${base}/digaipe/procesos-adm`);
		await page.waitForLoadState('networkidle');
		const closedRow = page.locator('tbody tr').filter({ hasText: 'PROCESO-PRUEBA' });
		assert.match(await closedRow.innerText(), /Cerrado el/);
		await closedRow.getByRole('link', { name: 'Ver resultado de matrícula' }).click();
		await page.waitForLoadState('networkidle');
		assert.equal(await page.locator('#reportMode').inputValue(), 'matricula');
		assert.equal(await page.locator('[name=dateFrom]').isDisabled(), true);
		assert.match(
			await page.locator('body').innerText(),
			/Resultado de matrícula por carrera y proceso/
		);
		await page.getByText('Incluir datos del estudiante', { exact: true }).click();
		await page.getByRole('button', { name: 'Generar Vista Previa' }).click();
		await page.waitForLoadState('networkidle');
		await page.getByText('Detalle de asignaciones y resultado', { exact: true }).waitFor();
		assert.match(await page.locator('body').innerText(), /Sin trámite registrado/);
		await page.goto(`${base}/digaipe/estadisticas/cierres/${closureId}`);
		await page.waitForLoadState('networkidle');
		assert.match(await page.locator('h1').innerText(), /Informe oficial de cierre/);
		const download = await Promise.all([
			page.waitForEvent('download'),
			page.getByRole('link', { name: 'Descargar CSV completo' }).click()
		]);
		assert.match(download[0].suggestedFilename(), /digaipe_cierre_/);
		await page.goto(`${base}/digaipe/admisiones?process=PROCESO-PRUEBA&outcome=no_matriculado`);
		await page.waitForLoadState('networkidle');
		// .status-badge uses text-transform: capitalize, so innerText reads "No Matriculado".
		assert.match(await page.locator('table').innerText(), /No matriculado/i);
		await page.goto(
			`${base}/digaipe/revision-documentos?dateFrom=2026-01-01&dateTo=2026-01-01&process=PROCESO-PRUEBA`
		);
		await page.waitForLoadState('networkidle');
		assert.equal(await page.locator('input[name=processingId]:enabled').count(), 0);
		await page.goto(`${base}/digaipe/procesos-adm`);
		await page.waitForLoadState('networkidle');
		const processRow = page.locator('tbody tr').filter({ hasText: 'PROCESO-PRUEBA' });
		await processRow
			.locator('form[action="?/reopen"] [name=reason]')
			.fill('REAPERTURA DESDE LA PANTALLA');
		page.once('dialog', (dialog) => dialog.accept());
		await processRow.getByRole('button', { name: 'Reabrir proceso', exact: true }).click();
		await processRow.getByRole('button', { name: 'Cerrar proceso', exact: true }).waitFor();
		await processRow
			.locator('form[action="?/close"] [name=reason]')
			.fill('CIERRE DESDE LA PANTALLA');
		page.once('dialog', (dialog) => dialog.accept());
		await processRow.getByRole('button', { name: 'Cerrar proceso', exact: true }).click();
		await processRow.getByRole('button', { name: 'Reabrir proceso', exact: true }).waitFor();
		assert.match(await processRow.innerText(), /Informe oficial v3/);
		if (process.argv.includes('--screenshots')) {
			const { captureAdmissionsEvidence } = await import('./admissions-evidence.mjs');
			await captureAdmissionsEvidence(page, base, owner);
		}
		if (process.argv.includes('--statistics-pdfs')) {
			const { captureStatisticsPdfs } = await import('./statistics-pdf-evidence.mjs');
			await captureStatisticsPdfs(page, base, owner);
		}
		assert.equal(errors.length, 0, errors.join('\n'));
		console.log(
			'PASS: Chrome login, process results, report controls, snapshot download, admission outcomes, closed review controls and process reopen/close actions.'
		);
	} finally {
		if (browser) await browser.close();
		if (child.exitCode === null) {
			child.kill();
			await once(child, 'exit').catch(() => {});
		}
	}
}
