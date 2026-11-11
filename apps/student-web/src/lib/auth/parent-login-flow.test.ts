/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { moveAfterAuth } from './parent-login-flow';

describe('moveAfterAuth', () => {
	test('opens the parent home when the session is already complete', () => {
		expect(moveAfterAuth({ state: 'complete', user: { id: 'account' } })).toEqual({ type: 'signed-in' });
		expect(moveAfterAuth({ state: 'linked' })).toEqual({ type: 'signed-in' });
	});

	test('asks for an authenticator code when one is already enrolled', () => {
		expect(moveAfterAuth({ state: 'totp_required', challenge: 'pending' })).toEqual({
			type: 'challenge',
			phase: 'totp',
			challenge: 'pending',
			secret: '',
		});
	});

	test('fetches a secret when enrollment has not started', () => {
		expect(moveAfterAuth({ state: 'enrollment_required', challenge: 'pending' })).toEqual({
			type: 'needs-enrollment',
			challenge: 'pending',
		});
	});

	test('shows the secret once enrollment returns it', () => {
		expect(moveAfterAuth({
			state: 'enrollment_required',
			challenge: 'pending',
			secret: 'SECRET',
		})).toEqual({
			type: 'challenge',
			phase: 'enrollment',
			challenge: 'pending',
			secret: 'SECRET',
		});
	});

	test('holds recovery codes before entering the parent home', () => {
		expect(moveAfterAuth({ state: 'complete', recoveryCodes: ['one', 'two'] })).toEqual({
			type: 'recovery',
			codes: ['one', 'two'],
		});
	});

	test('finishes registration when the account is eligible', () => {
		expect(moveAfterAuth({
			state: 'registration_required',
			challenge: 'pending',
			proof: 'proof',
			eligible: true,
		})).toEqual({
			type: 'register',
			challenge: 'pending',
			proof: 'proof',
			eligible: true,
		});
	});

	test('keeps an ineligible registration from opening a session', () => {
		expect(moveAfterAuth({
			state: 'registration_required',
			challenge: 'pending',
			proof: 'proof',
			eligible: false,
		})).toEqual({
			type: 'register',
			challenge: 'pending',
			proof: 'proof',
			eligible: false,
		});
	});

	test('stops when a success body has no next step', () => {
		expect(moveAfterAuth({ state: 'primary_required' })).toEqual({ type: 'incomplete' });
		expect(moveAfterAuth({ state: 'enrollment_required' })).toEqual({ type: 'incomplete' });
	});
});
