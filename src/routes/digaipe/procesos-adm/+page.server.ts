import { db } from '$lib/server/db';
import {proceso_admission, APActiveDates, careers} from '$lib/server/db/schema';
import { fail, type Actions } from '@sveltejs/kit';
import {eq, sql} from "drizzle-orm";
import type {PageServerLoad} from "../../../../.svelte-kit/types/src/routes/digaipe/carreras/$types";

export const actions: Actions = {
    create: async ({ request }) => {
        const data = await request.formData();
        const code = (data.get('code') as string)?.replace(/\s+/g, '').toUpperCase();

        if (!code) return fail(400, { error: 'Code is required' });
        if (code.length > 100) return fail(400, { error: 'Code is too long' });

        // Check if code already exists
        const existing = await db
            .select({ id: proceso_admission.id })
            .from(proceso_admission)
            .where(eq(proceso_admission.code, code))
            .limit(1);

        if (existing.length > 0) return fail(409, { error: `Code "${code}" already exists` });

        const [result] = await db
            .insert(proceso_admission)
            .values({ code, isEnabled: true });

        return { processId: result.insertId, code };
    },

    saveDates: async ({ request }) => {
        const data = await request.formData();
        const processId = Number(data.get('processId'));
        const rawDates = data.get('dates') as string;

        if (!processId || isNaN(processId)) return fail(400, { error: 'Invalid process ID' });
        if (!rawDates) return fail(400, { error: 'No dates provided' });

        // Parse and validate
        let dates: string[];
        try {
            const parsed = JSON.parse(rawDates);
            if (!Array.isArray(parsed)) throw new Error();

            dates = parsed
                .map((d: unknown) => (typeof d === 'string' ? d.trim() : ''))
                .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))  // must be YYYY-MM-DD
                .filter(d => !isNaN(new Date(d).getTime()))    // must be a valid date
                .slice(0, 365);                                // cap to a reasonable limit
        } catch {
            return fail(400, { error: 'Invalid dates format' });
        }

        if (!dates.length) return fail(400, { error: 'No valid dates provided' });

        await db.insert(APActiveDates)
            .values(dates.map(activeDate => ({ codeId: processId, activeDate: new Date(activeDate) })))
            .onDuplicateKeyUpdate({ set: { activeDate: sql`active_date` } }); // ignore duplicates

        return { processId, saved: true };
    },
};

export const load: PageServerLoad = async () => {
    const rows = await db
        .select({
            id: proceso_admission.id,
            code: proceso_admission.code,
            activeDate: APActiveDates.activeDate,
        })
        .from(proceso_admission)
        .leftJoin(APActiveDates, eq(proceso_admission.id, APActiveDates.codeId));

// Fold flat rows into {id, code, dates[]}
    const result = Object.values(
        rows.reduce((acc, row) => {
            if (!acc[row.id]) {
                acc[row.id] = { id: row.id, code: row.code, dates: [] };
            }
            if (row.activeDate) {
                acc[row.id].dates.push(row.activeDate.toLocaleDateString());
            }
            return acc;
        }, {} as Record<number, { id: number; code: string; dates: string[] }>)
    );
    return {
        all_admission_proc : result,
    };
};