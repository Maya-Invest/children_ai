import { loadSet } from '$lib/api';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ params, url }) => {
	// Track the path so this load reruns when the student leaves the questions.
	void url.pathname;
	const payload = await loadSet(params.id);
	return { set: payload.set };
};
