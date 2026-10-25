import { describe, expect, test } from "bun:test";
import { resolveSnapshotLesson, scanPracticeWindow, upcomingSnapshotLessons } from "./practice-window.ts";
import type { LearnerAcademicSnapshot, TimetableSlot } from "./types.ts";

const progress = [
	{ subject: "Français", subjectMatter: "Lecture et compréhension de textes narratifs et documentaires", completedPercentage: 40 },
	{ subject: "Physique-Chimie", subjectMatter: "Introduction aux forces et au mouvement", completedPercentage: 20, slotId: "forces" },
	{ subject: "Sciences de la Vie et de la Terre", subjectMatter: "Organisation du vivant : cellule et organismes", completedPercentage: 0 },
];

function slot(id: string, title: string, day: TimetableSlot["dayOfWeek"] = "monday"): TimetableSlot {
	return { id, dayOfWeek: day, startTime: "08:00", endTime: "09:00", title, kind: "lesson" };
}

const sixth = { label: "6ème", cycle: "Collège" };
const fifth = { label: "5ème", cycle: "Collège" };

describe("snapshot chapter resolution", () => {
	test("uses the official chapter named in the slot", () => {
		const lesson = resolveSnapshotLesson(
			slot("read", "Lecture et compréhension de textes narratifs et documentaires"),
			progress,
			sixth,
		);
		expect(lesson.subject).toBe("Français");
		expect(lesson.title).toBe("Lecture et compréhension de textes narratifs et documentaires");
		expect(lesson.id).toBe("read");
	});

	test("the next class continues the unfinished chapter of that subject", () => {
		const math = [
			{
				subject: "Mathématiques",
				subjectMatter: "Arithmétique : PGCD, PPCM, division euclidienne, nombres premiers",
				completedPercentage: 100,
			},
			{
				subject: "Mathématiques",
				subjectMatter: "Fractions : opérations simples, fractions équivalentes",
				completedPercentage: 45,
			},
			{
				subject: "Mathématiques",
				subjectMatter: "Géométrie plane : points, segments, droites sécantes, parallèles, perpendiculaires",
				completedPercentage: 0,
			},
		];
		const monday = resolveSnapshotLesson(slot("math-mon", "Mathématiques", "monday"), math, sixth);
		const tuesday = resolveSnapshotLesson(slot("math-tue", "Mathématiques", "tuesday"), math, sixth);
		expect(monday.subject).toBe("Mathématiques");
		expect(monday.title).toBe("Fractions : opérations simples, fractions équivalentes");
		expect(tuesday.title).toBe(monday.title);
		expect(tuesday.id).toBe("math-tue");
	});

	test("uses the slot anchor when the title does not name the chapter", () => {
		const lesson = resolveSnapshotLesson(slot("forces", "Physique-Chimie"), progress, fifth);
		expect(lesson.title).toBe("Introduction aux forces et au mouvement");
		expect(lesson.subject).toBe("Physique-Chimie");
		expect(lesson.grade).toBe("5ème");
		expect(lesson.cycle).toBe("Collège");
	});

	test("keeps a subject hour that names no chapter", () => {
		const lesson = resolveSnapshotLesson(slot("svt", "SVT"), progress, sixth);
		expect(lesson.title).toBe("SVT");
		expect(lesson.id).toBe("svt");
	});

	test("attaches an evaluation that names a timetable chapter and ignores one outside two weeks", () => {
		const timetable = [
			slot("read", "Lecture et compréhension de textes narratifs et documentaires", "monday"),
			slot("cell", "Organisation du vivant : cellule et organismes", "tuesday"),
		];
		const snapshot = {
			context: {
				student: { gradeLevel: { id: "demo-6eme", name: "Sixième", label: "6ème", order: 1, cycle: "Collège" } },
				timetable,
				classProgress: progress,
				upcomingAssessments: [
					{
						id: "near",
						subject: "Français",
						title: "Lecture et compréhension de textes narratifs et documentaires",
						kind: "homework",
						dueAt: "2026-10-16",
					},
					{
						id: "far",
						subject: "Sciences de la Vie et de la Terre",
						title: "Organisation du vivant : cellule et organismes",
						kind: "exam",
						dueAt: "2026-11-20",
					},
				],
			},
		} as LearnerAcademicSnapshot;
		const window = scanPracticeWindow(snapshot, new Date("2026-10-05T18:00:00.000Z"));
		const matches = upcomingSnapshotLessons(window, timetable, progress, sixth);
		expect(matches.map((match) => match.assessment.id)).toEqual(["near"]);
		expect(matches[0]?.lesson.subject).toBe("Français");
	});
});
