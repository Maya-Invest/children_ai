import { redirect } from '@sveltejs/kit';
import { authClient } from '$lib/auth/client';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ url }) => {
	if (url.pathname.startsWith('/parent/login')) {
		return {};
	}
	const session = await authClient.getSession();
	if (!session.data) {
		throw redirect(302, '/parent/login');
	}
	return { session: session.data };
};
