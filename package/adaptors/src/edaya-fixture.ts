import type { EdayaContextPort, LearnerContext, TimetableSlot } from "@children-ai/domain";
import {
	DEMO_FIXTURE_SCHOOL_ID,
	DEMO_FIXTURE_STUDENT_ID,
	DEMO_FIXTURE_STUDENT_ID_BROU,
	EdayaContextFetchError,
} from "@children-ai/domain";

/** demo-ci École Cocody — same school id as EDAYA seed, isolated per palier DB. */
export const FIXTURE_SCHOOL_ID = DEMO_FIXTURE_SCHOOL_ID;
/** Léa Tremblay, 6ème 1 (`ci-s1` in demo-ci). */
export const FIXTURE_STUDENT_ID = DEMO_FIXTURE_STUDENT_ID;
/** Thomas Tremblay, 5ème 1 — second child of Sophie in the built-in demo. */
export const FIXTURE_STUDENT_ID_BROU = DEMO_FIXTURE_STUDENT_ID_BROU;
export const FIXTURE_ACADEMIC_YEAR_ID = "2025-ci";
export const FIXTURE_PERIOD_ID = "ci-2025-t1";

/** Same 6ème 1 week as demo-ci seed (`ci-6a` / Léa). */
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

const LEA: LearnerContext = {
	student: {
		edayaStudentId: FIXTURE_STUDENT_ID,
		firstName: "Léa",
		lastName: "Tremblay",
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

/** Same 5ème 1 week as demo-ci seed (`ci-5a` / Thomas). */
export const FIXTURE_TIMETABLE_BROU: TimetableSlot[] = [
	{
		id: "sch-ci-5a-fr-mon",
		dayOfWeek: "monday",
		startTime: "08:15",
		endTime: "09:00",
		title: "Français — dissertation",
		kind: "lesson",
	},
	{
		id: "sch-ci-5a-ang-mon",
		dayOfWeek: "monday",
		startTime: "09:15",
		endTime: "10:00",
		title: "Anglais",
		kind: "lesson",
	},
	{
		id: "sch-ci-5a-math-tue",
		dayOfWeek: "tuesday",
		startTime: "08:15",
		endTime: "09:00",
		title: "Mathématiques — équations",
		kind: "lesson",
	},
	{
		id: "sch-ci-5a-svt-tue",
		dayOfWeek: "tuesday",
		startTime: "10:00",
		endTime: "10:45",
		title: "SVT",
		kind: "lesson",
	},
	{
		id: "sch-ci-5a-hg-wed",
		dayOfWeek: "wednesday",
		startTime: "08:15",
		endTime: "09:00",
		title: "Histoire-Géographie",
		kind: "lesson",
	},
	{
		id: "sch-ci-5a-pc-wed",
		dayOfWeek: "wednesday",
		startTime: "10:15",
		endTime: "11:00",
		title: "Physique-Chimie",
		kind: "lesson",
	},
	{
		id: "sch-ci-5a-math-thu",
		dayOfWeek: "thursday",
		startTime: "10:00",
		endTime: "10:45",
		title: "Mathématiques — nombres relatifs",
		kind: "lesson",
	},
	{
		id: "sch-ci-5a-eps-fri",
		dayOfWeek: "friday",
		startTime: "08:15",
		endTime: "09:00",
		title: "EPS",
		kind: "lesson",
	},
	{
		id: "sch-ci-5a-club-fri",
		dayOfWeek: "friday",
		startTime: "13:00",
		endTime: "14:00",
		title: "Club sciences",
		kind: "activity",
	},
];

const THOMAS: LearnerContext = {
	student: {
		edayaStudentId: FIXTURE_STUDENT_ID_BROU,
		firstName: "Thomas",
		lastName: "Tremblay",
		grade: "5e",
		classLabel: "5ème 1",
	},
	academicYearId: FIXTURE_ACADEMIC_YEAR_ID,
	periodId: FIXTURE_PERIOD_ID,
	marks: [
		{
			id: "asmt-brou-premiers",
			subject: "Mathématiques",
			title: "Contrôle Nombres premiers",
			score: 13,
			maxScore: 20,
			date: "2025-10-14",
		},
		{
			id: "asmt-brou-relatifs",
			subject: "Mathématiques",
			title: "Contrôle Nombres décimaux relatifs",
			score: 6,
			maxScore: 20,
			date: "2025-11-04",
		},
		{
			id: "asmt-brou-dissertation",
			subject: "Français",
			title: "Dissertation",
			score: 12,
			maxScore: 20,
			date: "2025-11-06",
		},
		{
			id: "asmt-brou-hg",
			subject: "Histoire-Géographie",
			title: "Analyse documentaire",
			score: 11,
			maxScore: 20,
			date: "2025-11-08",
		},
	],
	rank: {
		rank: 14,
		classSize: 38,
		overallAverage: 12.1,
	},
	classProgress: [
		{ subject: "Mathématiques", subjectMatter: "Nombres premiers", completedPercentage: 70 },
		{ subject: "Mathématiques", subjectMatter: "Nombres décimaux relatifs", completedPercentage: 30 },
		{ subject: "Mathématiques", subjectMatter: "Équations", completedPercentage: 15 },
		{ subject: "Français", subjectMatter: "Dissertation", completedPercentage: 40 },
		{ subject: "Histoire-Géographie", subjectMatter: "Analyse documentaire", completedPercentage: 25 },
		{ subject: "SVT", subjectMatter: "Génétique", completedPercentage: 20 },
	],
	timetable: FIXTURE_TIMETABLE_BROU,
	attendance: { presentRate: 0.96 },
	observations: [
		"Bon niveau en calcul. Les nombres relatifs restent fragiles ; à retravailler avant les équations.",
	],
};

const FIXTURE_CONTEXTS: Record<string, LearnerContext> = {
	[FIXTURE_STUDENT_ID]: LEA,
	[FIXTURE_STUDENT_ID_BROU]: THOMAS,
};

export class FixtureEdayaContext implements EdayaContextPort {
	async pullLearnerContext(query: {
		schoolId: string;
		studentId: string;
	}): Promise<LearnerContext> {
		const context = query.schoolId === FIXTURE_SCHOOL_ID
			? FIXTURE_CONTEXTS[query.studentId]
			: undefined;
		if (!context) {
			throw new EdayaContextFetchError(
				`Aucun contexte fixture pour ${query.schoolId}/${query.studentId}.`,
			);
		}
		return structuredClone(context);
	}
}
