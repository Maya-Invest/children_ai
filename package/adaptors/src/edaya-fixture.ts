import type { EdayaContextPort, LearnerContext, TimetableSlot } from "@children-ai/domain";
import {
	DEMO_FIXTURE_SCHOOL_ID,
	DEMO_FIXTURE_STUDENT_ID,
	EdayaContextFetchError,
} from "@children-ai/domain";

/** demo-ci École Cocody — same school id as EDAYA seed, isolated per palier DB. */
export const FIXTURE_SCHOOL_ID = DEMO_FIXTURE_SCHOOL_ID;
/** Aminata Koné, 6ème 1 (`ci-s1` in demo-ci). */
export const FIXTURE_STUDENT_ID = DEMO_FIXTURE_STUDENT_ID;
export const FIXTURE_ACADEMIC_YEAR_ID = "2025-ci";
export const FIXTURE_PERIOD_ID = "ci-2025-t1";

/** Same 6ème 1 week as demo-ci seed (`ci-6a` / Aminata). */
export const FIXTURE_TIMETABLE: TimetableSlot[] = [
	{
		id: "sch-ci-6a-math-mon",
		dayOfWeek: "monday",
		startTime: "08:15",
		endTime: "09:00",
		title: "Mathématiques — fractions",
		kind: "lesson",
	},
	{
		id: "sch-ci-6a-fr-mon",
		dayOfWeek: "monday",
		startTime: "09:15",
		endTime: "10:00",
		title: "Français — lecture",
		kind: "lesson",
	},
	{
		id: "sch-ci-6a-anglais-mon",
		dayOfWeek: "monday",
		startTime: "13:00",
		endTime: "14:00",
		title: "Conversation anglaise",
		kind: "activity",
	},
	{
		id: "sch-ci-6a-hg-tue",
		dayOfWeek: "tuesday",
		startTime: "08:15",
		endTime: "09:00",
		title: "Histoire-Géographie",
		kind: "lesson",
	},
	{
		id: "sch-ci-6a-svt-tue",
		dayOfWeek: "tuesday",
		startTime: "10:00",
		endTime: "10:45",
		title: "SVT",
		kind: "lesson",
	},
	{
		id: "sch-ci-6a-math-wed",
		dayOfWeek: "wednesday",
		startTime: "09:15",
		endTime: "10:00",
		title: "Mathématiques — géométrie",
		kind: "lesson",
	},
	{
		id: "sch-ci-6a-edhc-wed",
		dayOfWeek: "wednesday",
		startTime: "10:15",
		endTime: "11:00",
		title: "EDHC",
		kind: "lesson",
	},
	{
		id: "sch-ci-6a-ang-thu",
		dayOfWeek: "thursday",
		startTime: "08:15",
		endTime: "09:00",
		title: "Anglais",
		kind: "lesson",
	},
	{
		id: "sch-ci-6a-fr-thu",
		dayOfWeek: "thursday",
		startTime: "10:00",
		endTime: "10:45",
		title: "Français — expression",
		kind: "lesson",
	},
	{
		id: "sch-ci-6a-eps-fri",
		dayOfWeek: "friday",
		startTime: "08:15",
		endTime: "09:00",
		title: "EPS",
		kind: "lesson",
	},
	{
		id: "sch-ci-6a-svt-fri",
		dayOfWeek: "friday",
		startTime: "10:00",
		endTime: "10:45",
		title: "SVT",
		kind: "lesson",
	},
];

const AMINA: LearnerContext = {
	student: {
		edayaStudentId: FIXTURE_STUDENT_ID,
		firstName: "Aminata",
		lastName: "Koné",
		grade: "6e",
		classLabel: "6ème 1",
	},
	academicYearId: FIXTURE_ACADEMIC_YEAR_ID,
	periodId: FIXTURE_PERIOD_ID,
	marks: [
		{
			id: "asmt-entiers",
			subject: "Mathématiques",
			title: "Contrôle Nombres entiers naturels",
			score: 14,
			maxScore: 20,
			date: "2025-10-12",
		},
		{
			id: "asmt-fractions",
			subject: "Mathématiques",
			title: "Contrôle Fractions",
			score: 7,
			maxScore: 20,
			date: "2025-11-03",
		},
		{
			id: "asmt-lecture",
			subject: "Français",
			title: "Contrôle Lecture",
			score: 12,
			maxScore: 20,
			date: "2025-11-05",
		},
		{
			id: "asmt-afrique",
			subject: "Histoire-Géographie",
			title: "Contrôle L’Afrique",
			score: 11,
			maxScore: 20,
			date: "2025-11-07",
		},
	],
	rank: {
		rank: 18,
		classSize: 42,
		overallAverage: 11.4,
	},
	classProgress: [
		{ subject: "Mathématiques", subjectMatter: "Nombres entiers naturels", completedPercentage: 80 },
		{ subject: "Mathématiques", subjectMatter: "Fractions", completedPercentage: 45 },
		{ subject: "Mathématiques", subjectMatter: "Proportionnalité", completedPercentage: 10 },
		{ subject: "Français", subjectMatter: "Lecture", completedPercentage: 35 },
		{ subject: "Histoire-Géographie", subjectMatter: "L’Afrique", completedPercentage: 20 },
		{ subject: "SVT", subjectMatter: "Le vivant", completedPercentage: 25 },
	],
	timetable: FIXTURE_TIMETABLE,
	attendance: { presentRate: 0.92 },
	observations: [
		"Bon engagement en classe. Fractions encore fragiles ; lecture et cartes d’Afrique à consolider.",
	],
};

export class FixtureEdayaContext implements EdayaContextPort {
	async pullLearnerContext(query: {
		schoolId: string;
		studentId: string;
	}): Promise<LearnerContext> {
		if (query.schoolId !== FIXTURE_SCHOOL_ID || query.studentId !== FIXTURE_STUDENT_ID) {
			throw new EdayaContextFetchError(
				`Aucun contexte fixture pour ${query.schoolId}/${query.studentId}.`,
			);
		}
		return structuredClone(AMINA);
	}
}
