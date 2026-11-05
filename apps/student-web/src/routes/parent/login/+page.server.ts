import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import type { PageServerLoad } from './$types';

/** Local sign-in helper. Absent or any value other than "true" keeps the reveal control off. */
export const load: PageServerLoad = async () => {
	return {
		otpFlag: env.OTP_FLAG === 'true',
		terms: await loadTerms(),
	};
};

async function loadTerms(): Promise<{ enforced: boolean; version: string }> {
	const origin = publicEnv.PUBLIC_AUTH_URL?.trim();
	if (!origin) return { enforced: false, version: '' };
	try {
		const response = await fetch(new URL('/auth/edaya/terms?locale=fr', origin), { cache: 'no-store' });
		if (!response.ok) return { enforced: false, version: '' };
		const body = (await response.json()) as {
			enforced?: boolean;
			document?: { version?: string } | null;
		};
		return {
			enforced: body.enforced === true,
			version: body.document?.version?.trim() ?? '',
		};
	} catch {
		return { enforced: false, version: '' };
	}
}
