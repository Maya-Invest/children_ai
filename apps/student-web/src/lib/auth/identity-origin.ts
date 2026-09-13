import { PUBLIC_AUTH_URL } from '$env/static/public';

/**
 * Local student-web is served at 127.0.0.1:5175 while Identity is localhost:9900.
 * Those hosts are different sites, so SameSite=Lax session cookies are not sent
 * on fetch POST. In the browser during `vite dev`, call Identity through the
 * Vite `/auth` proxy so the cookie is first-party.
 */
export function identityAuthOrigin(): string {
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		return window.location.origin;
	}
	const authBaseUrl = PUBLIC_AUTH_URL.trim();
	if (!authBaseUrl) {
		throw new Error('PUBLIC_AUTH_URL is required');
	}
	return authBaseUrl;
}
