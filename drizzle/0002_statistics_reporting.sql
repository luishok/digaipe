CREATE INDEX `admissions_fecha_asignacion_idx` ON `admissions` (`fecha_asignacion`);
--> statement-breakpoint
CREATE INDEX `admissions_periodo_fecha_idx` ON `admissions` (`periodo_ingreso`,`fecha_asignacion`);
