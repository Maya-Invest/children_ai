import type { EdayaContextPort, LearnerContext, TimetableDay, TimetableSlot } from "@children-ai/domain";
import {
	DEMO_FIXTURE_SCHOOL_ID,
	DEMO_FIXTURE_STUDENT_ID,
	DEMO_FIXTURE_STUDENT_ID_BROU,
	EdayaContextFetchError,
} from "@children-ai/domain";
import { GRADE_5E_MATTERS, GRADE_6E_MATTERS, gradeProgress } from "./fixture-grade-matters.ts";

/** demo-ci École Cocody — same school id as EDAYA seed, isolated per palier DB. */
export const FIXTURE_SCHOOL_ID = DEMO_FIXTURE_SCHOOL_ID;
/** Léa Tremblay, 6ème 1 (`ci-s1` in demo-ci). */
export const FIXTURE_STUDENT_ID = DEMO_FIXTURE_STUDENT_ID;
/** Thomas Tremblay, 5ème 1 — second child of Sophie in the built-in demo. */
export const FIXTURE_STUDENT_ID_BROU = DEMO_FIXTURE_STUDENT_ID_BROU;
export const FIXTURE_ACADEMIC_YEAR_ID = "2025-ci";
export const FIXTURE_PERIOD_ID = "ci-2025-t1";

const FRANCAIS = "Français";
const MATHEMATIQUES = "Mathématiques";
const ANGLAIS = "Anglais";
const PHYSIQUE = "Physique-Chimie";
const SVT = "Sciences de la Vie et de la Terre";

const LEA_ARITHMETIC = "Arithmétique : PGCD, PPCM, division euclidienne, nombres premiers";
const LEA_RELATIVES = "Nombres relatifs : addition, soustraction, repérage sur un axe";
export const FIXTURE_LEA_CHAPTER = "Fractions : opérations simples, fractions équivalentes";
export const FIXTURE_LEA_READING = "Lecture et compréhension de textes narratifs et documentaires";
const LEA_ORAL = "Compréhension orale et expression orale";
const LEA_SOLIDS = "Solides, liquides et gaz : propriétés physiques";
const LEA_CELL = "Organisation du vivant : cellule et organismes";
const LEA_CIRCUITS = "Circuits électriques simples : générateur, récepteur, conducteurs";

export const FIXTURE_THOMAS_CHAPTER = "Introduction aux forces et au mouvement";
const THOMAS_ECO = "Environnement et écosystèmes de base";

function slot(
	id: string,
	dayOfWeek: TimetableDay,
	startTime: string,
	endTime: string,
	title: string,
	kind: TimetableSlot["kind"] = "lesson",
): TimetableSlot {
	return { id, dayOfWeek, startTime, endTime, title, kind };
}

/** Léa, 6ème — the week shows subjects. The open chapter comes from progression. */
export const FIXTURE_TIMETABLE: TimetableSlot[] = [
	slot("sch-ci-6a-fr-mon", "monday", "08:00", "08:55", FRANCAIS),
	slot("sch-ci-6a-math-mon", "monday", "09:00", "09:55", MATHEMATIQUES),
	slot("sch-ci-6a-ang-mon", "monday", "10:05", "11:00", ANGLAIS),
	slot("sch-ci-6a-club-mon", "monday", "15:00", "16:00", "Club de lecture", "activity"),
	slot("sch-ci-6a-pc-tue", "tuesday", "08:00", "08:55", PHYSIQUE),
	slot("sch-ci-6a-svt-tue", "tuesday", "09:00", "09:55", SVT),
	slot("sch-ci-6a-fr-tue", "tuesday", "10:05", "11:00", FRANCAIS),
	slot("sch-ci-6a-math-tue", "tuesday", "14:00", "14:55", MATHEMATIQUES),
	slot("sch-ci-6a-ang-wed", "wednesday", "08:00", "08:55", ANGLAIS),
	slot("sch-ci-6a-pc-wed", "wednesday", "09:00", "09:55", PHYSIQUE),
	slot("sch-ci-6a-svt-wed", "wednesday", "10:05", "11:00", SVT),
	slot("sch-ci-6a-math-wed", "wednesday", "14:00", "14:55", MATHEMATIQUES),
	slot("sch-ci-6a-fr-thu", "thursday", "08:00", "08:55", FRANCAIS),
	slot("sch-ci-6a-ang-thu", "thursday", "09:00", "09:55", ANGLAIS),
	slot("sch-ci-6a-pc-thu", "thursday", "10:05", "11:00", PHYSIQUE),
	slot("sch-ci-6a-svt-thu", "thursday", "14:00", "14:55", SVT),
	slot("sch-ci-6a-math-fri", "friday", "08:00", "08:55", MATHEMATIQUES),
	slot("sch-ci-6a-fr-fri", "friday", "09:00", "09:55", FRANCAIS),
	slot("sch-ci-6a-ang-fri", "friday", "10:05", "11:00", ANGLAIS),
	slot("sch-ci-6a-pc-fri", "friday", "14:00", "14:55", PHYSIQUE),
	slot("sch-ci-6a-svt-fri", "friday", "15:00", "15:55", SVT),
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
			id: "asmt-fractions",
			subject: "Mathématiques",
			title: FIXTURE_LEA_CHAPTER,
			score: 7,
			maxScore: 20,
			date: "2025-11-03",
		},
		{
			id: "asmt-lecture",
			subject: "Français",
			title: FIXTURE_LEA_READING,
			score: 12,
			maxScore: 20,
			date: "2025-11-05",
		},
		{
			id: "asmt-cell",
			subject: "Sciences de la Vie et de la Terre",
			title: LEA_CELL,
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
	classProgress: gradeProgress(GRADE_6E_MATTERS, {
		[LEA_ARITHMETIC]: { completedPercentage: 100 },
		[LEA_RELATIVES]: { completedPercentage: 100 },
		[FIXTURE_LEA_CHAPTER]: { completedPercentage: 45 },
		[FIXTURE_LEA_READING]: { completedPercentage: 55 },
		[LEA_ORAL]: { completedPercentage: 30 },
		[LEA_SOLIDS]: { completedPercentage: 20 },
		[LEA_CELL]: { completedPercentage: 25 },
	}),
	timetable: FIXTURE_TIMETABLE,
	attendance: { presentRate: 0.92 },
	observations: [
		"Bon engagement. Les fractions restent fragiles ; la lecture et les circuits avancent.",
	],
	upcomingAssessments: [
		{
			id: "up-lea-lecture",
			subject: "Français",
			title: FIXTURE_LEA_READING,
			kind: "homework",
			dueAt: "2026-10-16",
		},
		{
			id: "up-lea-circuits",
			subject: "Physique-Chimie",
			title: LEA_CIRCUITS,
			kind: "exam",
			dueAt: "2026-11-20",
		},
	],
};

