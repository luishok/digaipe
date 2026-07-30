CREATE TABLE `admission_processings` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`admission_id` bigint unsigned NOT NULL,
	`processing_date` date NOT NULL,
	`planilla_generated_at` timestamp(3) NOT NULL DEFAULT (now()),
	`generated_by_user_id` varchar(36) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'pendiente',
	`reviewed_at` timestamp(3),
	`reviewed_by_user_id` varchar(36),
	`return_reason` varchar(500),
	`unlocked_at` timestamp(3),
	`unlocked_by_user_id` varchar(36),
	`unlock_reason` varchar(500),
	CONSTRAINT `admission_processings_id` PRIMARY KEY(`id`),
	CONSTRAINT `admission_processings_admission_id_unique` UNIQUE(`admission_id`)
);
--> statement-breakpoint
ALTER TABLE `admission_processings` ADD CONSTRAINT `admission_processings_admission_id_admissions_id_fk` FOREIGN KEY (`admission_id`) REFERENCES `admissions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admission_processings` ADD CONSTRAINT `admission_processings_generated_by_user_id_user_id_fk` FOREIGN KEY (`generated_by_user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admission_processings` ADD CONSTRAINT `admission_processings_reviewed_by_user_id_user_id_fk` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admission_processings` ADD CONSTRAINT `admission_processings_unlocked_by_user_id_user_id_fk` FOREIGN KEY (`unlocked_by_user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admission_processings_date_status_idx` ON `admission_processings` (`processing_date`,`status`);--> statement-breakpoint
CREATE INDEX `admission_processings_generated_by_idx` ON `admission_processings` (`generated_by_user_id`);--> statement-breakpoint
CREATE INDEX `admissions_fecha_asignacion_idx` ON `admissions` (`fecha_asignacion`);--> statement-breakpoint
CREATE INDEX `admissions_periodo_fecha_idx` ON `admissions` (`periodo_ingreso`,`fecha_asignacion`);