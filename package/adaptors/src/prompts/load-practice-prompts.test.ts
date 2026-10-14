import { describe, expect, test } from "bun:test";
import { loadPracticePrompts, PRACTICE_PROMPT_VERSION } from "./load-practice-prompts.ts";

describe("practice prompt versions", () => {
	test("loads the active prompt and keeps version 1.0", async () => {
		expect(PRACTICE_PROMPT_VERSION).toBe("1.1");
		const prompts = await loadPracticePrompts();
		expect(prompts.version).toBe("1.1");
		expect(prompts.fill("focus-system")).toContain("Tu es un PLANIFICATEUR");
		const previous = await loadPracticePrompts("1.0");
		expect(previous.version).toBe("1.0");
		expect(previous.fill("focus-system")).toContain("Réponds uniquement en JSON.");
		expect(prompts.fill("exercise-user", {
			studentName: "Léa",
			classLabel: "6ème 1",
			grade: "6e",
			lessonTitle: "Fractions",
			themeTitle: "Nombres",
			plannedMinutes: "20",
			rationale: "Leçon du jour.",
			proposals: "comprehension (medium) — Comparer",
			skills: "Comparer",
			contents: "Fractions équivalentes",
		})).toContain("Durée recommandée pour cette série : 20 minutes.");
	});

	test("refuses a version that is not a prompt file", async () => {
		await expect(loadPracticePrompts("9.9")).rejects.toThrow(/inconnue/);
		await expect(loadPracticePrompts("../1.0")).rejects.toThrow(/invalide/);
	});
});
