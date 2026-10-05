import { describe, expect, test } from "bun:test";
import { suggestFocus } from "./suggest-focus.ts";
import type { CurriculumLesson, LearnerAcademicSnapshot } from "./types.ts";

function lesson(
	overrides: Partial<CurriculumLesson> & Pick<CurriculumLesson, "id" | "title" | "sequence">,
): CurriculumLesson {
	return {
		packVersion: "pack",
		country: "CI",
		cycle: "college",
		grade: "6e",
		subject: "MATH",
		competence: { id: "c1", title: "Calculs" },
		theme: { id: "t1", title: "Nombres" },
		exampleSituation: "En classe.",
		skills: ["Comparer"],
		contents: [overrides.title],
		sourcePdf: "01.pdf",
		...overrides,
	};
}

function snapshot(overrides: Partial<LearnerAcademicSnapshot["context"]> = {}): LearnerAcademicSnapshot {
	return {
		id: "snap-1",
		schoolId: "school",
		studentId: "ci-s1",
		fingerprint: "abc",
		packVersion: "pack",
		createdAt: "2026-09-14T10:00:00.000Z",
		context: {
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
		},
	};
}

const fractions = lesson({
	id: "l-frac",
	title: "Fractions",
	sequence: 3,
});
const entiers = lesson({
	id: "l-entiers",
	title: "Nombres entiers naturels",
	sequence: 1,
});

describe("suggestFocus", () => {
	test("skips a weak mark when no official pack exists for that subject", () => {
		const focus = suggestFocus(
			snapshot({
				marks: [
					{
						id: "fr",
						subject: "Français",
						title: "Dictée",
						score: 4,
						maxScore: 20,
						date: "2025-11-01",
					},
					{
						id: "math",
						subject: "MATH",
						title: "Contrôle Fractions",
						score: 7,
						maxScore: 20,
						date: "2025-11-03",
					},
				],
			}),
			[entiers, fractions],
		);
		expect(focus.lessonId).toBe("l-frac");
		expect(focus.subject).toBe("MATH");
		expect(focus.rationale).toContain("Mathématiques");
		expect(focus.rationale).toContain("Fractions");
		expect(focus.rationale).not.toContain("Dictée");
		expect(focus.rationale).not.toContain("MATH «");
		expect(focus.brief).toContain("Compte tenu de tes résultats");
		expect(focus.brief).toContain("Fractions");
		expect(focus.intent).toBe("improve_results");
	});

	test("uses the soonest upcoming homework when the parent chooses that focus", () => {
		const focus = suggestFocus(
			snapshot({
				marks: [
					{
						id: "math",
						subject: "MATH",
						title: "Contrôle Nombres entiers naturels",
						score: 4,
						maxScore: 20,
						date: "2025-11-03",
					},
				],
				upcomingAssessments: [
					{
						id: "exam",
						subject: "MATH",
						title: "Examen Fractions",
						kind: "exam",
						dueAt: "2026-10-20",
					},
					{
						id: "hw",
						subject: "MATH",
						title: "Devoir Fractions",
						kind: "homework",
						dueAt: "2026-10-08",
					},
				],
			}),
			[entiers, fractions],
			{ intent: "upcoming_work", now: new Date("2026-10-05T08:00:00.000Z") },
		);
		expect(focus.lessonId).toBe("l-frac");
		expect(focus.intent).toBe("upcoming_work");
		expect(focus.brief).toContain("devoir");
		expect(focus.brief).toContain("série d'exercices suggérée");
		expect(focus.brief).not.toContain("Nombres entiers");
	});

	test("revises the next official lesson on the timetable", () => {
		const geometry = lesson({
			id: "l-droites",
			title: "Droites et points",
			sequence: 8,
			theme: { id: "geo", title: "Géométrie du plan" },
		});
		const focus = suggestFocus(
			snapshot({
				timetable: [
					{
						id: "hg",
						dayOfWeek: "tuesday",
						startTime: "08:15",
						endTime: "09:00",
						title: "Histoire-Géographie",
						kind: "lesson",
					},
					{
						id: "math",
						dayOfWeek: "wednesday",
						startTime: "09:15",
						endTime: "10:00",
						title: "Mathématiques — géométrie",
						kind: "lesson",
					},
				],
			}),
			[entiers, fractions, geometry],
			{ intent: "prepare_next_day", now: new Date("2026-10-05T08:00:00.000Z") },
		);
		expect(focus.lessonId).toBe("l-droites");
		expect(focus.brief.startsWith("Mercredi")).toBe(true);
		expect(focus.brief).toContain("Mathématiques — géométrie");
		expect(focus.brief).toContain("Droites et points");
	});
});
