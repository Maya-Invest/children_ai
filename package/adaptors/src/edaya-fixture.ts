import type { EdayaContextPort, LearnerContext } from "@children-ai/domain";
import { EdayaContextFetchError } from "@children-ai/domain";

/** demo-ci École Cocody — same school id as EDAYA seed, isolated per palier DB. */
export const FIXTURE_SCHOOL_ID = "sch-edaya-ci-cocody";
/** Aminata Koné, 6ème 1 (`ci-s1` in demo-ci). */
export const FIXTURE_STUDENT_ID = "ci-s1";
export const FIXTURE_ACADEMIC_YEAR_ID = "2025-ci";
export const FIXTURE_PERIOD_ID = "ci-2025-t1";

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
			subject: "MATH",
			title: "Contrôle Nombres entiers naturels",
			score: 14,
			maxScore: 20,
			date: "2025-10-12",
		},
		{
			id: "asmt-fractions",
			subject: "MATH",
			title: "Contrôle Fractions",
			score: 7,
			maxScore: 20,
			date: "2025-11-03",
		},
	],
	rank: {
		rank: 18,
		classSize: 42,
		overallAverage: 11.4,
	},
	classProgress: [
		{ subjectMatter: "Nombres entiers naturels", completedPercentage: 80 },
		{ subjectMatter: "Fractions", completedPercentage: 45 },
		{ subjectMatter: "Proportionnalité", completedPercentage: 10 },
	],
	attendance: { presentRate: 0.92 },
	observations: [
		"Bon engagement en classe, encore fragile sur la comparaison de fractions.",
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
