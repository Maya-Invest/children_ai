import type { LearnerContextQuery } from "./ports.ts";
import {
	DEMO_FIXTURE_GUARDIAN_NAME,
	DEMO_FIXTURE_GUARDIAN_SUBJECT_ID,
	DEMO_FIXTURE_SCHOOL_ID,
	DEMO_FIXTURE_STUDENT_ID,
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
		displayName: "Aminata Koné",
		childFirstName: "Aminata",
		sessionKind: "demo",
	};
}

export function demoFamilyChildren(): GuardianChild[] {
	return [
		{
			studentId: DEMO_FIXTURE_STUDENT_ID,
			schoolId: DEMO_FIXTURE_SCHOOL_ID,
			firstName: "Aminata",
			lastName: "Koné",
			classLabel: "6ème 1",
			grade: "6e",
		},
	];
}

export function demoFamilyListing(guardian: GuardianActor): GuardianChildrenListing {
	return {
		schoolId: DEMO_FIXTURE_SCHOOL_ID,
		displayName: guardian.displayName || DEMO_FIXTURE_GUARDIAN_NAME,
		children: demoFamilyChildren(),
	};
}
