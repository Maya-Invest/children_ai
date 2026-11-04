import { env } from "$env/dynamic/public";
import { getToken } from "./session";
import type { ExerciseSet, GuardianActor, HomePayload, PracticeTrackKind } from "./types";

const base = env.PUBLIC_API_URL ?? "http://localhost:8787";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
	const token = getToken();
	const headers = new Headers(init.headers);
	headers.set("Content-Type", "application/json");
	if (token) headers.set("Authorization", `Bearer ${token}`);

	const response = await fetch(`${base}${path}`, { ...init, headers });
	const body = await response.json().catch(() => ({}));
	if (!response.ok) {
		const error = new Error(body.message ?? body.error ?? "Erreur réseau") as Error & {
			code?: string;
			status: number;
		};
		error.code = body.error;
		error.status = response.status;
		throw error;
	}
	return body as T;
}

export function signInStudent(code: string) {
	return request<{ token: string }>(`/auth/student-code`, {
		method: "POST",
		body: JSON.stringify({ code }),
	});
}

export type DemoFamilyAuth = {
	token: string;
	actor: GuardianActor;
	guardian: { token: string; actor: GuardianActor };
};

export function loadDemoEnabled() {
	return request<{ demoEnabled?: boolean }>("/health").then((health) => health.demoEnabled === true);
}

export function signInDemo() {
	return request<DemoFamilyAuth>(`/auth/demo`, { method: "POST" });
}

export function loadHome() {
	return request<HomePayload>("/home");
}

export function generateSet(track: PracticeTrackKind = "revision", lessonId?: string) {
	return request<{ set: ExerciseSet }>("/exercise-sets/generate", {
		method: "POST",
		body: JSON.stringify({ track, lessonId }),
	});
}

export function loadSet(id: string) {
	return request<{ set: ExerciseSet }>(`/exercise-sets/${id}`);
}

export function submitSet(id: string, answers: { questionId: string; value: string }[]) {
	return request<{ set: ExerciseSet }>(`/exercise-sets/${id}/submit`, {
		method: "POST",
		body: JSON.stringify({ answers }),
	});
}

export function saveSetProgress(id: string, answers: { questionId: string; value: string }[]) {
	return request<{ set: ExerciseSet }>(`/exercise-sets/${id}/progress`, {
		method: "POST",
		body: JSON.stringify({ answers }),
	});
}
