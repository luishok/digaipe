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
CREATE TABLE `audit_chain_state` (
	`id` int NOT NULL,
	`last_sequence` bigint unsigned NOT NULL,
	`last_hash` char(64) NOT NULL,
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `audit_chain_state_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`sequence` bigint unsigned NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`occurred_at` timestamp(3) NOT NULL,
	`source` varchar(24) NOT NULL,
	`action` varchar(128) NOT NULL,
	`outcome` varchar(24) NOT NULL,
	`actor_user_id` varchar(36),
	`actor_name` varchar(255),
	`actor_email` varchar(255),
	`correlation_id` varchar(36),
	`ip_address` text,
	`user_agent` text,
	`entity_type` varchar(128) NOT NULL,
	`entity_id` varchar(128) NOT NULL,
	`before_value` json,
	`after_value` json,
	`metadata` json,
	`previous_hash` char(64) NOT NULL,
	`event_hash` char(64) NOT NULL,
	CONSTRAINT `audit_events_sequence` PRIMARY KEY(`sequence`),
	CONSTRAINT `audit_events_event_id_unique` UNIQUE(`event_id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`actor_user_id` varchar(36) NOT NULL,
	`action` varchar(128) NOT NULL,
	`entity_type` varchar(128) NOT NULL,
	`entity_id` varchar(128) NOT NULL,
	`before` json,
	`after` json,
	`metadata` json,
	`ip_address` text,
	`user_agent` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `careers` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`programa_academico` text NOT NULL,
	`codigo` int,
	`ofae` varchar(4) NOT NULL,
	`ocre` int,
	`facultad` text NOT NULL,
	`todo` text GENERATED ALWAYS AS (concat(`careers`.`programa_academico`,"(", `careers`.`facultad`, ")")) VIRTUAL,
	`nucleo` char NOT NULL,
	`clave` varchar(5) GENERATED ALWAYS AS (concat(`careers`.`nucleo`,`careers`.`ofae`)) VIRTUAL NOT NULL,
	CONSTRAINT `careers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admission_modalities` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`codigo_admission` varchar(4) NOT NULL,
	`nombre` varchar(128) NOT NULL,
	CONSTRAINT `admission_modalities_id` PRIMARY KEY(`id`),
	CONSTRAINT `admission_modalities_codigo_admission_unique` UNIQUE(`codigo_admission`),
	CONSTRAINT `admission_modalities_nombre_unique` UNIQUE(`nombre`)
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
	`genero` varchar(20),
	CONSTRAINT `students_id` PRIMARY KEY(`id`),
	CONSTRAINT `students_cedula_unique` UNIQUE(`cedula`)
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` varchar(36) NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` timestamp(3),
	`refresh_token_expires_at` timestamp(3),
	`scope` text,
	`password` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL,
	CONSTRAINT `account_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` varchar(36) NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`token` varchar(255) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` varchar(36) NOT NULL,
	`impersonated_by` text,
	CONSTRAINT `session_id` PRIMARY KEY(`id`),
	CONSTRAINT `session_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`image` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`role` text,
	`banned` boolean DEFAULT false,
	`ban_reason` text,
	`ban_expires` timestamp(3),
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` varchar(36) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`expires_at` timestamp(3) NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `verification_id` PRIMARY KEY(`id`)
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
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_user_id_user_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `account` ADD CONSTRAINT `account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admission_import_batches_uploaded_by_idx` ON `admission_import_batches` (`uploaded_by_user_id`);--> statement-breakpoint
CREATE INDEX `admission_import_batches_status_idx` ON `admission_import_batches` (`status`);--> statement-breakpoint
CREATE INDEX `audit_events_occurred_idx` ON `audit_events` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `audit_events_action_idx` ON `audit_events` (`action`,`outcome`);--> statement-breakpoint
CREATE INDEX `audit_events_actor_idx` ON `audit_events` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `audit_events_entity_idx` ON `audit_events` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_events_correlation_idx` ON `audit_events` (`correlation_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_idx` ON `audit_logs` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);