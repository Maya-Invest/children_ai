import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, params }) => {
	const data = await parent();
	if (!data.set.submittedAt) redirect(302, `/app/sets/${params.id}/question/1`);
};
