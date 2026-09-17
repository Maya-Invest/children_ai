import { parentApiFetch } from './auth/bearer-fetch';
import { env } from '$env/dynamic/public';
import { getGuardianToken, isDemoExplore } from './session';
import type { ExerciseSet, GuardianChildView, HomePayload, ParentChildrenPayload } from './types';

const base = env.PUBLIC_API_URL ?? 'http://localhost:8787';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
	const headers = new Headers(init.headers);
	headers.set('Content-Type', 'application/json');
	let response: Response;
	if (isDemoExplore()) {
		const token = getGuardianToken();
		if (token) headers.set('Authorization', `Bearer ${token}`);
		response = await fetch(`${base}${path}`, { ...init, headers });
	} else {
		response = await parentApiFetch(path, { ...init, headers });
	}
	const body = await response.json().catch(() => ({}));
	if (!response.ok) {
		const error = new Error(body.message ?? body.error ?? 'Erreur réseau') as Error & {
			code?: string;
			status: number;
		};
		error.code = body.error;
		error.status = response.status;
		throw error;
	}
	return body as T;
}

export function loadParentChildren() {
	return request<ParentChildrenPayload>('/parent/children');
}

export function loadParentChild(studentId: string) {
	return request<HomePayload & { child: GuardianChildView }>(`/parent/children/${studentId}`);
}

export function issueChildAccessCode(studentId: string) {
	return request<{ code: string; hint: string; studentId: string }>(
		`/parent/children/${studentId}/access-codes`,
		{ method: 'POST' },
	);
}

export function revokeChildAccessCode(studentId: string) {
	return request<{ ok: true }>(`/parent/children/${studentId}/access-codes/revoke`, {
		method: 'POST',
	});
}

export function releaseChildCorrection(studentId: string, setId?: string) {
	return request<{ set: ExerciseSet }>(`/parent/children/${studentId}/correction/release`, {
		method: 'POST',
		body: JSON.stringify(setId ? { setId } : {}),
	});
}

export function updateChildPracticeSettings(studentId: string, autoReleaseCorrection: boolean) {
	return request<{ settings: { autoReleaseCorrection: boolean } }>(
		`/parent/children/${studentId}/practice-settings`,
		{
			method: 'POST',
			body: JSON.stringify({ autoReleaseCorrection }),
		},
	);
}
