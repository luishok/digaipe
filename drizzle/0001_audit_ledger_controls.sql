INSERT INTO `audit_chain_state` (`id`, `last_sequence`, `last_hash`, `updated_at`)
VALUES (1, 0, REPEAT('0', 64), UTC_TIMESTAMP(3));
--> statement-breakpoint
CREATE PROCEDURE `append_audit_event`(
	IN p_event_id varchar(36),
	IN p_source varchar(24),
	IN p_action varchar(128),
	IN p_outcome varchar(24),
	IN p_actor_user_id varchar(36),
	IN p_actor_name varchar(255),
	IN p_actor_email varchar(255),
	IN p_correlation_id varchar(36),
	IN p_ip_address text,
	IN p_user_agent text,
	IN p_entity_type varchar(128),
	IN p_entity_id varchar(128),
	IN p_before_value json,
	IN p_after_value json,
	IN p_metadata json
)
BEGIN
	DECLARE v_previous_hash char(64);
	DECLARE v_last_sequence bigint unsigned;
	DECLARE v_next_sequence bigint unsigned;
	DECLARE v_occurred_at datetime(3);
	DECLARE v_event_hash char(64);

	SELECT `last_sequence`, `last_hash`
	INTO v_last_sequence, v_previous_hash
	FROM `audit_chain_state`
	WHERE `id` = 1
	FOR UPDATE;

	SET v_next_sequence = v_last_sequence + 1;
	SET v_occurred_at = UTC_TIMESTAMP(3);
	SET v_event_hash = SHA2(CONCAT_WS('|',
		v_previous_hash,
		CAST(v_next_sequence AS CHAR),
		DATE_FORMAT(v_occurred_at, '%Y-%m-%dT%H:%i:%s.%fZ'),
		COALESCE(p_source, ''), COALESCE(p_action, ''), COALESCE(p_outcome, ''),
		COALESCE(p_actor_user_id, ''), COALESCE(p_actor_name, ''), COALESCE(p_actor_email, ''),
		COALESCE(p_correlation_id, ''), COALESCE(p_ip_address, ''), COALESCE(p_user_agent, ''),
		COALESCE(p_entity_type, ''), COALESCE(p_entity_id, ''),
		COALESCE(CAST(p_before_value AS CHAR), 'null'),
		COALESCE(CAST(p_after_value AS CHAR), 'null'),
		COALESCE(CAST(p_metadata AS CHAR), 'null')
	), 256);

	SET @digaipe_audit_append = 1;
	INSERT INTO `audit_events` (
		`sequence`, `event_id`, `occurred_at`, `source`, `action`, `outcome`,
		`actor_user_id`, `actor_name`, `actor_email`, `correlation_id`, `ip_address`, `user_agent`,
		`entity_type`, `entity_id`, `before_value`, `after_value`, `metadata`, `previous_hash`, `event_hash`
	) VALUES (
		v_next_sequence, p_event_id, v_occurred_at, p_source, p_action, p_outcome,
		p_actor_user_id, p_actor_name, p_actor_email, p_correlation_id, p_ip_address, p_user_agent,
		p_entity_type, p_entity_id, p_before_value, p_after_value, p_metadata, v_previous_hash, v_event_hash
	);

	UPDATE `audit_chain_state`
	SET `last_sequence` = v_next_sequence, `last_hash` = v_event_hash, `updated_at` = v_occurred_at
	WHERE `id` = 1;
	SET @digaipe_audit_append = 0;
END;
--> statement-breakpoint
CREATE PROCEDURE `append_database_audit_event`(
	IN p_table_name varchar(128),
	IN p_operation varchar(16),
	IN p_entity_id varchar(128),
	IN p_before_value json,
	IN p_after_value json
)
BEGIN
	CALL `append_audit_event`(
		UUID(), 'database', CONCAT('database.row_', LOWER(p_operation)), 'success',
		@digaipe_audit_actor_user_id, @digaipe_audit_actor_name, @digaipe_audit_actor_email,
		@digaipe_audit_correlation_id, NULL, NULL, p_table_name, p_entity_id,
		p_before_value, p_after_value, JSON_OBJECT('table', p_table_name, 'operation', p_operation)
	);
