import { ensureSubjectSlug } from '$lib/follow-subject';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, params }) => {
	const data = await parent();
	await ensureSubjectSlug(data.home, 'marks', params.subject, `/parent/children/${params.id}/notes`);
};
