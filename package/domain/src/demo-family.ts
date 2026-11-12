import type { LearnerContextQuery } from "./ports.ts";
import {
	DEMO_FIXTURE_GUARDIAN_NAME,
	DEMO_FIXTURE_GUARDIAN_SUBJECT_ID,
	DEMO_FIXTURE_SCHOOL_ID,
	DEMO_FIXTURE_STUDENT_ID,
	DEMO_FIXTURE_STUDENT_ID_BROU,
	DEMO_FIXTURE_STUDENT_ID_SECONDE,
	DEMO_FIXTURE_STUDENT_ID_TLE,
	type GuardianActor,
	type GuardianChild,
	type GuardianChildrenListing,
	type StudentActor,
} from "./types.ts";

export function isDemoGuardian(guardian: GuardianActor): boolean {
	return guardian.sessionKind === "demo";
}

export function isDemoIssuedAccess(guardianSubjectId: string): boolean {
	return guardianSubjectId === DEMO_FIXTURE_GUARDIAN_SUBJECT_ID;
}

export function learnerQueryForIssuedCode(code: {
	schoolId: string;
	studentId: string;
	guardianSubjectId: string;
}): LearnerContextQuery {
	return {
		schoolId: code.schoolId,
		studentId: code.studentId,
		...(isDemoIssuedAccess(code.guardianSubjectId) ? { contextSource: "fixture" as const } : {}),
	};
}

export function demoGuardianActor(): GuardianActor {
	return {
		role: "guardian",
		subjectId: DEMO_FIXTURE_GUARDIAN_SUBJECT_ID,
		schoolId: DEMO_FIXTURE_SCHOOL_ID,
		displayName: DEMO_FIXTURE_GUARDIAN_NAME,
		sessionKind: "demo",
	};
}

export function demoStudentActor(): StudentActor {
	return {
		role: "student",
		studentId: DEMO_FIXTURE_STUDENT_ID,
		schoolId: DEMO_FIXTURE_SCHOOL_ID,
		guardianSubjectId: DEMO_FIXTURE_GUARDIAN_SUBJECT_ID,
		codeId: "demo",
		displayName: "Léa Mercier",
		childFirstName: "Léa",
		sessionKind: "demo",
	};
}

export function demoFamilyChildren(): GuardianChild[] {
	return [
		{
			studentId: DEMO_FIXTURE_STUDENT_ID,
			schoolId: DEMO_FIXTURE_SCHOOL_ID,
			firstName: "Léa",
			lastName: "Mercier",
			classLabel: "6ème 1",
			gradeLevel: {
				id: "demo-6eme",
				name: "Sixième",
				label: "6ème",
				order: 1,
				cycle: "Collège",
			},
		},
		{
			studentId: DEMO_FIXTURE_STUDENT_ID_BROU,
			schoolId: DEMO_FIXTURE_SCHOOL_ID,
			firstName: "Thomas",
			lastName: "Mercier",
			classLabel: "5ème 1",
			gradeLevel: {
				id: "demo-5eme",
				name: "Cinquième",
				label: "5ème",
				order: 2,
				cycle: "Collège",
			},
		},
		{
			studentId: DEMO_FIXTURE_STUDENT_ID_SECONDE,
			schoolId: DEMO_FIXTURE_SCHOOL_ID,
			firstName: "Camille",
			lastName: "Mercier",
			classLabel: "2nde C 1",
			gradeLevel: {
				id: "demo-2nde",
				name: "Seconde C",
				label: "2nde C",
				order: 5,
				cycle: "Lycée",
			},
		},
		{
			studentId: DEMO_FIXTURE_STUDENT_ID_TLE,
			schoolId: DEMO_FIXTURE_SCHOOL_ID,
			firstName: "Inès",
			lastName: "Mercier",
			classLabel: "Tle D 1",
			gradeLevel: {
				id: "demo-tle",
				name: "Terminale D",
				label: "Tle D",
				order: 7,
				cycle: "Lycée",
			},
		},
	];
}

export function demoFamilyListing(guardian: GuardianActor): GuardianChildrenListing {
	const children = demoFamilyChildren();
	return {
		schoolId: DEMO_FIXTURE_SCHOOL_ID,
		displayName: guardian.displayName || DEMO_FIXTURE_GUARDIAN_NAME,
		children,
		schools: [{
			schoolId: DEMO_FIXTURE_SCHOOL_ID,
			schoolName: "Démonstration",
			children,
		}],
	};
}
