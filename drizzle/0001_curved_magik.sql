CREATE TABLE `ap_active_dates` (
	`code_id` bigint unsigned NOT NULL,
	`active_date` date NOT NULL,
	CONSTRAINT `ap_active_dates_code_id_active_date_pk` PRIMARY KEY(`code_id`,`active_date`)
);
--> statement-breakpoint
CREATE TABLE `admission_import_batches` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`uploaded_by_user_id` varchar(36) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'draft',
	`source_file_name` varchar(255) NOT NULL,
	`source_file_path` varchar(500) NOT NULL,
	`source_file_sha256` varchar(64) NOT NULL,
	`estadistica_file_name` varchar(255) NOT NULL,
	`estadistica_file_path` varchar(500) NOT NULL,
	`estadistica_file_sha256` varchar(64) NOT NULL,
	`manifest_file_name` varchar(255) NOT NULL,
	`manifest_file_path` varchar(500) NOT NULL,
	`manifest_file_sha256` varchar(64) NOT NULL,
	`row_count` int NOT NULL DEFAULT 0,
	`warning_count` int NOT NULL DEFAULT 0,
	`error_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`saved_at` timestamp(3),
	CONSTRAINT `admission_import_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admissions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`import_batch_id` bigint unsigned,
	`student_id` bigint unsigned NOT NULL,
	`career_id` bigint unsigned NOT NULL,
	`proceso_id` bigint unsigned NOT NULL,
	`modality_id` bigint unsigned NOT NULL,
	`opcion` varchar(5) NOT NULL,
	`ocre_type_id` bigint unsigned,
	`periodo_ingreso` varchar(10) NOT NULL,
	`fecha_asignacion` date NOT NULL,
	`ano` int NOT NULL,
	`proceso` int NOT NULL,
	CONSTRAINT `admissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `admissions_student_id_career_id_proceso_id_unique` UNIQUE(`student_id`,`career_id`,`proceso_id`)
);
--> statement-breakpoint
CREATE TABLE `ocre_types` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`code` varchar(10) NOT NULL,
	`name` varchar(128) NOT NULL,
	CONSTRAINT `ocre_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `ocre_types_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `admission_processes` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`num_asignacion` varchar(100) NOT NULL,
	`is_enabled` boolean NOT NULL DEFAULT true,
	CONSTRAINT `admission_processes_id` PRIMARY KEY(`id`),
	CONSTRAINT `admission_processes_num_asignacion_unique` UNIQUE(`num_asignacion`)
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`cedula` varchar(12) NOT NULL,
	`apellidos_nombres` varchar(255) NOT NULL,
	`telefono` varchar(60),
	`correo` varchar(255),
	CONSTRAINT `students_id` PRIMARY KEY(`id`),
	CONSTRAINT `students_cedula_unique` UNIQUE(`cedula`)
);
--> statement-breakpoint
ALTER TABLE `ap_active_dates` ADD CONSTRAINT `ap_active_dates_code_id_fk` FOREIGN KEY (`code_id`) REFERENCES `admission_processes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admission_import_batches` ADD CONSTRAINT `admission_import_batches_uploaded_by_user_id_user_id_fk` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admissions` ADD CONSTRAINT `admissions_import_batch_id_admission_import_batches_id_fk` FOREIGN KEY (`import_batch_id`) REFERENCES `admission_import_batches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admissions` ADD CONSTRAINT `admissions_student_id_students_id_fk` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admissions` ADD CONSTRAINT `admissions_career_id_careers_id_fk` FOREIGN KEY (`career_id`) REFERENCES `careers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admissions` ADD CONSTRAINT `admissions_proceso_id_admission_processes_id_fk` FOREIGN KEY (`proceso_id`) REFERENCES `admission_processes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admissions` ADD CONSTRAINT `admissions_modality_id_admission_modalities_id_fk` FOREIGN KEY (`modality_id`) REFERENCES `admission_modalities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admissions` ADD CONSTRAINT `admissions_ocre_type_id_ocre_types_id_fk` FOREIGN KEY (`ocre_type_id`) REFERENCES `ocre_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admission_import_batches_uploaded_by_idx` ON `admission_import_batches` (`uploaded_by_user_id`);--> statement-breakpoint
CREATE INDEX `admission_import_batches_status_idx` ON `admission_import_batches` (`status`);