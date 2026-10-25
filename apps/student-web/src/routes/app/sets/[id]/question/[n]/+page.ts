import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, params }) => {
	const data = await parent();
	if (data.set.submittedAt) redirect(302, `/app/sets/${params.id}`);
	const total = data.set.questions.length;
	const n = Number(params.n);
	const valid = Number.isInteger(n) && n >= 1 && (total === 0 ? n === 1 : n <= total);
	if (!valid) {
		const target = Number.isInteger(n) && n > total && total > 0 ? total : 1;
		redirect(302, `/app/sets/${params.id}/question/${target}`);
	}
};
