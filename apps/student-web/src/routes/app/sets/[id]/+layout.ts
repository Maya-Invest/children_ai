import { loadSet } from '$lib/api';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ params }) => {
	const payload = await loadSet(params.id);
	return { set: payload.set };
};
