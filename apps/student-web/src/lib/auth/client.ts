import { accessTokens } from './bearer-fetch';
import { identityAuthOrigin } from './identity-origin';

type AuthFailure = { code?: string; message: string };

export type AuthChallenge = {
	state: 'primary_required' | 'totp_required' | 'enrollment_required';
	challenge: string;
};

export type AuthComplete = {
	state: 'complete';
	user?: { id: string; email?: string | null };
};

export type AuthPayload = AuthChallenge | AuthComplete | { state: string; challenge?: string };

async function post<T>(path: string, body: object): Promise<{ data: T | null; error: AuthFailure | null }> {
	let response: Response;
	try {
		response = await fetch(new URL(path, identityAuthOrigin()).href, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});
	} catch {
		return { data: null, error: { code: 'network_error', message: 'Impossible de joindre l’authentification Edaya.' } };
	}
	const payload = (await response.json().catch(() => ({}))) as { code?: string; message?: string; state?: string };
	if (!response.ok) {
		return {
			data: null,
			error: {
				code: payload.code,
				message: payload.message ?? payload.code ?? 'Connexion impossible',
			},
		};
	}
	if (payload.state === 'complete') accessTokens.clear();
	return { data: payload as T, error: null };
}

export const authClient = {
	startOtp: (email: string, terms?: { version: string; locale: 'fr' | 'en' }) =>
		post<AuthChallenge>('/auth/edaya/otp/start', {
			kind: 'email',
			value: email,
			channel: 'email',
			...(terms
				? { termsAcceptance: { version: terms.version, locale: terms.locale, accepted: true } }
				: {}),
		}),
	revealOtp: (challenge: string) =>
		post<{ otp: string }>('/auth/edaya/testing/otp', { challenge }),
	verifyOtp: (challenge: string, code: string) =>
		post<AuthPayload>('/auth/edaya/otp/verify', { challenge, code }),
	verifyTotp: (challenge: string, code: string) =>
		post<AuthPayload>('/auth/edaya/totp/verify', { challenge, code }),
	getSession: () => post<{ user?: { id: string } }>('/auth/edaya/session', {}),
	signOut: () => {
		accessTokens.clear();
		return post<{ success: boolean }>('/auth/edaya/sign-out', {});
	},
};
