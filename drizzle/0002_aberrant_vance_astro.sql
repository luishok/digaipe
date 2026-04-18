ALTER TABLE `careers` DROP COLUMN `clave`;--> statement-breakpoint
ALTER TABLE `careers` ADD `clave` varchar(5) GENERATED ALWAYS AS (concat(`careers`.`nucleo`,`careers`.`ofae`)) VIRTUAL NOT NULL;