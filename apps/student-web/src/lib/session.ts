const TOKEN_KEY = "children-ai.token";
const GUARDIAN_TOKEN_KEY = "children-ai.guardian-token";
const DEMO_KEY = "children-ai.demo";

function storage(): Storage | null {
	if (typeof localStorage === "undefined") return null;
	return localStorage;
}

export function getToken(): string | null {
	return storage()?.getItem(TOKEN_KEY) ?? null;
}

export function setToken(token: string): void {
	storage()?.setItem(TOKEN_KEY, token);
}

export function getGuardianToken(): string | null {
	return storage()?.getItem(GUARDIAN_TOKEN_KEY) ?? null;
}

export function isDemoExplore(): boolean {
	return storage()?.getItem(DEMO_KEY) === "1" && Boolean(getGuardianToken());
}

export function startDemoGuardian(guardianToken: string): void {
	const store = storage();
	if (!store) return;
	store.removeItem(TOKEN_KEY);
	store.setItem(GUARDIAN_TOKEN_KEY, guardianToken);
	store.setItem(DEMO_KEY, "1");
}

export function clearDemoFamily(): void {
	const store = storage();
	if (!store) return;
	store.removeItem(GUARDIAN_TOKEN_KEY);
	store.removeItem(DEMO_KEY);
}

export function clearToken(): void {
	storage()?.removeItem(TOKEN_KEY);
}
