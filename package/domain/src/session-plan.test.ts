import { describe, expect, test } from "bun:test";
import {
	composeSessionPlan,
	emptySessionPlan,
	exerciseProposalInstruction,
	plannedQuestionCount,
	questionCountForMinutes,
	questionTargetForMinutes,
	withSessionSummary,
} from "./session-plan.ts";
import { NOTHING_TO_PRACTICE_MESSAGE } from "./types.ts";
import type { CurriculumLesson, LearnerAcademicSnapshot, UpcomingAssessment } from "./types.ts";

function lesson(title: string, subject = "MATH"): CurriculumLesson {
	return {
		id: "l-frac",
		packVersion: "pack",
		country: "CI",
		cycle: "college",
		grade: "6e",
		subject,
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
				lastName: "Mercier",
				gradeLevel: { id: "demo-6eme", name: "Sixième", label: "6ème", order: 1, cycle: "Collège" },
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

describe("questionCountForMinutes", () => {
	test("asks for about one question every 3 to 4 minutes", () => {
		expect(questionCountForMinutes(10)).toBe(3);
		expect(questionCountForMinutes(15)).toBe(4);
		expect(questionCountForMinutes(20)).toBe(6);
		expect(questionCountForMinutes(30)).toBe(9);
	});
});

describe("plannedQuestionCount", () => {
	test("sums the questions the generator will write for each proposal", () => {
		expect(plannedQuestionCount([
			{ objective: "Comparer", theme: "Nombres", exerciseType: "comprehension", difficulty: "medium", minutes: 20, promptHint: "Comparer" },
		])).toBe(6);
		expect(plannedQuestionCount([
			{ objective: "Comparer", theme: "Nombres", exerciseType: "comprehension", difficulty: "medium", minutes: 15, promptHint: "Comparer" },
			{ objective: "Additionner", theme: "Nombres", exerciseType: "application", difficulty: "medium", minutes: 10, promptHint: "Additionner" },
		])).toBe(7);
	});
});

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
	test("names the lesson and the homework without the durations", () => {
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
		const due = homework("2026-10-08");
		const title = due.title.charAt(0).toLocaleLowerCase("fr") + due.title.slice(1);
		expect(plan.summary).toBe(
			`La révision du jour reprend la leçon de fractions en mathématiques. Le devoir intitulé ${title} est aussi à préparer pour le 8 octobre.`,
		);
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
		expect(plan.summary).toBe("La révision du jour reprend la leçon de fractions en mathématiques.");
		expect(plan.tracks[1]).toMatchObject({ kind: "homework", available: false, minutes: 0 });
	});

	test("names each lesson of the day and keeps the duration off the sentence", () => {
		const plan = composeSessionPlan({
			snapshot: snapshot(),
			revisions: [
				{ ...revision, lesson: lesson("Compréhension orale", "Anglais"), minutes: 30 },
				{ ...revision, lesson: lesson("Les solides", "Physique-Chimie"), minutes: 25 },
				{ ...revision, lesson: lesson("La cellule", "SVT"), minutes: 25 },
				{ ...revision, lesson: lesson("Fractions", "Mathématiques"), minutes: 30 },
			],
			homework: null,
		});
		expect(plan.totalMinutes).toBe(110);
		expect(plan.summary).toBe(
			"La révision du jour reprend la leçon de compréhension orale en anglais, des solides en physique-chimie, de la cellule en SVT et de fractions en mathématiques.",
		);
	});

	test("names the homework alone when no lesson is planned today", () => {
		const due = homework("2026-10-08");
		const plan = composeSessionPlan({
			snapshot: snapshot(),
			revision: null,
			homework: {
				focus: { ...revision.focus, intent: "upcoming_work" },
				lesson: fractions,
				assessment: due,
				minutes: 40,
			},
		});
		const title = due.title.charAt(0).toLocaleLowerCase("fr") + due.title.slice(1);
		expect(plan.summary).toBe(
			`Aucun cours n'est prévu aujourd'hui. Le devoir intitulé ${title} est à préparer pour le 8 octobre.`,
		);
	});

	test("rewrites a stored budget sentence from the lessons on the plan", () => {
		const plan = composeSessionPlan({
			snapshot: snapshot(),
			revision: { ...revision, minutes: 120 },
			homework: null,
		});
		const stored = { ...plan, summary: "Fin de journée : 2 h. Les 2 h préparent Mathématiques." };
		expect(withSessionSummary(stored).summary).toBe(
			"La révision du jour reprend la leçon de fractions en mathématiques.",
		);
	});

	test("states the empty timetable in one sentence", () => {
		expect(emptySessionPlan().summary).toBe(NOTHING_TO_PRACTICE_MESSAGE);
		expect(emptySessionPlan().tracks.every((track) => track.available === false)).toBe(true);
	});
});
