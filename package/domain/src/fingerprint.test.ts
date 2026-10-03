import { describe, expect, test } from "bun:test";
import { snapshotFingerprint } from "./fingerprint.ts";
import type { LearnerContext } from "./types.ts";

function context(overrides: Partial<LearnerContext> = {}): LearnerContext {
	return {
		student: {
			edayaStudentId: "ci-s1",
			firstName: "Léa",
			lastName: "Tremblay",
			grade: "6e",
			classLabel: "6ème 1",
		},
		academicYearId: "2025-ci",
		periodId: "ci-2025-t1",
		marks: [],
		classProgress: [],
		timetable: [],
		observations: [],
		...overrides,
	};
}

describe("snapshotFingerprint", () => {
	test("changes when the weekly timetable is published", () => {
		const empty = snapshotFingerprint(context(), "pack");
		const published = snapshotFingerprint(
			context({
				timetable: [
					{
						id: "sch-ci-6a-math-mon",
						dayOfWeek: "monday",
						startTime: "08:15",
						endTime: "09:00",
						title: "Mathématiques — fractions",
						kind: "lesson",
					},
				],
			}),
			"pack",
		);
		expect(published).not.toBe(empty);
	});

	test("treats a missing timetable the same as an empty one", () => {
		const missing = snapshotFingerprint(
			{ ...context(), timetable: undefined as never },
			"pack",
		);
		expect(missing).toBe(snapshotFingerprint(context(), "pack"));
	});
});
