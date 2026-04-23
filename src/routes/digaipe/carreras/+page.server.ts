import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db/index';
import { careers } from '$lib/server/db/schema';
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


export const load: PageServerLoad = async () => {
    const list_all_careers = await db.select().from(careers);
    return {
        all_careers: list_all_careers
    };
};

//IMPORT CSV


export const actions = {
    default: async ({ request }) => {
        const formData = await request.formData();
        const file = formData.get('csvFile');

        if (!file || file.size === 0) {
            return { error: true, message: "No se seleccionó ningún archivo." };
        }

        try {
            // 1. Leer el contenido del archivo como texto
            const text = await file.text();

            // 2. Parsear el CSV a objetos (asumiendo que tiene cabeceras)
            const records = parse(text, {
                columns: true,
                delimiter: ';',
                skip_empty_lines: true
            }) as Array<{
                programa_academico: string;
                codigo?: number;
                ofae?: string;
                ocre?: number;
                facultad: string;
                nucleo: string;
            }>;

            // const values = records.map((row)=>({
            //     programa_academico: row['Programa Académico'],
            //     codigo: row['OPSU'] || null,
            //     ofae: row['OFAE'] || null,
            //     ocre: row['OCRE'] || null,
            //     facultad: row['Facultad o Núcleo'],
            //     nucleo: row['Nucleo']

            // }))

            const values: NewCareer[] = records.map((row) => ({
                programa_academico: row['Programa Académico'],
                codigo: row['OPSU'] ? Number(row['OPSU']) : null,
                ofae: row['OFAE'],
                ocre: row['OCRE'] ? Number(row['OCRE']) : null,
                facultad: row['Facultad o Núcleo'],
                nucleo: row['Nucleo'],
                clave: row['Clave']
            }));
            // 3. Insertar en la base de datos
           

            await db.insert(careers).values(values);
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