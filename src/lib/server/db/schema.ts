import {mysqlTable, serial, int, text, varchar, char} from 'drizzle-orm/mysql-core';
import {SQL, sql} from "drizzle-orm";

//LISTA DE CARRERAS 
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

	clave: varchar('clave', {length: 5}).notNull().generatedAlwaysAs(
		():SQL => sql`concat(${careers.nucleo},${careers.ofae})`,
		{mode: "virtual"}

	),
})


//MODALIDADES DE ADMISION
export const mod_admission = mysqlTable('admission_modalities',{
	id: serial('id').primaryKey(),
	code: varchar('codigo_admission', { length: 4 }).notNull().unique(),
	name: varchar('nombre', {length: 128}).notNull().unique()
})


export * from './auth.schema';
