import { error } from '@sveltejs/kit';
import { findHomeSet } from '$lib/home-set';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ parent, params }) => {
	const data = await parent();
	const home = await data.home;
	const set = findHomeSet(home, params.setId);
	if (!set) error(404, 'Série introuvable');
	return { set };
};