/** Thomas, 5ème — same subjects. His open physics chapter is not Léa's. */
export const FIXTURE_TIMETABLE_BROU: TimetableSlot[] = [
	slot("sch-ci-5a-pc-mon", "monday", "08:00", "08:55", PHYSIQUE),
	slot("sch-ci-5a-fr-mon", "monday", "09:00", "09:55", FRANCAIS),
	slot("sch-ci-5a-ang-mon", "monday", "10:05", "11:00", ANGLAIS),
	slot("sch-ci-5a-math-tue", "tuesday", "08:00", "08:55", MATHEMATIQUES),
	slot("sch-ci-5a-svt-tue", "tuesday", "09:00", "09:55", SVT),
	slot("sch-ci-5a-fr-tue", "tuesday", "10:05", "11:00", FRANCAIS),
	slot("sch-ci-5a-ang-wed", "wednesday", "08:00", "08:55", ANGLAIS),
	slot("sch-ci-5a-pc-wed", "wednesday", "09:00", "09:55", PHYSIQUE),
	slot("sch-ci-5a-svt-wed", "wednesday", "10:05", "11:00", SVT),
	slot("sch-ci-5a-math-thu", "thursday", "08:00", "08:55", MATHEMATIQUES),
	slot("sch-ci-5a-fr-thu", "thursday", "09:00", "09:55", FRANCAIS),
	slot("sch-ci-5a-ang-thu", "thursday", "10:05", "11:00", ANGLAIS),
	slot("sch-ci-5a-pc-fri", "friday", "08:00", "08:55", PHYSIQUE),
	slot("sch-ci-5a-svt-fri", "friday", "09:00", "09:55", SVT),
	slot("sch-ci-5a-math-fri", "friday", "10:05", "11:00", MATHEMATIQUES),
	slot("sch-ci-5a-club-fri", "friday", "15:00", "16:00", "Club sciences", "activity"),
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
			id: "asmt-brou-forces",
			subject: "Physique-Chimie",
			title: FIXTURE_THOMAS_CHAPTER,
			score: 8,
			maxScore: 20,
			date: "2025-11-04",
		},
		{
			id: "asmt-brou-lecture",
			subject: "Français",
			title: FIXTURE_LEA_READING,
			score: 12,
			maxScore: 20,
			date: "2025-11-06",
		},
	],
	rank: {
		rank: 14,
		classSize: 38,
		overallAverage: 12.1,
	},
	classProgress: gradeProgress(GRADE_5E_MATTERS, {
		[LEA_ARITHMETIC]: { completedPercentage: 100 },
		[LEA_RELATIVES]: { completedPercentage: 30 },
		[FIXTURE_LEA_READING]: { completedPercentage: 50 },
		[LEA_ORAL]: { completedPercentage: 40 },
		[FIXTURE_THOMAS_CHAPTER]: { completedPercentage: 35 },
		[THOMAS_ECO]: { completedPercentage: 20 },
	}),
	timetable: FIXTURE_TIMETABLE_BROU,
	attendance: { presentRate: 0.96 },
	observations: [
		"Les forces et le mouvement demandent encore de l'entraînement.",
	],
	upcomingAssessments: [
		{
			id: "up-thomas-forces",
			subject: "Physique-Chimie",
			title: FIXTURE_THOMAS_CHAPTER,
			kind: "homework",
			dueAt: "2026-10-16",
		},
		{
			id: "up-thomas-eco",
			subject: "Sciences de la Vie et de la Terre",
			title: THOMAS_ECO,
			kind: "exam",
			dueAt: "2026-11-20",
		},
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
