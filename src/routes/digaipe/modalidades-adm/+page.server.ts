import type { PageServerLoad } from '../../../../.svelte-kit/types/src/routes/digaipe/carreras/$types';
import { db } from '$lib/server/db';
import { mod_admission } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	const all_admission_modalities = await db.select().from(mod_admission);
	return {
		all_admission_modalities: all_admission_modalities
	};
};
