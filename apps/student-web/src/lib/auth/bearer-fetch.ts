import { PUBLIC_API_URL, PUBLIC_AUTH_URL } from '$env/static/public';
import { canonicalHttpOrigin, createAccessTokenManager, createBearerFetch } from './access-token';
import { identityAuthOrigin } from './identity-origin';

const childrenApiOrigin = canonicalHttpOrigin(PUBLIC_API_URL.trim() || 'http://localhost:8787');
/** Access tokens are audience-locked to the unified Edaya API, then presented to Children AI. */
const edayaApiOrigin = canonicalHttpOrigin(PUBLIC_AUTH_URL.trim() || 'http://localhost:9999');

export const accessTokens = createAccessTokenManager(async () => {
	const response = await fetch(new URL('/auth/edaya/access-token', identityAuthOrigin()).href, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ resource: edayaApiOrigin }),
	});
	if (!response.ok) {
		throw new Error('Impossible de renouveler la session parent.');
	}
	return response.json() as Promise<{ accessToken: string; expiresAt: string }>;
});

export const parentApiFetch = createBearerFetch(accessTokens, childrenApiOrigin);
