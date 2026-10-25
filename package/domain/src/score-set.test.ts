import { describe, expect, test } from "bun:test";
import { distinctMcqChoices, isAnswerCorrect, scoreExerciseSet } from "./score-set.ts";
import type { ExerciseSet } from "./types.ts";

const set: ExerciseSet = {
	id: "set-1",
	snapshotId: "snap",
	schoolId: "school",
	studentId: "stu",
	lessonId: "lesson",
	generatedAt: "2026-09-13T00:00:00.000Z",
	generator: "stub",
	promptVersion: "stub-v1",
	questions: [
		{
			id: "q-mcq",
			prompt: "Combien font 1/2 + 1/2 ?",
			kind: "mcq",
			choices: ["1", "1/4", "2"],
			expectedAnswer: "1",
		},
		{
			id: "q-written",
			prompt: "Écris une égalité.",
			kind: "written",
			expectedAnswer: "MA = MB",
		},
	],
};

describe("scoreExerciseSet", () => {
	test("scores MCQ exactly and written answers with light normalization", () => {
		expect(isAnswerCorrect(set.questions[0]!, "1")).toBe(true);
		expect(isAnswerCorrect(set.questions[0]!, "1/4")).toBe(false);
		expect(isAnswerCorrect(set.questions[1]!, "ma = mb")).toBe(true);
		expect(scoreExerciseSet(set, [
			{ questionId: "q-mcq", value: "1" },
			{ questionId: "q-written", value: "Donc MA = MB." },
		])).toEqual({ correct: 2, total: 2 });
	});
});

describe("distinctMcqChoices", () => {
	test("keeps the first copy of a repeated choice", () => {
		const codes = "Le code historique, le code gestuel";
		expect(distinctMcqChoices(
			[codes, "Un seul code", `  ${codes}  `, "Aucun code"],
			codes,
		)).toEqual({
			choices: [codes, "Un seul code", "Aucun code"],
			expectedAnswer: codes,
		});
	});

	test("rejects a QCM that collapses to one choice", () => {
		const codes = "Le code historique, le code gestuel";
		expect(distinctMcqChoices([codes, codes, ` ${codes}`], codes)).toBeUndefined();
	});
});