END;
--> statement-breakpoint
CALL `append_audit_event`(
	UUID(), 'system', 'audit.ledger_genesis', 'success', NULL, NULL, NULL, NULL, NULL, NULL,
	'audit_ledger', 'phase1', NULL, NULL, JSON_OBJECT('version', 1, 'legacyTable', 'audit_logs')
);
--> statement-breakpoint
CREATE PROCEDURE `import_legacy_audit_logs`()
BEGIN
	DECLARE done boolean DEFAULT FALSE;
	DECLARE v_id bigint;
	DECLARE v_actor_user_id varchar(36);
	DECLARE v_action varchar(128);
	DECLARE v_entity_type varchar(128);
	DECLARE v_entity_id varchar(128);
	DECLARE v_before json;
	DECLARE v_after json;
	DECLARE v_metadata json;
	DECLARE legacy_cursor CURSOR FOR
		SELECT `id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `before`, `after`, `metadata`
		FROM `audit_logs` ORDER BY `created_at`, `id`;
	DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
	OPEN legacy_cursor;
	legacy_loop: LOOP
		FETCH legacy_cursor INTO v_id, v_actor_user_id, v_action, v_entity_type, v_entity_id, v_before, v_after, v_metadata;
		IF done THEN LEAVE legacy_loop; END IF;
		CALL `append_audit_event`(
			UUID(), 'legacy', 'legacy.imported', 'success', v_actor_user_id, NULL, NULL, NULL, NULL, NULL,
			v_entity_type, v_entity_id, v_before, v_after,
			JSON_MERGE_PATCH(COALESCE(v_metadata, JSON_OBJECT()), JSON_OBJECT('legacyAuditLogId', v_id, 'legacyAction', v_action))
		);
	END LOOP;
	CLOSE legacy_cursor;
END;
--> statement-breakpoint
CALL `import_legacy_audit_logs`();
--> statement-breakpoint
DROP PROCEDURE `import_legacy_audit_logs`;
--> statement-breakpoint
CREATE TRIGGER `audit_events_no_update` BEFORE UPDATE ON `audit_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit events are append-only';
--> statement-breakpoint
CREATE TRIGGER `audit_events_no_direct_insert` BEFORE INSERT ON `audit_events`
FOR EACH ROW
BEGIN
	IF COALESCE(@digaipe_audit_append, 0) <> 1 THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit events must use append procedure';
	END IF;
