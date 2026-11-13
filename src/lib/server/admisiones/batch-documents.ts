// Read access to the files of admission upload batches (the Excel listing, the signed
// estadística and the manifiesto). Route permission (admissions.view) is enforced in
// hooks.server.ts; this module adds which batches a user may see: every saved batch, and
// drafts only to whoever uploaded them (as on the upload page).
import { and, desc, eq, or, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { admissionImportBatches, user } from '$lib/server/db/schema';
import type { BatchFileRole } from './import';

export const BATCH_FILE_INFO: Record<
	BatchFileRole,
	{ label: string; contentType: string; extension: string; viewable: boolean }
> = {
	source: {
		label: 'Listado de asignados (Excel)',
		contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		extension: 'xlsx',
		viewable: false // shown as a table on the batch page; browsers cannot open .xlsx
	},
	estadistica: { label: 'Estadística firmada (PDF)', contentType: 'application/pdf', extension: 'pdf', viewable: true },
	manifest: { label: 'Manifiesto (PDF)', contentType: 'application/pdf', extension: 'pdf', viewable: true }
};

const visibleTo = (userId: string): SQL =>
	or(eq(admissionImportBatches.status, 'saved'), eq(admissionImportBatches.uploadedByUserId, userId))!;

const batchColumns = {
	id: admissionImportBatches.id,
	status: admissionImportBatches.status,
	rowCount: admissionImportBatches.rowCount,
	warningCount: admissionImportBatches.warningCount,
	errorCount: admissionImportBatches.errorCount,
	createdAt: admissionImportBatches.createdAt,
	savedAt: admissionImportBatches.savedAt,
	uploadedByName: user.name,
	sourceFileName: admissionImportBatches.sourceFileName,
	estadisticaFileName: admissionImportBatches.estadisticaFileName,
	manifestFileName: admissionImportBatches.manifestFileName
};

export async function listVisibleBatches(userId: string, { limit, offset }: { limit: number; offset: number }) {
	return db
		.select(batchColumns)
		.from(admissionImportBatches)
		.innerJoin(user, eq(admissionImportBatches.uploadedByUserId, user.id))
		.where(visibleTo(userId))
		.orderBy(desc(admissionImportBatches.id))
		.limit(limit)
		.offset(offset);
}

export async function countVisibleBatches(userId: string) {
	return db.$count(admissionImportBatches, visibleTo(userId));
}

/** The batch with its stored paths and hashes, or undefined if missing or not visible. */
export async function findVisibleBatch(batchId: number, userId: string) {
	const [batch] = await db
		.select({
			...batchColumns,
			sourceFilePath: admissionImportBatches.sourceFilePath,
			sourceFileSha256: admissionImportBatches.sourceFileSha256,
			estadisticaFilePath: admissionImportBatches.estadisticaFilePath,
			estadisticaFileSha256: admissionImportBatches.estadisticaFileSha256,
			manifestFilePath: admissionImportBatches.manifestFilePath,
			manifestFileSha256: admissionImportBatches.manifestFileSha256
		})
		.from(admissionImportBatches)
		.innerJoin(user, eq(admissionImportBatches.uploadedByUserId, user.id))
		.where(and(eq(admissionImportBatches.id, batchId), visibleTo(userId)))
		.limit(1);
	return batch;
}

export function parseBatchId(value: string | undefined) {
	const id = Number(value);
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}
