/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { breakdownScore } from "./revision-stats";
import type { ExerciseSet } from "./types";

function series(input: Partial<ExerciseSet> & Pick<ExerciseSet, "id">): ExerciseSet {
	return {
		snapshotId: "snap",
		lessonId: "lesson",
		generatedAt: "2026-10-05T18:00:00.000Z",
		generator: "llm",
		questions: [],
		...input,
	};
}

describe("breakdownScore", () => {
	test("splits a released score by track and question kind", () => {
		const breakdown = breakdownScore([
			series({
				id: "rev",
				track: "revision",
				lessonId: "math",
				submittedAt: "2026-10-06T18:00:00.000Z",
				correctionReleasedAt: "2026-10-06T19:00:00.000Z",
				score: { correct: 2, total: 3 },
				questions: [
					{ id: "q1", prompt: "a", kind: "mcq", correct: true },
					{ id: "q2", prompt: "b", kind: "mcq", correct: false },
					{ id: "q3", prompt: "c", kind: "written", correct: true },
				],
			}),
			series({
				id: "hw",
				track: "homework",
				submittedAt: "2026-10-04T18:00:00.000Z",
				correctionReleasedAt: null,
				questions: [{ id: "q4", prompt: "d", kind: "written" }],
			}),
		], [
			{ lessonId: "math", lessonTitle: "Fractions", subjectLabel: "Mathématiques" },
		]);

		expect(breakdown.hasScored).toBe(true);
		expect(breakdown.overall).toEqual({ correct: 2, total: 3, percent: 67 });
		expect(breakdown.byTrack.revision).toEqual({ correct: 2, total: 3, percent: 67 });
		expect(breakdown.byTrack.homework).toEqual({ correct: 0, total: 0, percent: null });
		expect(breakdown.byKind.mcq).toEqual({ correct: 1, total: 2, percent: 50 });
		expect(breakdown.byKind.written).toEqual({ correct: 1, total: 1, percent: 100 });
		expect(breakdown.series.map((row) => row.id)).toEqual(["rev", "hw"]);
		expect(breakdown.series[0]).toMatchObject({
			lessonTitle: "Fractions",
			subjectLabel: "Mathématiques",
			scored: true,
		});
		expect(breakdown.series[1]?.scored).toBe(false);
	});
});
