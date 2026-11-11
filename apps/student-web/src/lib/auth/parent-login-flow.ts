import type { AuthPayload } from './client';

export type ParentLoginPhase = 'email' | 'otp' | 'totp' | 'enrollment' | 'recovery';

export type ParentLoginMove =
	| { type: 'signed-in' }
	| { type: 'recovery'; codes: string[] }
	| { type: 'challenge'; phase: 'totp' | 'enrollment'; challenge: string; secret: string }
	| { type: 'needs-enrollment'; challenge: string }
	| { type: 'register'; challenge: string; proof: string; eligible: boolean }
	| { type: 'incomplete' };

/** Maps an Edaya auth success body onto the next parent-login step. */
export function moveAfterAuth(payload: AuthPayload): ParentLoginMove {
	if (payload.state === 'linked') return { type: 'signed-in' };
	if (payload.state === 'complete') {
		const codes = recoveryCodesOf(payload);
		if (codes.length > 0) return { type: 'recovery', codes };
		return { type: 'signed-in' };
	}
	const challenge = challengeOf(payload);
	if (payload.state === 'totp_required') {
		if (!challenge) return { type: 'incomplete' };
		return { type: 'challenge', phase: 'totp', challenge, secret: '' };
	}
	if (payload.state === 'enrollment_required') {
		if (!challenge) return { type: 'incomplete' };
		const secret = secretOf(payload);
		if (!secret) return { type: 'needs-enrollment', challenge };
		return { type: 'challenge', phase: 'enrollment', challenge, secret };
	}
	if (payload.state === 'registration_required') {
		const proof = proofOf(payload);
		if (!challenge || !proof) return { type: 'incomplete' };
		return { type: 'register', challenge, proof, eligible: eligibleOf(payload) };
	}
	return { type: 'incomplete' };
}

function challengeOf(payload: AuthPayload): string {
	return 'challenge' in payload && payload.challenge ? payload.challenge : '';
}

function secretOf(payload: AuthPayload): string {
	return 'secret' in payload && payload.secret ? payload.secret : '';
}

function proofOf(payload: AuthPayload): string {
	return 'proof' in payload && payload.proof ? payload.proof : '';
}

function eligibleOf(payload: AuthPayload): boolean {
	return 'eligible' in payload && payload.eligible === true;
}

function recoveryCodesOf(payload: AuthPayload): string[] {
	if (!('recoveryCodes' in payload) || !payload.recoveryCodes) return [];
	return payload.recoveryCodes.filter((code) => code.trim().length > 0);
}
