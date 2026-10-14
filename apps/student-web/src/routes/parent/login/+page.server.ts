import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

/** Local sign-in helper. Absent or any value other than "true" keeps the reveal control off. */
export const load: PageServerLoad = () => {
	return { otpFlag: env.OTP_FLAG === 'true' };
};
