import { redirect } from '@sveltejs/kit';
import { authClient } from '$lib/auth/client';
import { getGuardianToken, isDemoExplore } from '$lib/session';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ url }) => {
	if (url.pathname.startsWith('/parent/login')) {
		return {};
	}
	if (isDemoExplore() && getGuardianToken()) {
		return { demo: true };
	}
	const session = await authClient.getSession();
	if (!session.data) {
		throw redirect(302, '/parent/login');
	}
	return { session: session.data };
};
