import { redirect } from '@sveltejs/kit';
import { filterFromSlug } from '$lib/result-filter';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, params }) => {
	const data = await parent();
	const filter = filterFromSlug(params.filter);
	const complete =
		data.set.questions.length > 0 &&
		data.set.questions.every((item) => Boolean(item.expectedAnswer?.trim()));
	const series = `/parent/children/${params.id}/sets/${params.setId}`;
	if (!filter || !data.set.submittedAt || !complete) redirect(302, series);
	return { filter };
};
