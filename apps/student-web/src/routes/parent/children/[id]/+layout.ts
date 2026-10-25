import { loadParentChild } from '$lib/parent-api';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = ({ params }) => {
	return { home: loadParentChild(params.id) };
};
