CREATE TABLE `admission_processings` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`admission_id` bigint unsigned NOT NULL,
	`processing_date` date NOT NULL,
	`planilla_generated_at` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`generated_by_user_id` varchar(36) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'pendiente',
	`reviewed_at` timestamp(3),
	`reviewed_by_user_id` varchar(36),
	`return_reason` varchar(500),
	`unlocked_at` timestamp(3),
	`unlocked_by_user_id` varchar(36),
	`unlock_reason` varchar(500),
	CONSTRAINT `admission_processings_id` PRIMARY KEY(`id`),
	CONSTRAINT `admission_processings_admission_id_unique` UNIQUE(`admission_id`),
	CONSTRAINT `admission_processings_admission_id_fk` FOREIGN KEY (`admission_id`) REFERENCES `admissions`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
	CONSTRAINT `admission_processings_generated_by_user_id_fk` FOREIGN KEY (`generated_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
	CONSTRAINT `admission_processings_reviewed_by_user_id_fk` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
	CONSTRAINT `admission_processings_unlocked_by_user_id_fk` FOREIGN KEY (`unlocked_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
);
--> statement-breakpoint
CREATE INDEX `admission_processings_date_status_idx` ON `admission_processings` (`processing_date`,`status`);
--> statement-breakpoint
CREATE INDEX `admission_processings_generated_by_idx` ON `admission_processings` (`generated_by_user_id`);
--> statement-breakpoint
CREATE TRIGGER `admission_processings_audit_insert` AFTER INSERT ON `admission_processings`
FOR EACH ROW
CALL `append_database_audit_event`('admission_processings', 'INSERT', CAST(NEW.id AS CHAR), NULL,
	JSON_OBJECT('id', NEW.id, 'admissionId', NEW.admission_id, 'processingDate', NEW.processing_date, 'status', NEW.status, 'generatedByUserId', NEW.generated_by_user_id));
--> statement-breakpoint
CREATE TRIGGER `admission_processings_audit_update` AFTER UPDATE ON `admission_processings`
FOR EACH ROW
CALL `append_database_audit_event`('admission_processings', 'UPDATE', CAST(NEW.id AS CHAR),
	JSON_OBJECT('id', OLD.id, 'status', OLD.status, 'reviewedAt', OLD.reviewed_at, 'returnReason', OLD.return_reason, 'unlockedAt', OLD.unlocked_at, 'unlockReason', OLD.unlock_reason),
	JSON_OBJECT('id', NEW.id, 'status', NEW.status, 'reviewedAt', NEW.reviewed_at, 'returnReason', NEW.return_reason, 'unlockedAt', NEW.unlocked_at, 'unlockReason', NEW.unlock_reason));
