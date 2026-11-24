CREATE TABLE `admission_process_closures` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`proceso_id` bigint unsigned NOT NULL,
	`version` int NOT NULL,
	`closed_at` timestamp(3) NOT NULL,
	`closed_by_user_id` varchar(36) NOT NULL,
	`reason` varchar(500) NOT NULL,
	`report` json NOT NULL,
	`sha256` char(64) NOT NULL,
	CONSTRAINT `admission_process_closures_id` PRIMARY KEY(`id`),
	CONSTRAINT `admission_process_closures_version_unique` UNIQUE(`proceso_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE `admission_selections` (
	`student_id` bigint unsigned NOT NULL,
	`career_id` bigint unsigned NOT NULL,
	`proceso_id` bigint unsigned NOT NULL,
	`admission_id` bigint unsigned NOT NULL,
	`selected_at` timestamp(3),
	`selected_by_user_id` varchar(36),
	CONSTRAINT `admission_selections_student_id_career_id_proceso_id_pk` PRIMARY KEY(`student_id`,`career_id`,`proceso_id`)
);
--> statement-breakpoint
ALTER TABLE `admission_processes` ADD `closed_at` timestamp(3);--> statement-breakpoint
ALTER TABLE `admission_processes` ADD `closed_by_user_id` varchar(36);--> statement-breakpoint
ALTER TABLE `admission_processes` ADD `closure_reason` varchar(500);--> statement-breakpoint
ALTER TABLE `admissions` ADD CONSTRAINT `admissions_assignment_modality_unique` UNIQUE(`student_id`,`career_id`,`proceso_id`,`modality_id`);--> statement-breakpoint
ALTER TABLE `admissions` DROP INDEX `admissions_student_id_career_id_proceso_id_unique`;--> statement-breakpoint
ALTER TABLE `admissions` ADD CONSTRAINT `admissions_selection_scope_unique` UNIQUE(`id`,`student_id`,`career_id`,`proceso_id`);--> statement-breakpoint
ALTER TABLE `admission_process_closures` ADD CONSTRAINT `admission_process_closures_proceso_id_admission_processes_id_fk` FOREIGN KEY (`proceso_id`) REFERENCES `admission_processes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admission_process_closures` ADD CONSTRAINT `admission_process_closures_closed_by_user_id_user_id_fk` FOREIGN KEY (`closed_by_user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admission_selections` ADD CONSTRAINT `admission_selections_selected_by_user_id_user_id_fk` FOREIGN KEY (`selected_by_user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `admission_selections` ADD CONSTRAINT `admission_selections_scope_fk` FOREIGN KEY (`admission_id`,`student_id`,`career_id`,`proceso_id`) REFERENCES `admissions`(`id`,`student_id`,`career_id`,`proceso_id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `admission_selections_process_idx` ON `admission_selections` (`proceso_id`);--> statement-breakpoint
ALTER TABLE `admission_processes` ADD CONSTRAINT `admission_processes_closed_by_user_id_user_id_fk` FOREIGN KEY (`closed_by_user_id`) REFERENCES `user`(`id`) ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO `admission_selections` (`student_id`, `career_id`, `proceso_id`, `admission_id`, `selected_at`, `selected_by_user_id`)
SELECT a.student_id, a.career_id, a.proceso_id, a.id, p.reviewed_at, p.reviewed_by_user_id
FROM admissions a INNER JOIN admission_processings p ON p.admission_id = a.id
WHERE p.status = 'matriculado';
--> statement-breakpoint
CREATE TRIGGER `admission_selections_audit_insert` AFTER INSERT ON `admission_selections`
FOR EACH ROW
CALL `append_database_audit_event`('admission_selections', 'INSERT', CAST(NEW.admission_id AS CHAR), NULL,
 JSON_OBJECT('studentId', NEW.student_id, 'careerId', NEW.career_id, 'procesoId', NEW.proceso_id, 'admissionId', NEW.admission_id, 'selectedAt', NEW.selected_at, 'selectedByUserId', NEW.selected_by_user_id));
--> statement-breakpoint
CREATE TRIGGER `admission_selections_audit_update` AFTER UPDATE ON `admission_selections`
FOR EACH ROW
CALL `append_database_audit_event`('admission_selections', 'UPDATE', CAST(NEW.admission_id AS CHAR),
 JSON_OBJECT('admissionId', OLD.admission_id),
 JSON_OBJECT('studentId', NEW.student_id, 'careerId', NEW.career_id, 'procesoId', NEW.proceso_id, 'admissionId', NEW.admission_id, 'selectedAt', NEW.selected_at, 'selectedByUserId', NEW.selected_by_user_id));
--> statement-breakpoint
CREATE TRIGGER `admission_selections_audit_delete` AFTER DELETE ON `admission_selections`
FOR EACH ROW
CALL `append_database_audit_event`('admission_selections', 'DELETE', CAST(OLD.admission_id AS CHAR),
 JSON_OBJECT('studentId', OLD.student_id, 'careerId', OLD.career_id, 'procesoId', OLD.proceso_id, 'admissionId', OLD.admission_id, 'selectedAt', OLD.selected_at, 'selectedByUserId', OLD.selected_by_user_id), NULL);
--> statement-breakpoint
DROP TRIGGER IF EXISTS `admission_processes_audit_update`;
--> statement-breakpoint
CREATE TRIGGER `admission_processes_audit_update` AFTER UPDATE ON `admission_processes`
FOR EACH ROW
CALL `append_database_audit_event`('admission_processes', 'UPDATE', CAST(NEW.id AS CHAR),
 JSON_OBJECT('code', OLD.num_asignacion, 'isEnabled', OLD.is_enabled, 'closedAt', OLD.closed_at, 'closedByUserId', OLD.closed_by_user_id, 'closureReason', OLD.closure_reason),
 JSON_OBJECT('code', NEW.num_asignacion, 'isEnabled', NEW.is_enabled, 'closedAt', NEW.closed_at, 'closedByUserId', NEW.closed_by_user_id, 'closureReason', NEW.closure_reason));
--> statement-breakpoint
CREATE TRIGGER `admission_process_closures_audit_insert` AFTER INSERT ON `admission_process_closures`
FOR EACH ROW
CALL `append_database_audit_event`('admission_process_closures', 'INSERT', CAST(NEW.id AS CHAR), NULL,
 JSON_OBJECT('procesoId', NEW.proceso_id, 'version', NEW.version, 'closedAt', NEW.closed_at, 'closedByUserId', NEW.closed_by_user_id, 'reason', NEW.reason, 'sha256', NEW.sha256));
--> statement-breakpoint
CREATE TRIGGER `admission_process_closures_no_update` BEFORE UPDATE ON `admission_process_closures`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los informes de cierre son inmutables';
--> statement-breakpoint
CREATE TRIGGER `admission_process_closures_no_delete` BEFORE DELETE ON `admission_process_closures`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los informes de cierre son inmutables';
--> statement-breakpoint
CREATE PROCEDURE `acquire_audit_lock`() SQL SECURITY DEFINER
BEGIN
 DECLARE lock_id INT DEFAULT NULL;
 SELECT id INTO lock_id FROM audit_chain_state WHERE id = 1 FOR UPDATE;
 IF lock_id IS NULL THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No existe el estado de la cadena de auditoria';
 END IF;
END;
--> statement-breakpoint
CALL append_audit_event(UUID(), 'system', 'schema.admission_selections_backfilled', 'success',
 NULL, NULL, NULL, NULL, NULL, NULL, 'database', 'admission_selections', NULL, NULL,
 JSON_OBJECT('rows', (SELECT COUNT(*) FROM admission_selections)));
