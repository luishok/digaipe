CREATE TABLE `admission_modalities` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`codigo_admission` varchar(4) NOT NULL,
	`nombre` text NOT NULL,
	CONSTRAINT `admission_modalities_id` PRIMARY KEY(`id`),
	CONSTRAINT `admission_modalities_codigo_admission_unique` UNIQUE(`codigo_admission`),
	CONSTRAINT `admission_modalities_nombre_unique` UNIQUE(`nombre`)
);
