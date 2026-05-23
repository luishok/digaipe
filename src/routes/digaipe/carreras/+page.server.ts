import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/index';
import { careers } from '$lib/server/db/schema';
import { auditContextFromEvent, writeAuditLog } from '$lib/server/audit';
import { parse } from 'csv-parse/sync';

type NewCareer = typeof careers.$inferInsert;
type CsvRow = {
	'Programa Académico': string;
	'OPSU': number | null;
	'OFAE': string | null;
	'OCRE': number | null;
	'Facultad o Núcleo': string;
	'Nucleo': string;
	'Clave': string;
};


function isUploadedFile(value: FormDataEntryValue | null): value is File {
    return value instanceof File && value.size > 0;
}

export const load: PageServerLoad = async () => {
    const list_all_careers = await db.select().from(careers);
    return {
        all_careers: list_all_careers
    };
};

//IMPORT CSV


export const actions = {
    default: async (event) => {
        if (!event.locals.user) {
            return { error: true, message: "Debe iniciar sesion." };
        }

        const { request } = event;
        const formData = await request.formData();
        const file = formData.get('csvFile');
        const auditContext = auditContextFromEvent(event);

        if (!isUploadedFile(file)) {
            return { error: true, message: "No se seleccionó ningún archivo." };
        }
        if (!auditContext) {
            return { error: true, message: "Debe iniciar sesion." };
        }

        try {
            // 1. Leer el contenido del archivo como texto
            const text = await file.text();

            // 2. Parsear el CSV a objetos (asumiendo que tiene cabeceras)
            const records = parse(text, {
                columns: true,
                delimiter: ';',
                skip_empty_lines: true
            }) as CsvRow[];

            // const values = records.map((row)=>({
            //     programa_academico: row['Programa Académico'],
            //     codigo: row['OPSU'] || null,
            //     ofae: row['OFAE'] || null,
            //     ocre: row['OCRE'] || null,
            //     facultad: row['Facultad o Núcleo'],
            //     nucleo: row['Nucleo']

            // }))

            const values: NewCareer[] = records.map((row) => ({
                programa_academico: String(row['Programa Académico'] ?? ''),
                codigo: row['OPSU'] ? Number(row['OPSU']) : null,
                ofae: String(row['OFAE'] ?? ''),
                ocre: row['OCRE'] ? Number(row['OCRE']) : null,
                facultad: String(row['Facultad o Núcleo'] ?? ''),
                nucleo: String(row['Nucleo'] ?? ''),
                clave: String(row['Clave'] ?? '')
            }));
            // 3. Insertar en la base de datos
           

            await db.transaction(async (tx) => {
                await tx.insert(careers).values(values);
                await writeAuditLog(tx, auditContext, {
                    action: 'career.imported',
                    entityType: 'career',
                    entityId: 'csv_import',
                    before: null,
                    after: { rowCount: values.length },
                    metadata: { fileName: file.name }
                });
            });
            // await db.insert(careers).values({
            //     programa_academico: 'Ingeniería Geológica',
            //     codigo: 10593,
            //     ofae: 'TIG',
            //     ocre: 23,
            //     facultad: 'Núcleo Rafael Rangel',
            //     nucleo: 'T',
            //     clave: '12345'
            // });
            console.log('Datos Cargados');
            return { error: false, message: "Archivo cargado exitosamente." };

        } catch (err) {
            console.error(err);
            return { error: true, message: "Error al procesar el archivo o la base de datos." };
        }
    }
};


