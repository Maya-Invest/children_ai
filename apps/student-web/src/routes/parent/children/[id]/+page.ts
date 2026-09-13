import { loadParentChild } from '$lib/parent-api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	return { home: await loadParentChild(params.id) };
};
