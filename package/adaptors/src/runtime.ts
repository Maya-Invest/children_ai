import type { Clock, IdGenerator } from "@children-ai/domain";

export class SystemClock implements Clock {
	nowIso(): string {
		return new Date().toISOString();
	}
}

const FIXTURE_TODAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function createRuntimeClock(input: {
	contextMode: "fixture" | "http";
	fixtureToday?: string;
}): Clock {
	const raw = input.fixtureToday?.trim() ?? "";
	if (input.contextMode !== "fixture" || raw === "") return new SystemClock();
	const instant = Date.parse(`${raw}T18:00:00.000Z`);
	if (!FIXTURE_TODAY_PATTERN.test(raw) || Number.isNaN(instant)) {
		throw new Error("FIXTURE_TODAY doit être une date AAAA-MM-JJ.");
	}
	return { nowIso: () => `${raw}T18:00:00.000Z` };
}

export class CryptoIdGenerator implements IdGenerator {
	next(): string {
		return crypto.randomUUID();
	}
}
