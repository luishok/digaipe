import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

type DigaipePlanillaData = {
	numeroRegistro?: string | number | null;
	programaAcademico?: string | null;
	periodoIngreso?: string | null;
	modalidad?: string | null;
	apellidosNombres?: string | null;
	cedula?: string | null;
	fechaMat?: string | null;
	checks?: boolean[];
};

const PAGE_H = 467.8;
const CHECKBOX_TOPS = [69.3, 82.9, 96.5, 110.2, 123.8, 137.4, 151.0, 164.7, 178.3, 191.9, 205.6, 219.2];
const TEMPLATE_PATH = path.resolve(process.cwd(), 'static', 'digaipe_form.pdf');

function text(value: string | number | null | undefined) {
	return String(value ?? '');
}

export async function fillDigaipePDF(student: DigaipePlanillaData) {
	const pdfBytes = await readFile(TEMPLATE_PATH);
	const pdfDoc = await PDFDocument.load(pdfBytes);
	const form = pdfDoc.getForm();
	const page = pdfDoc.getPages()[0];
	console.log(student);
	form.getTextField('Planilla').setText(text(student.numeroRegistro));
	form.getTextField('Prog').setText(text(student.programaAcademico));
	form.getTextField('Periodo_ingreso').setText(text(student.periodoIngreso));
	form.getTextField('Mod').setText(text(student.modalidad));
	form.getTextField('Propio').setText(text(student.apellidosNombres));
	form.getTextField('fecha_mat').setText(text(student.fechaMat));
	form.getTextField('Ced_estudiante').setText(text(student.cedula));
	form.flatten();

	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

	(student.checks ?? []).forEach((checked, index) => {
		if (!checked) return;
		page.drawText('X', {
			x: 498.5,
			y: PAGE_H - CHECKBOX_TOPS[index] - 5,
			size: 8,
			font,
			color: rgb(0.1, 0.5, 0.1)
		});
	});

	return pdfDoc.save();
}
