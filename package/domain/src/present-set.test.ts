import { describe, expect, test } from "bun:test";
import { presentExerciseSet } from "./present-set.ts";
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
	submittedAt: "2026-09-13T01:00:00.000Z",
	answers: [{ questionId: "q1", value: "MA = MB" }],
	score: { correct: 1, total: 1 },
	questions: [
		{
			id: "q1",
			prompt: "Quelle égalité ?",
			kind: "written",
			expectedAnswer: "MA = MB",
		},
	],
};

describe("presentExerciseSet", () => {
	test("hides the expected answer from the student until the parent releases it", () => {
		const hidden = presentExerciseSet(set, "student");
		expect(hidden.questions[0]?.expectedAnswer).toBeUndefined();
		expect(hidden.score).toBeUndefined();

		const released = presentExerciseSet(
			{ ...set, correctionReleasedAt: "2026-09-13T02:00:00.000Z" },
			"student",
		);
		expect(released.questions[0]?.expectedAnswer).toBe("MA = MB");
		expect(released.score).toEqual({ correct: 1, total: 1 });
	});

	test("keeps per-question verdicts off the student view until the parent releases the corrigé", () => {
		const pending = presentExerciseSet(
			{
				...set,
				answers: [{ questionId: "q1", value: "non" }],
			},
			"student",
		);
		expect(pending.questions[0]?.correct).toBeUndefined();
		expect(pending.questions[0]?.expectedAnswer).toBeUndefined();

		const released = presentExerciseSet(
			{
				...set,
				correctionReleasedAt: "2026-09-13T02:00:00.000Z",
				answers: [{ questionId: "q1", value: "non" }],
			},
			"student",
		);
		expect(released.questions[0]?.correct).toBe(false);
		expect(released.questions[0]?.expectedAnswer).toBe("MA = MB");

		const guardian = presentExerciseSet(
			{
				...set,
				answers: [{ questionId: "q1", value: "ma = mb" }],
			},
			"guardian",
		);
		expect(guardian.questions[0]?.correct).toBe(true);
		expect(guardian.questions[0]?.expectedAnswer).toBe("MA = MB");
	});

	test("keeps an unanswered question separate from an incorrect answer", () => {
		const unanswered = presentExerciseSet(
			{
				...set,
				answers: [{ questionId: "q1", value: "   " }],
				score: { correct: 0, total: 1 },
				correctionReleasedAt: "2026-09-13T02:00:00.000Z",
			},
			"guardian",
		);

		expect(unanswered.questions[0]?.answered).toBe(false);
		expect(unanswered.questions[0]?.correct).toBeUndefined();
		expect(unanswered.questions[0]?.expectedAnswer).toBe("MA = MB");
		expect(unanswered.score).toBeUndefined();
	});

	test("does not fabricate verdicts or a score when a legacy set has no expected answers", () => {
		const legacy = presentExerciseSet(
			{
				...set,
				questions: [{ id: "q1", prompt: "Ancienne question", kind: "written" }],
				answers: [{ questionId: "q1", value: "Une réponse" }],
				score: { correct: 0, total: 1 },
			},
			"guardian",
		);

		expect(legacy.questions[0]?.answered).toBe(true);
		expect(legacy.questions[0]?.correct).toBeUndefined();
		expect(legacy.questions[0]?.expectedAnswer).toBeUndefined();
		expect(legacy.score).toBeUndefined();
	});
});
