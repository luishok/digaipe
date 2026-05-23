import {
	mysqlTable,
	serial,
	int,
	text,
	varchar,
	char,
	boolean,
	date,
	json,
	timestamp,
	index,
	primaryKey,
	foreignKey,
	unique, bigint
} from 'drizzle-orm/mysql-core';
import {SQL, sql} from "drizzle-orm";
import { user } from './auth.schema';


//LISTA DE CARRERAS 
export const careers = mysqlTable('careers', {
	id: serial('id').primaryKey(),
	programa_academico: text('programa_academico').notNull(),
	codigo: int('codigo'),
	ofae: varchar('ofae', { length: 4 }).notNull(),
	ocre: int('ocre'),
	facultad: text('facultad').notNull(),
	todo: text("todo").generatedAlwaysAs(
		(): SQL => sql`concat(${careers.programa_academico},"(", ${careers.facultad}, ")")`,
		{mode: "virtual"}
	),
	nucleo: char('nucleo').notNull(),

	clave: varchar('clave', {length: 5}).notNull().generatedAlwaysAs(
		():SQL => sql`concat(${careers.nucleo},${careers.ofae})`,
		{mode: "virtual"}

	),
})


//MODALIDADES DE ADMISION
export const mod_admission = mysqlTable('admission_modalities',{
	id: serial('id').primaryKey(),
	code: varchar('codigo_admission', { length: 4 }).notNull().unique(),
	name: varchar('nombre', {length: 128}).notNull().unique()
})

//PROCESOS DE ADMISION
export const proceso_admission = mysqlTable('admission_processes', {
	id: serial('id').primaryKey(),
	code: varchar('num_asignacion', { length: 100 }).notNull().unique(),
	isEnabled: boolean('is_enabled').notNull().default(true),
});

export const APActiveDates = mysqlTable('ap_active_dates', {
	codeId: bigint('code_id', { mode: 'number', unsigned: true }).notNull(),
	activeDate: date('active_date').notNull(),
}, (table) => ({
	pk: primaryKey({ columns: [table.codeId, table.activeDate] }),

	// Custom constraint name instead of the auto-generated monster
	codeIdFk: foreignKey({
		name: 'ap_active_dates_code_id_fk',   // <-- your custom name
		columns: [table.codeId],
		foreignColumns: [proceso_admission.id],
	}).onDelete('cascade'),
}));

// ── Catalog: OCRE process types (ADM, DIFMAT, …) ──────────────────────────
export const auditLogs = mysqlTable('audit_logs', {
	id: serial('id').primaryKey(),
	actorUserId: varchar('actor_user_id', { length: 36 }).notNull().references(() => user.id),
	action: varchar('action', { length: 128 }).notNull(),
	entityType: varchar('entity_type', { length: 128 }).notNull(),
	entityId: varchar('entity_id', { length: 128 }).notNull(),
	before: json('before'),
	after: json('after'),
	metadata: json('metadata'),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
}, (table) => [
	index('audit_logs_actor_idx').on(table.actorUserId),
	index('audit_logs_entity_idx').on(table.entityType, table.entityId),
	index('audit_logs_action_idx').on(table.action),
	index('audit_logs_created_at_idx').on(table.createdAt),
]);

export const ocre_types = mysqlTable('ocre_types', {
	id:   serial('id').primaryKey(),
	code: varchar('code', { length: 10 }).notNull().unique(),  // 'ADM' | 'DIFMAT'
	name: varchar('name', { length: 128 }).notNull(),
});

// ── Students ───────────────────────────────────────────────────────────────
export const students = mysqlTable('students', {
	id:               serial('id').primaryKey(),
	cedula:           varchar('cedula', { length: 12 }).notNull().unique(), // 'V013118120'
	apellidos_nombres: varchar('apellidos_nombres', { length: 255 }).notNull(),
	telefono:         varchar('telefono', { length: 60 }),
	correo:           varchar('correo', { length: 255 }),
});

// ── Admissions (core record — one row per student+career assignment) ────────
export const admissionImportBatches = mysqlTable('admission_import_batches', {
	id: serial('id').primaryKey(),
	uploadedByUserId: varchar('uploaded_by_user_id', { length: 36 }).notNull().references(() => user.id),
	status: varchar('status', { length: 16 }).notNull().default('draft'),
	sourceFileName: varchar('source_file_name', { length: 255 }).notNull(),
	sourceFilePath: varchar('source_file_path', { length: 500 }).notNull(),
	sourceFileSha256: varchar('source_file_sha256', { length: 64 }).notNull(),
	estadisticaFileName: varchar('estadistica_file_name', { length: 255 }).notNull(),
	estadisticaFilePath: varchar('estadistica_file_path', { length: 500 }).notNull(),
	estadisticaFileSha256: varchar('estadistica_file_sha256', { length: 64 }).notNull(),
	manifestFileName: varchar('manifest_file_name', { length: 255 }).notNull(),
	manifestFilePath: varchar('manifest_file_path', { length: 500 }).notNull(),
	manifestFileSha256: varchar('manifest_file_sha256', { length: 64 }).notNull(),
	rowCount: int('row_count').notNull().default(0),
	warningCount: int('warning_count').notNull().default(0),
	errorCount: int('error_count').notNull().default(0),
	createdAt: timestamp('created_at', { fsp: 3 }).defaultNow().notNull(),
	savedAt: timestamp('saved_at', { fsp: 3 }),
}, (table) => [
	index('admission_import_batches_uploaded_by_idx').on(table.uploadedByUserId),
	index('admission_import_batches_status_idx').on(table.status),
]);

export const admissions = mysqlTable('admissions', {
	id: serial('id').primaryKey(),
	importBatchId: bigint('import_batch_id', { mode: 'number', unsigned: true }).references(() => admissionImportBatches.id),

	// Who was assigned
	studentId:   bigint('student_id', { mode: 'number', unsigned: true }).notNull().references(() => students.id),

	// To which career
	careerId:    bigint('career_id',  { mode: 'number', unsigned: true }).notNull().references(() => careers.id),

	// Under which admission process (num_asignacion → last active code)
	procesoId:   bigint('proceso_id', { mode: 'number', unsigned: true }).notNull().references(() => proceso_admission.id),

	// Via which modality  (Moda_Ingre: PS / OPS / CP → mod_admission.code)
	modalityId:  bigint('modality_id',{ mode: 'number', unsigned: true }).notNull().references(() => mod_admission.id),

	// The student's chosen option — mirrors careers.clave (e.g. 'GA', 'HEF', 'MM')
	// Kept as a plain varchar; you can't FK a virtual/generated column in MySQL
	opcion:      varchar('opcion', { length: 5 }).notNull(),

	// OCRE process type for this admission
	ocreTypeId:  bigint('ocre_type_id',{ mode: 'number', unsigned: true }).references(() => ocre_types.id),

	// Temporal data
	periodoIngreso:   varchar('periodo_ingreso', { length: 10 }).notNull(), // 'A2026' | 'U2026'
	fechaAsignacion:  date('fecha_asignacion').notNull(),
	ano:              int('ano').notNull(),
	proceso:          int('proceso').notNull(),  // 1 = first assignment, 2 = reassignment
}, (table) => ({
	// A student should not be assigned to the same career twice in the same process
	uniq: unique().on(table.studentId, table.careerId, table.procesoId),
}));
export * from './auth.schema';