END;
--> statement-breakpoint
CREATE TRIGGER `audit_events_no_delete` BEFORE DELETE ON `audit_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit events are permanent';
--> statement-breakpoint
CREATE TRIGGER `audit_chain_state_no_update` BEFORE UPDATE ON `audit_chain_state`
FOR EACH ROW
BEGIN
	IF COALESCE(@digaipe_audit_append, 0) <> 1 THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit chain state is managed by append procedure';
	END IF;
END;
--> statement-breakpoint
CREATE TRIGGER `audit_chain_state_no_delete` BEFORE DELETE ON `audit_chain_state`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit chain state is permanent';
--> statement-breakpoint
CREATE TRIGGER `audit_logs_no_update` BEFORE UPDATE ON `audit_logs`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'legacy audit logs are immutable';
--> statement-breakpoint
CREATE TRIGGER `audit_logs_no_delete` BEFORE DELETE ON `audit_logs`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'legacy audit logs are permanent';
--> statement-breakpoint
CREATE TRIGGER `students_audit_insert` AFTER INSERT ON `students` FOR EACH ROW
CALL `append_database_audit_event`('students', 'INSERT', CAST(NEW.id AS CHAR), NULL,
	JSON_OBJECT('id', NEW.id, 'cedula', NEW.cedula, 'apellidosNombres', NEW.apellidos_nombres, 'telefono', NEW.telefono, 'correo', NEW.correo, 'genero', NEW.genero));
--> statement-breakpoint
CREATE TRIGGER `students_audit_update` AFTER UPDATE ON `students` FOR EACH ROW
CALL `append_database_audit_event`('students', 'UPDATE', CAST(NEW.id AS CHAR),
	JSON_OBJECT('id', OLD.id, 'cedula', OLD.cedula, 'apellidosNombres', OLD.apellidos_nombres, 'telefono', OLD.telefono, 'correo', OLD.correo, 'genero', OLD.genero),
	JSON_OBJECT('id', NEW.id, 'cedula', NEW.cedula, 'apellidosNombres', NEW.apellidos_nombres, 'telefono', NEW.telefono, 'correo', NEW.correo, 'genero', NEW.genero));
--> statement-breakpoint
CREATE TRIGGER `students_audit_delete` AFTER DELETE ON `students` FOR EACH ROW
CALL `append_database_audit_event`('students', 'DELETE', CAST(OLD.id AS CHAR),
	JSON_OBJECT('id', OLD.id, 'cedula', OLD.cedula, 'apellidosNombres', OLD.apellidos_nombres, 'telefono', OLD.telefono, 'correo', OLD.correo, 'genero', OLD.genero), NULL);
--> statement-breakpoint
CREATE TRIGGER `admissions_audit_insert` AFTER INSERT ON `admissions` FOR EACH ROW
CALL `append_database_audit_event`('admissions', 'INSERT', CAST(NEW.id AS CHAR), NULL,
	JSON_OBJECT('id', NEW.id, 'importBatchId', NEW.import_batch_id, 'studentId', NEW.student_id, 'careerId', NEW.career_id, 'procesoId', NEW.proceso_id, 'modalityId', NEW.modality_id, 'opcion', NEW.opcion, 'ocreTypeId', NEW.ocre_type_id, 'periodoIngreso', NEW.periodo_ingreso, 'fechaAsignacion', NEW.fecha_asignacion, 'ano', NEW.ano, 'proceso', NEW.proceso));
--> statement-breakpoint
CREATE TRIGGER `admissions_audit_update` AFTER UPDATE ON `admissions` FOR EACH ROW
CALL `append_database_audit_event`('admissions', 'UPDATE', CAST(NEW.id AS CHAR),
	JSON_OBJECT('id', OLD.id, 'importBatchId', OLD.import_batch_id, 'studentId', OLD.student_id, 'careerId', OLD.career_id, 'procesoId', OLD.proceso_id, 'modalityId', OLD.modality_id, 'opcion', OLD.opcion, 'ocreTypeId', OLD.ocre_type_id, 'periodoIngreso', OLD.periodo_ingreso, 'fechaAsignacion', OLD.fecha_asignacion, 'ano', OLD.ano, 'proceso', OLD.proceso),
	JSON_OBJECT('id', NEW.id, 'importBatchId', NEW.import_batch_id, 'studentId', NEW.student_id, 'careerId', NEW.career_id, 'procesoId', NEW.proceso_id, 'modalityId', NEW.modality_id, 'opcion', NEW.opcion, 'ocreTypeId', NEW.ocre_type_id, 'periodoIngreso', NEW.periodo_ingreso, 'fechaAsignacion', NEW.fecha_asignacion, 'ano', NEW.ano, 'proceso', NEW.proceso));
--> statement-breakpoint
CREATE TRIGGER `admissions_audit_delete` AFTER DELETE ON `admissions` FOR EACH ROW
CALL `append_database_audit_event`('admissions', 'DELETE', CAST(OLD.id AS CHAR),
	JSON_OBJECT('id', OLD.id, 'importBatchId', OLD.import_batch_id, 'studentId', OLD.student_id, 'careerId', OLD.career_id, 'procesoId', OLD.proceso_id, 'modalityId', OLD.modality_id, 'opcion', OLD.opcion, 'ocreTypeId', OLD.ocre_type_id, 'periodoIngreso', OLD.periodo_ingreso, 'fechaAsignacion', OLD.fecha_asignacion, 'ano', OLD.ano, 'proceso', OLD.proceso), NULL);
--> statement-breakpoint
CREATE TRIGGER `admission_batches_audit_insert` AFTER INSERT ON `admission_import_batches` FOR EACH ROW
CALL `append_database_audit_event`('admission_import_batches', 'INSERT', CAST(NEW.id AS CHAR), NULL,
	JSON_OBJECT('id', NEW.id, 'uploadedByUserId', NEW.uploaded_by_user_id, 'status', NEW.status, 'sourceFileName', NEW.source_file_name, 'sourceFileSha256', NEW.source_file_sha256, 'estadisticaFileName', NEW.estadistica_file_name, 'estadisticaFileSha256', NEW.estadistica_file_sha256, 'manifestFileName', NEW.manifest_file_name, 'manifestFileSha256', NEW.manifest_file_sha256, 'rowCount', NEW.row_count, 'warningCount', NEW.warning_count, 'errorCount', NEW.error_count, 'createdAt', NEW.created_at, 'savedAt', NEW.saved_at));
--> statement-breakpoint
CREATE TRIGGER `admission_batches_audit_update` AFTER UPDATE ON `admission_import_batches` FOR EACH ROW
CALL `append_database_audit_event`('admission_import_batches', 'UPDATE', CAST(NEW.id AS CHAR),
	JSON_OBJECT('id', OLD.id, 'status', OLD.status, 'rowCount', OLD.row_count, 'warningCount', OLD.warning_count, 'errorCount', OLD.error_count, 'savedAt', OLD.saved_at),
	JSON_OBJECT('id', NEW.id, 'status', NEW.status, 'rowCount', NEW.row_count, 'warningCount', NEW.warning_count, 'errorCount', NEW.error_count, 'savedAt', NEW.saved_at));
--> statement-breakpoint
CREATE TRIGGER `admission_batches_audit_delete` AFTER DELETE ON `admission_import_batches` FOR EACH ROW
CALL `append_database_audit_event`('admission_import_batches', 'DELETE', CAST(OLD.id AS CHAR),
	JSON_OBJECT('id', OLD.id, 'uploadedByUserId', OLD.uploaded_by_user_id, 'status', OLD.status, 'sourceFileName', OLD.source_file_name, 'sourceFileSha256', OLD.source_file_sha256, 'estadisticaFileName', OLD.estadistica_file_name, 'estadisticaFileSha256', OLD.estadistica_file_sha256, 'manifestFileName', OLD.manifest_file_name, 'manifestFileSha256', OLD.manifest_file_sha256, 'rowCount', OLD.row_count, 'warningCount', OLD.warning_count, 'errorCount', OLD.error_count, 'createdAt', OLD.created_at, 'savedAt', OLD.saved_at), NULL);
--> statement-breakpoint
CREATE TRIGGER `admission_processes_audit_insert` AFTER INSERT ON `admission_processes` FOR EACH ROW
CALL `append_database_audit_event`('admission_processes', 'INSERT', CAST(NEW.id AS CHAR), NULL, JSON_OBJECT('id', NEW.id, 'code', NEW.num_asignacion, 'isEnabled', NEW.is_enabled));
--> statement-breakpoint
CREATE TRIGGER `admission_processes_audit_update` AFTER UPDATE ON `admission_processes` FOR EACH ROW
CALL `append_database_audit_event`('admission_processes', 'UPDATE', CAST(NEW.id AS CHAR), JSON_OBJECT('id', OLD.id, 'code', OLD.num_asignacion, 'isEnabled', OLD.is_enabled), JSON_OBJECT('id', NEW.id, 'code', NEW.num_asignacion, 'isEnabled', NEW.is_enabled));
--> statement-breakpoint
CREATE TRIGGER `admission_processes_audit_delete` AFTER DELETE ON `admission_processes` FOR EACH ROW
CALL `append_database_audit_event`('admission_processes', 'DELETE', CAST(OLD.id AS CHAR), JSON_OBJECT('id', OLD.id, 'code', OLD.num_asignacion, 'isEnabled', OLD.is_enabled), NULL);
--> statement-breakpoint
CREATE TRIGGER `active_dates_audit_insert` AFTER INSERT ON `ap_active_dates` FOR EACH ROW
CALL `append_database_audit_event`('ap_active_dates', 'INSERT', CONCAT(NEW.code_id, ':', NEW.active_date), NULL, JSON_OBJECT('codeId', NEW.code_id, 'activeDate', NEW.active_date));
--> statement-breakpoint
CREATE TRIGGER `active_dates_audit_delete` AFTER DELETE ON `ap_active_dates` FOR EACH ROW
CALL `append_database_audit_event`('ap_active_dates', 'DELETE', CONCAT(OLD.code_id, ':', OLD.active_date), JSON_OBJECT('codeId', OLD.code_id, 'activeDate', OLD.active_date), NULL);
--> statement-breakpoint
CREATE TRIGGER `careers_audit_insert` AFTER INSERT ON `careers` FOR EACH ROW
CALL `append_database_audit_event`('careers', 'INSERT', CAST(NEW.id AS CHAR), NULL, JSON_OBJECT('id', NEW.id, 'programaAcademico', NEW.programa_academico, 'codigo', NEW.codigo, 'ofae', NEW.ofae, 'ocre', NEW.ocre, 'facultad', NEW.facultad, 'nucleo', NEW.nucleo, 'clave', NEW.clave));
--> statement-breakpoint
CREATE TRIGGER `careers_audit_update` AFTER UPDATE ON `careers` FOR EACH ROW
CALL `append_database_audit_event`('careers', 'UPDATE', CAST(NEW.id AS CHAR), JSON_OBJECT('id', OLD.id, 'programaAcademico', OLD.programa_academico, 'codigo', OLD.codigo, 'ofae', OLD.ofae, 'ocre', OLD.ocre, 'facultad', OLD.facultad, 'nucleo', OLD.nucleo, 'clave', OLD.clave), JSON_OBJECT('id', NEW.id, 'programaAcademico', NEW.programa_academico, 'codigo', NEW.codigo, 'ofae', NEW.ofae, 'ocre', NEW.ocre, 'facultad', NEW.facultad, 'nucleo', NEW.nucleo, 'clave', NEW.clave));
--> statement-breakpoint
CREATE TRIGGER `careers_audit_delete` AFTER DELETE ON `careers` FOR EACH ROW
CALL `append_database_audit_event`('careers', 'DELETE', CAST(OLD.id AS CHAR), JSON_OBJECT('id', OLD.id, 'programaAcademico', OLD.programa_academico, 'codigo', OLD.codigo, 'ofae', OLD.ofae, 'ocre', OLD.ocre, 'facultad', OLD.facultad, 'nucleo', OLD.nucleo, 'clave', OLD.clave), NULL);
--> statement-breakpoint
CREATE TRIGGER `admission_modalities_audit_insert` AFTER INSERT ON `admission_modalities` FOR EACH ROW
CALL `append_database_audit_event`('admission_modalities', 'INSERT', CAST(NEW.id AS CHAR), NULL, JSON_OBJECT('id', NEW.id, 'code', NEW.codigo_admission, 'name', NEW.nombre));
--> statement-breakpoint
CREATE TRIGGER `admission_modalities_audit_update` AFTER UPDATE ON `admission_modalities` FOR EACH ROW
CALL `append_database_audit_event`('admission_modalities', 'UPDATE', CAST(NEW.id AS CHAR), JSON_OBJECT('id', OLD.id, 'code', OLD.codigo_admission, 'name', OLD.nombre), JSON_OBJECT('id', NEW.id, 'code', NEW.codigo_admission, 'name', NEW.nombre));
--> statement-breakpoint
CREATE TRIGGER `admission_modalities_audit_delete` AFTER DELETE ON `admission_modalities` FOR EACH ROW
CALL `append_database_audit_event`('admission_modalities', 'DELETE', CAST(OLD.id AS CHAR), JSON_OBJECT('id', OLD.id, 'code', OLD.codigo_admission, 'name', OLD.nombre), NULL);
--> statement-breakpoint
CREATE TRIGGER `ocre_types_audit_insert` AFTER INSERT ON `ocre_types` FOR EACH ROW
CALL `append_database_audit_event`('ocre_types', 'INSERT', CAST(NEW.id AS CHAR), NULL, JSON_OBJECT('id', NEW.id, 'code', NEW.code, 'name', NEW.name));
--> statement-breakpoint
CREATE TRIGGER `ocre_types_audit_update` AFTER UPDATE ON `ocre_types` FOR EACH ROW
CALL `append_database_audit_event`('ocre_types', 'UPDATE', CAST(NEW.id AS CHAR), JSON_OBJECT('id', OLD.id, 'code', OLD.code, 'name', OLD.name), JSON_OBJECT('id', NEW.id, 'code', NEW.code, 'name', NEW.name));
--> statement-breakpoint
CREATE TRIGGER `ocre_types_audit_delete` AFTER DELETE ON `ocre_types` FOR EACH ROW
CALL `append_database_audit_event`('ocre_types', 'DELETE', CAST(OLD.id AS CHAR), JSON_OBJECT('id', OLD.id, 'code', OLD.code, 'name', OLD.name), NULL);
--> statement-breakpoint
CREATE TRIGGER `users_audit_insert` AFTER INSERT ON `user` FOR EACH ROW
CALL `append_database_audit_event`('user', 'INSERT', NEW.id, NULL, JSON_OBJECT('id', NEW.id, 'name', NEW.name, 'email', NEW.email, 'emailVerified', NEW.email_verified, 'role', NEW.role, 'banned', NEW.banned, 'banReason', NEW.ban_reason, 'banExpires', NEW.ban_expires));
--> statement-breakpoint
CREATE TRIGGER `users_audit_update` AFTER UPDATE ON `user` FOR EACH ROW
CALL `append_database_audit_event`('user', 'UPDATE', NEW.id, JSON_OBJECT('id', OLD.id, 'name', OLD.name, 'email', OLD.email, 'emailVerified', OLD.email_verified, 'role', OLD.role, 'banned', OLD.banned, 'banReason', OLD.ban_reason, 'banExpires', OLD.ban_expires), JSON_OBJECT('id', NEW.id, 'name', NEW.name, 'email', NEW.email, 'emailVerified', NEW.email_verified, 'role', NEW.role, 'banned', NEW.banned, 'banReason', NEW.ban_reason, 'banExpires', NEW.ban_expires));
--> statement-breakpoint
CREATE TRIGGER `users_audit_delete` AFTER DELETE ON `user` FOR EACH ROW
CALL `append_database_audit_event`('user', 'DELETE', OLD.id, JSON_OBJECT('id', OLD.id, 'name', OLD.name, 'email', OLD.email, 'emailVerified', OLD.email_verified, 'role', OLD.role, 'banned', OLD.banned, 'banReason', OLD.ban_reason, 'banExpires', OLD.ban_expires), NULL);
