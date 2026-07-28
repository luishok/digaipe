import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import {
	buildLegacyPlanillaFields,
	getActiveAdmissionForPlanilla
} from '$lib/server/admisiones/planilla';
import { fillDigaipePDF } from '$lib/server/planillas/admision-digaipe';
import { auditContextFromEvent } from '$lib/server/audit';
import { ensureAdmissionProcessing } from '$lib/server/admisiones/processing';

function parseAdmissionId(value: string) {
	const admissionId = Number(value);
	if (!Number.isInteger(admissionId) || admissionId <= 0) error(404, 'Admision no encontrada.');
	return admissionId;
}

function fileSafe(value: string) {
	return value.replace(/[^\w.-]+/g, '_');
}

async function pdfResponse(event: Parameters<RequestHandler>[0], registerProcessing: boolean) {
	const { locals, params } = event;
	if (!locals.user) redirect(302, '/login');

	const admissionId = parseAdmissionId(params.admissionId ?? '');
	const admission = await getActiveAdmissionForPlanilla(admissionId);
	if (!admission) error(404, 'Admision no disponible para generar planilla hoy.');
	if (registerProcessing) {
		const auditContext = auditContextFromEvent(event);
		if (!auditContext) error(401, 'Debe iniciar sesión.');
		const processingDate = admission.activeDate.toISOString().slice(0, 10);
		await ensureAdmissionProcessing(admission.id, locals.user.id, processingDate, auditContext);
	}
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

	const body = pdfBytes.buffer.slice(
		pdfBytes.byteOffset,
		pdfBytes.byteOffset + pdfBytes.byteLength
	) as ArrayBuffer;

	return new Response(body, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `inline; filename="DIGAIPE_${fileSafe(admission.cedula)}_${admission.id}.pdf"`
		}
	});
}

export const GET: RequestHandler = async (event) => pdfResponse(event, false);

export const POST: RequestHandler = async (event) => pdfResponse(event, true);
