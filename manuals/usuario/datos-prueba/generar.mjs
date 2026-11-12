// Genera archivos de PRUEBA con datos ficticios para las capturas del manual.
// Ninguna persona es real. Cédulas en el rango V-99.000.0xx, que no se usa en la vida real.
// Uso: node C:/Users/fj/WebstormProjects/digaipe2/manuals/usuario/datos-prueba/generar.mjs
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/fj/WebstormProjects/digaipe2/package.json');
const XLSX = require('xlsx');
const dir = path.dirname(fileURLToPath(import.meta.url));

export const PROCESO = '.UA900/26-11-11';

const personas = [
	['V99000001', 'RONDON MARQUEZ ANA LUCIA', '0414-555-0101', 'ana.rondon@correo.ejemplo', 'F', 'DD', 'AR'],
	['V99000002', 'BRICEÑO ROJAS CARLOS JOSE', '0424-555-0102', 'carlos.briceno@correo.ejemplo', 'M', 'AA', 'ATL'],
	['V99000003', 'PEÑA SUAREZ MARIA GABRIELA', '0416-555-0103', 'maria.pena@correo.ejemplo', 'F', 'HEM', 'AR'],
	['V99000004', 'URDANETA MOLINA LUIS ALBERTO', '.', 'luis.urdaneta@correo.ejemplo', 'M', 'HEN', 'COP'],
	['V99000005', 'QUINTERO PAREDES SOFIA VALENTINA', '0412-555-0105', 'sofia.quintero@correo.ejemplo', 'F', 'DD', 'ART'],
	['V99000006', 'ALBORNOZ DAVILA JESUS ENRIQUE', '0414-555-0106', 'jesus.albornoz@correo.ejemplo', 'M', 'HEC', 'AR'],
	['V99000007', 'MONSALVE ARAUJO VALERIA ANDREINA', '0426-555-0107', 'valeria.monsalve@correo.ejemplo', 'F', 'AA', 'AR'],
	['V99000008', 'GUERRERO SANCHEZ DANIEL ALEJANDRO', '0414-555-0108', 'daniel.guerrero@correo.ejemplo', 'M', 'HEM', 'ATL'],
	['V99000009', 'TERAN VILLAMIZAR CAMILA ANDREA', '0424-555-0109', 'camila.teran@correo.ejemplo', 'F', 'HEN', 'AR'],
	['V99000010', 'OCHOA FERNANDEZ MIGUEL ANGEL', '0416-555-0110', 'miguel.ochoa@correo.ejemplo', 'M', 'DD', 'AR']
];

function filas(conError) {
	return personas.map(([ced, nom, tel, mail, sex, opcion, moda], i) => ({
		Num_Asignacion: PROCESO,
		Ced_estudiante: ced,
		Apel_Nom: nom,
		Telefono: tel,
		Correo_e: mail,
		Sex: sex,
		Periodo_ingreso: 'A2026',
		Fecha_asignacion: '2026-11-11',
		// Un código de carrera inexistente para mostrar la pantalla de errores.
		Opcion: conError && i === 2 ? 'ZZZ' : opcion,
		Moda_Ingre: moda,
		Cod_Ocre: 'ADM',
		Ano: 2026,
		Proceso: 1
	}));
}

function guardar(nombre, conError) {
	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas(conError)), 'Admisiones');
	XLSX.writeFile(wb, path.join(dir, nombre));
}

guardar('PRUEBA UA900 A2026.xlsx', false);
guardar('PRUEBA UA900 A2026 con error.xlsx', true);

// PDF mínimo válido (solo para pasar la validación de firma %PDF).
function pdf(texto) {
	const stream = `BT /F1 18 Tf 72 720 Td (${texto}) Tj ET`;
	const objs = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
		'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
		`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
		'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
	];
	let out = '%PDF-1.4\n';
	const offsets = [];
	objs.forEach((o, i) => {
		offsets.push(out.length);
		out += `${i + 1} 0 obj\n${o}\nendobj\n`;
	});
	const xref = out.length;
	out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
	out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
	out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
	return out;
}
writeFileSync(path.join(dir, 'PRUEBA estadistica firmada.pdf'), pdf('Estadistica firmada - DOCUMENTO DE PRUEBA'));
writeFileSync(path.join(dir, 'PRUEBA manifiesto.pdf'), pdf('Manifiesto - DOCUMENTO DE PRUEBA'));
console.log('Archivos de prueba generados en', dir);
