import { parentApiFetch } from './auth/bearer-fetch';
import type { GuardianChildView, HomePayload, ParentChildrenPayload } from './types';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
	const headers = new Headers(init.headers);
	headers.set('Content-Type', 'application/json');
	const response = await parentApiFetch(path, { ...init, headers });
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
