import { describe, expect, test } from "bun:test";
import {
	composeSessionPlan,
	emptySessionPlan,
	exerciseProposalInstruction,
	questionTargetForMinutes,
} from "./session-plan.ts";
import { NOTHING_TO_PRACTICE_MESSAGE } from "./types.ts";
import type { CurriculumLesson, LearnerAcademicSnapshot, UpcomingAssessment } from "./types.ts";

function lesson(title: string): CurriculumLesson {
	return {
		id: "l-frac",
		packVersion: "pack",
		country: "CI",
		cycle: "college",
		grade: "6e",
		subject: "MATH",
		competence: { id: "c1", title: "Calculs" },
		theme: { id: "t1", title: "Nombres" },
		title,
		sequence: 3,
		exampleSituation: "En classe.",
		skills: ["Comparer"],
		contents: [title],
		sourcePdf: "01.pdf",
	};
}

function snapshot(): LearnerAcademicSnapshot {
	return {
		id: "snap-1",
		schoolId: "school",
		studentId: "ci-s1",
		fingerprint: "abc",
		packVersion: "pack",
		createdAt: "2026-10-05T08:00:00.000Z",
		context: {
			student: {
				edayaStudentId: "ci-s1",
				firstName: "Léa",
				lastName: "Tremblay",
				grade: "6e",
				classLabel: "6ème 1",
			},
			academicYearId: "2025-ci",
			periodId: "T1",
			marks: [
				{
					id: "math",
					subject: "Mathématiques",
					title: "Contrôle Fractions",
					score: 7,
					maxScore: 20,
					date: "2025-11-03",
				},
			],
			classProgress: [],
			timetable: [],
			observations: [],
		},
	};
}

const fractions = lesson("Fractions");
const revision = {
	focus: {
		lessonId: fractions.id,
		subject: "MATH",
		rationale: "Note faible.",
		brief: "Réviser les fractions.",
		intent: "prepare_next_day" as const,
		proposals: [
			{
				objective: "Comparer",
				theme: "Nombres",
				exerciseType: "comprehension",
				difficulty: "medium",
				minutes: 40,
				promptHint: "Comparer deux fractions",
			},
		],
	},
	lesson: fractions,
};

function homework(dueAt: string): UpcomingAssessment {
	return {
		id: "hw",
		subject: "Mathématiques",
		title: "Feuille d’exercices",
		kind: "homework",
		dueAt,
	};
}

describe("questionTargetForMinutes", () => {
	test("scales a series with its duration", () => {
		expect(questionTargetForMinutes(40)).toEqual({ total: 3, mcq: 2, written: 1 });
		expect(questionTargetForMinutes(60)).toEqual({ total: 4, mcq: 2, written: 2 });
		expect(questionTargetForMinutes(80)).toEqual({ total: 5, mcq: 3, written: 2 });
		expect(questionTargetForMinutes(120)).toEqual({ total: 6, mcq: 3, written: 3 });
	});
});

describe("exerciseProposalInstruction", () => {
	test("asks for one question per proposition", () => {
		expect(exerciseProposalInstruction(revision.focus.proposals)).toContain("exactement 1 question");
		expect(exerciseProposalInstruction(revision.focus.proposals)).toContain("Comparer deux fractions");
	});
});

describe("composeSessionPlan", () => {
	test("names both series from minutes it is given and keeps the day at 2 h", () => {
		const plan = composeSessionPlan({
			snapshot: snapshot(),
			revision: { ...revision, minutes: 40 },
			homework: {
				focus: { ...revision.focus, intent: "upcoming_work" },
				lesson: fractions,
				assessment: homework("2026-10-08"),
				minutes: 80,
			},
		});
		expect(plan.totalMinutes).toBe(120);
		expect(plan.summary).toContain("Fin de journée : 2 h.");
		expect(plan.summary).toContain("40 min pour préparer « Fractions »");
		expect(plan.summary).toContain("1 h 20");
		expect(plan.summary).toContain("devoir");
		expect(plan.tracks.map((track) => track.minutes)).toEqual([40, 80]);
		expect(plan.tracks[0]?.focus?.intent).toBe("prepare_next_day");
		expect(plan.tracks[1]?.focus?.intent).toBe("upcoming_work");
	});

	test("gives the whole day to revision when no evaluation is passed", () => {
		const plan = composeSessionPlan({
			snapshot: snapshot(),
			revision: { ...revision, minutes: 120 },
			homework: null,
		});
		expect(plan.summary).toContain("aujourd'hui et demain");
		expect(plan.summary).toContain("Fractions");
		expect(plan.tracks[1]).toMatchObject({ kind: "homework", available: false, minutes: 0 });
	});

	test("states the empty timetable in one sentence", () => {
		expect(emptySessionPlan().summary).toBe(NOTHING_TO_PRACTICE_MESSAGE);
		expect(emptySessionPlan().tracks.every((track) => track.available === false)).toBe(true);
	});
});
