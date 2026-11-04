import { loadDemoEnabled } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	try {
		return { demoOffered: await loadDemoEnabled() };
	} catch {
		return { demoOffered: false };
	}
};
