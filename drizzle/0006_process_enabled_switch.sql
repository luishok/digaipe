-- `is_enabled` used to mean "has dates": processes were created disabled and turned on when
-- their first dates were saved, and nothing ever turned one off. It now means "an admin has not
-- shut this process down", and whether a process is usable on a given day comes from its dates.
-- No process has ever been shut down on purpose, so every disabled row is just one that had no
-- dates yet. The audit trigger on admission_processes records each changed row.
UPDATE `admission_processes` SET `is_enabled` = 1 WHERE `is_enabled` = 0;
