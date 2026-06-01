import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import { buildLegacyPlanillaFields, getActiveAdmissionForPlanilla } from '$lib/server/admisiones/planilla';
import { fillDigaipePDF } from '$lib/server/planillas/admision-digaipe';

function parseAdmissionId(value: string) {
	const admissionId = Number(value);
	if (!Number.isInteger(admissionId) || admissionId <= 0) error(404, 'Admision no encontrada.');
	return admissionId;
}

function fileSafe(value: string) {
	return value.replace(/[^\w.-]+/g, '_');
}

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) redirect(302, '/login');

	const admissionId = parseAdmissionId(params.admissionId ?? '');
	const admission = await getActiveAdmissionForPlanilla(admissionId);
	if (!admission) error(404, 'Admision no disponible para generar planilla hoy.');
	const planillaFields = buildLegacyPlanillaFields(admission);

	const pdfBytes = await fillDigaipePDF({
		numeroRegistro: planillaFields.planilla,
		programaAcademico: planillaFields.prog,
		periodoIngreso: admission.periodoIngreso,
		modalidad: planillaFields.mod,
		apellidosNombres: planillaFields.propio,
		cedula: admission.cedula,
		fechaMat: planillaFields.fechaMat
	});

	const body = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;

	return new Response(body, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `inline; filename="DIGAIPE_${fileSafe(admission.cedula)}_${admission.id}.pdf"`
		}
	});
};
