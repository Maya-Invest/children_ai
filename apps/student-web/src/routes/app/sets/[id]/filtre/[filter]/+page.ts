import { redirect } from '@sveltejs/kit';
import { filterFromSlug } from '$lib/result-filter';
import type { PageLoad } from './$types';

function correctionReady(set: { correctionReleasedAt?: string | null; questions: { expectedAnswer?: string }[] }) {
	return (
		Boolean(set.correctionReleasedAt) &&
		set.questions.length > 0 &&
		set.questions.every((item) => Boolean(item.expectedAnswer?.trim()))
	);
}

export const load: PageLoad = async ({ parent, params }) => {
	const data = await parent();
	const filter = filterFromSlug(params.filter);
	if (!data.set.submittedAt) redirect(302, `/app/sets/${params.id}/question/1`);
	if (!filter || !correctionReady(data.set)) redirect(302, `/app/sets/${params.id}`);
	return { filter };
};
