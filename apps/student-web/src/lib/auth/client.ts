import { createAuthClient } from 'better-auth/client';
import { accessTokens } from './bearer-fetch';
import { identityAuthOrigin } from './identity-origin';

export const authClient = createAuthClient({
	baseURL: identityAuthOrigin(),
	basePath: '/auth',
	fetchOptions: {
		credentials: 'include',
		onSuccess(context) {
			const path = new URL(context.request.url, window.location.origin).pathname;
			if (/\/auth\/(?:sign-in|sign-up|sign-out)/.test(path)) {
				accessTokens.clear();
			}
		},
	},
});
