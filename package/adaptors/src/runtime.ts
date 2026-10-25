import type { Clock, IdGenerator } from "@edaya-spark/domain";

export class SystemClock implements Clock {
	nowIso(): string {
		return new Date().toISOString();
	}
}

const FIXTURE_TODAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const PRACTICE_WEEKDAY_UTC: Record<string, number> = {
	dimanche: 0,
	lundi: 1,
	mardi: 2,
	mercredi: 3,
	jeudi: 4,
	vendredi: 5,
	samedi: 6,
};

export function createRuntimeClock(input: {
	contextMode: "fixture" | "http";
	fixtureToday?: string;
	practiceWeekday?: string;
}): Clock {
	const base = createBaseClock(input);
	const utcDay = practiceWeekdayUtc(input.practiceWeekday);
	if (utcDay === null) return base;
	return { nowIso: () => shiftIsoToSchoolWeekday(base.nowIso(), utcDay) };
}

function createBaseClock(input: {
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

function practiceWeekdayUtc(raw: string | undefined): number | null {
	const name = raw?.trim().toLowerCase() ?? "";
	if (name === "") return null;
	const utcDay = PRACTICE_WEEKDAY_UTC[name];
	if (utcDay === undefined) {
		throw new Error(
			"PRACTICE_WEEKDAY doit être vide, ou lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche.",
		);
	}
	return utcDay;
}

function shiftIsoToSchoolWeekday(iso: string, utcDay: number): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	const current = (date.getUTCDay() + 6) % 7;
	const target = (utcDay + 6) % 7;
	date.setUTCDate(date.getUTCDate() + (target - current));
	return date.toISOString();
}

export class CryptoIdGenerator implements IdGenerator {
	next(): string {
		return crypto.randomUUID();
	}
}
