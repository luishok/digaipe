import {mysqlTable, serial, int, text, varchar, char} from 'drizzle-orm/mysql-core';
import {SQL, sql} from "drizzle-orm";

export const careers = mysqlTable('careers', {
	id: serial('id').primaryKey(),
	programa_academico: text('programa_academico').notNull(),
	codigo: int('codigo'),
	ofae: varchar('ofae', { length: 4 }).notNull(),
	ocre: int('ocre'),
	facultad: text('facultad').notNull(),
	todo: text("todo").generatedAlwaysAs(
		(): SQL => sql`concat(${careers.programa_academico},"(", ${careers.facultad}, ")")`,
		{mode: "virtual"}
	),
	nucleo: char('nucleo').notNull(),
	clave: varchar('clave', {length: 5}).notNull(),
})


export * from './auth.schema';
