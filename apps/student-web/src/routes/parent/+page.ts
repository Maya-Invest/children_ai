import { loadParentChildren } from '$lib/parent-api';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	return { listing: await loadParentChildren() };
};
