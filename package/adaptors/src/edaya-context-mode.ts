import type { Palier } from "@children-ai/domain";

export const LOCAL_FIXTURE_KEY = "sk_live_local_fixture_not_for_prod";

export type EdayaContextMode = "fixture" | "http";

export function isSeedingApiKey(apiKey: string): boolean {
	return apiKey.includes("_seeding_");
}

export function isLocalFixtureApiKey(apiKey: string): boolean {
	return apiKey === LOCAL_FIXTURE_KEY;
}

export function assertChildrenAiApiKey(apiKey: string): void {
	const trimmed = apiKey.trim();
	if (!trimmed) return;
	if (isSeedingApiKey(trimmed)) {
		throw new Error(
			"Do not use the EDAYA seeding key as the children-ai school key.",
		);
	}
}

export function assertProdRejectsDemoSeed(
	palier: Palier,
	input: { demoApiKey?: string; seedDemoSchool?: boolean } = {},
): void {
	if (palier !== "prod") return;
	if (input.seedDemoSchool || input.demoApiKey?.trim()) {
		throw new Error(
			"EDAYA_DEMO_API_KEY must not be set on palier prod. Mint per-school children-ai keys into that palier's vault.",
		);
	}
}

export function resolveEdayaContextMode(
	palier: Palier,
	configured: string | undefined,
	apiKey: string | undefined,
): EdayaContextMode {
	const explicit = configured?.trim().toLowerCase();
	if (explicit === "fixture" || explicit === "http") {
		if (palier === "prod" && explicit === "fixture") {
			throw new Error("EDAYA_CONTEXT=fixture is not allowed on palier prod.");
		}
		return explicit;
	}
	if (palier === "prod") return "http";
	if (palier === "in-memory") return "fixture";
	const key = apiKey?.trim() ?? "";
	if (!key || isLocalFixtureApiKey(key)) return "fixture";
	return "http";
}
