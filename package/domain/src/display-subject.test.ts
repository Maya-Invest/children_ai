import { describe, expect, test } from "bun:test";
import {
	displaySubjectLabel,
	formatProgrammeLine,
	listLearnerSubjects,
	subjectsMatch,
} from "./display-subject.ts";
import type { LearnerContext } from "./types.ts";

const context: LearnerContext = {
	student: {
		edayaStudentId: "ci-s1",
		firstName: "Léa",
		lastName: "Tremblay",
		grade: "6e",
		classLabel: "6ème 1",
	},
	academicYearId: "2025-ci",
	periodId: "ci-2025-t1",
	marks: [
		{
			id: "m1",
			subject: "MATH",
			title: "Fractions",
			score: 7,
			maxScore: 20,
			date: "2025-11-03",
		},
		{
			id: "m2",
			subject: "Français",
			title: "Lecture",
			score: 12,
			maxScore: 20,
			date: "2025-11-04",
		},
	],
	classProgress: [
		{ subject: "HG", subjectMatter: "L’Afrique", completedPercentage: 20 },
	],
	timetable: [],
	observations: [],
};

describe("displaySubjectLabel", () => {
	test("maps codes and accented names to the same French label", () => {
		expect(displaySubjectLabel("MATH")).toBe("Mathématiques");
		expect(displaySubjectLabel("Mathématiques")).toBe("Mathématiques");
		expect(displaySubjectLabel("FR")).toBe("Français");
		expect(displaySubjectLabel("Histoire-Géographie")).toBe("Histoire-Géographie");
	});

	test("treats MATH and Mathématiques as the same subject", () => {
		expect(subjectsMatch("MATH", "Mathématiques")).toBe(true);
		expect(subjectsMatch("FR", "SVT")).toBe(false);
	});

	test("lists unique learner subjects from marks and class progress", () => {
		expect(listLearnerSubjects(context)).toEqual([
			"Mathématiques",
			"Français",
			"Histoire-Géographie",
		]);
	});

	test("builds a programme line without hardcoding a single subject", () => {
		expect(formatProgrammeLine("6ème 1", [])).toBe(
			"6ème 1 · Programme officiel DPFC",
		);
		expect(formatProgrammeLine("6ème 1", ["Mathématiques", "Français"])).toBe(
			"6ème 1 · Mathématiques · Français · Programme officiel DPFC",
		);
		expect(
			formatProgrammeLine("6ème 1", ["A", "B", "C", "D", "E"]),
		).toBe("6ème 1 · Toutes les matières · Programme officiel DPFC");
	});
});
