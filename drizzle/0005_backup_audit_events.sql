-- Lets the backup account record backup results in the audit ledger without being able to
-- forge any other event: it gets EXECUTE on this procedure only, not on append_audit_event.
-- Runs with the definer's rights (the database owner). USER() is the calling account, so each
-- event names the MySQL account that recorded it.
CREATE PROCEDURE `record_backup_event`(
	IN p_action varchar(128),
	IN p_outcome varchar(24),
	IN p_backup_name varchar(128),
	IN p_metadata json
)
BEGIN
	IF p_action NOT IN ('backup.completed', 'backup.failed', 'backup.restored') THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'record_backup_event only records backup events';
	END IF;
	IF p_outcome NOT IN ('success', 'failure') THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'record_backup_event outcome must be success or failure';
	END IF;
	CALL `append_audit_event`(
		UUID(), 'backup', p_action, p_outcome, NULL, LEFT(USER(), 255), NULL, NULL, NULL, NULL,
		'backup', p_backup_name, NULL, NULL, p_metadata
	);
END;
