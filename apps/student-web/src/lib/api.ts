import { env } from "$env/dynamic/public";
import { getToken } from "./session";
import type { ExerciseSet, HomePayload } from "./types";

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

export function loadHome() {
	return request<HomePayload>("/home");
}

export function generateSet() {
	return request<{ set: ExerciseSet }>("/exercise-sets/generate", { method: "POST" });
}

export function loadSet(id: string) {
	return request<{ set: ExerciseSet }>(`/exercise-sets/${id}`);
}
