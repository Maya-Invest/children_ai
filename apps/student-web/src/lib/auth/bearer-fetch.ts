import { PUBLIC_API_URL } from '$env/static/public';
import { canonicalHttpOrigin, createAccessTokenManager, createBearerFetch } from './access-token';
import { identityAuthOrigin } from './identity-origin';

const childrenApiOrigin = canonicalHttpOrigin(PUBLIC_API_URL.trim() || 'http://localhost:8787');

export const accessTokens = createAccessTokenManager(async (resource) => {
	const response = await fetch(new URL('/auth/edaya/access-token', identityAuthOrigin()).href, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ resource }),
	});
	if (!response.ok) {
		throw new Error('Impossible de renouveler la session parent.');
	}
	return response.json() as Promise<{ accessToken: string; expiresAt: string }>;
});

export const parentApiFetch = createBearerFetch(accessTokens, childrenApiOrigin);
