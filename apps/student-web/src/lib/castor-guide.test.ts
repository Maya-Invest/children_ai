/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { CASTOR_SEEN_KEY, allGuideIds, guideFor, readSeen, remember, rememberAll } from "./castor-guide";

function memory(): Storage {
	const values = new Map<string, string>();
	return {
		get length() {
			return values.size;
		},
		clear() {
			values.clear();
		},
		getItem(key: string) {
			return values.get(key) ?? null;
		},
		key(index: number) {
			return [...values.keys()][index] ?? null;
		},
		removeItem(key: string) {
			values.delete(key);
		},
		setItem(key: string, value: string) {
			values.set(key, value);
		},
	};
}

describe("guideFor", () => {
	test("speaks on the student journey", () => {
		expect(guideFor("/")?.id).toBe("accueil");
		expect(guideFor("/student")?.id).toBe("code");
		expect(guideFor("/app")?.id).toBe("serie");
		expect(guideFor("/app/")?.id).toBe("serie");
		expect(guideFor("/app/sets/abc")?.id).toBe("serie");
		expect(guideFor("/app/sets/abc/question/2")?.id).toBe("question");
		expect(guideFor("/app/corriges/set-1")?.id).toBe("corrige");
		expect(guideFor("/app/corriges/set-1/filtre/all")?.id).toBe("corrige");
	});

	test("stays quiet on parent, stats, and history", () => {
		expect(guideFor("/parent")).toBeNull();
		expect(guideFor("/parent/login")).toBeNull();
		expect(guideFor("/app/stats")).toBeNull();
		expect(guideFor("/app/history")).toBeNull();
	});

	test("keeps the hint shorter than the tour and free of an answer", () => {
		const question = guideFor("/app/sets/abc/question/1");
		expect(question?.tour.includes("sans la réponse")).toBe(true);
		expect(question && question.hint.length < question.tour.length).toBe(true);
	});
});

describe("seen memory", () => {
	test("remembers one screen, then every screen", () => {
		const storage = memory();
		expect(readSeen(storage)).toEqual([]);
		expect(remember(storage, "accueil")).toEqual(["accueil"]);
		expect(remember(storage, "accueil")).toEqual(["accueil"]);
		expect(rememberAll(storage)).toEqual(allGuideIds());
		expect(readSeen(storage)).toEqual(allGuideIds());
		expect(storage.getItem(CASTOR_SEEN_KEY)).toContain("question");
	});

	test("ignores a broken stored value", () => {
		const storage = memory();
		storage.setItem(CASTOR_SEEN_KEY, "{");
		expect(readSeen(storage)).toEqual([]);
	});
});
