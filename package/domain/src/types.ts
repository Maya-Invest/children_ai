export type GradeId = "6e" | "5e" | "4e" | "3e";

export type CurriculumLesson = {
	id: string;
	packVersion: string;
	country: "CI";
	cycle: "college";
	grade: GradeId;
	subject: "MATH";
	competence: { id: string; title: string };
	theme: { id: string; title: string };
	title: string;
	sequence: number;
	exampleSituation: string;
	skills: string[];
	contents: string[];
	sourcePdf: string;
};

export type AssessmentMark = {
	id: string;
	subject: "MATH";
	title: string;
	score: number;
	maxScore: number;
	date: string;
};

export type ClassProgressItem = {
	subjectMatter: string;
	completedPercentage: number;
};

export type LearnerContext = {
	student: {
		edayaStudentId: string;
		firstName: string;
		lastName: string;
		grade: GradeId;
		classLabel: string;
	};
	academicYearId: string;
	periodId: string;
	marks: AssessmentMark[];
	rank?: {
		rank: number;
		classSize: number;
		overallAverage: number;
	};
	classProgress: ClassProgressItem[];
	attendance?: {
		presentRate: number;
	};
	observations: string[];
};

export type LearnerAcademicSnapshot = {
	id: string;
	schoolId: string;
	studentId: string;
	fingerprint: string;
	packVersion: string;
	createdAt: string;
	context: LearnerContext;
};

export type PracticeFocus = {
	lessonId: string;
	rationale: string;
};

export type ExerciseQuestion = {
	id: string;
	prompt: string;
	kind: "short" | "mcq";
	choices?: string[];
};

export type ExerciseSet = {
	id: string;
	snapshotId: string;
	schoolId: string;
	studentId: string;
	lessonId: string;
	generatedAt: string;
	generator: "stub" | "llm";
	promptVersion: string;
	questions: ExerciseQuestion[];
};

export type LearnerBinding = {
	schoolId: string;
	edayaStudentId: string;
};

export type GuardianActor = {
	role: "guardian";
	subjectId: string;
	schoolId: string;
	displayName: string;
};

export type StudentActor = {
	role: "student";
	studentId: string;
	schoolId: string;
	guardianSubjectId: string;
	codeId: string;
	displayName: string;
	childFirstName: string;
};

export type SessionActor = GuardianActor | StudentActor;

export type StudentAccessCode = {
	id: string;
	schoolId: string;
	studentId: string;
	guardianSubjectId: string;
	codeHash: string;
	displayHint: string;
	createdAt: string;
	revokedAt: string | null;
};

export type GuardianChild = {
	studentId: string;
	schoolId: string;
	firstName: string;
	lastName: string;
	classLabel?: string;
	grade?: GradeId;
};

export type GuardianChildrenListing = {
	schoolId: string;
	displayName: string;
	children: GuardianChild[];
};

export class DomainError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = "DomainError";
		this.code = code;
	}
}

export class AlreadyGeneratedError extends DomainError {
	readonly existingSetId: string;

	constructor(existingSetId: string) {
		super(
			"ALREADY_GENERATED",
			"Un ensemble d'exercices existe déjà pour ce snapshot.",
		);
		this.existingSetId = existingSetId;
	}
}

export class NoSnapshotError extends DomainError {
	constructor() {
		super(
			"NO_SNAPSHOT",
			"Aucun snapshot académique n'est disponible pour cet élève.",
		);
	}
}

export class LessonNotInPackError extends DomainError {
	constructor(lessonId: string) {
		super(
			"LESSON_NOT_IN_PACK",
			`La leçon ${lessonId} n'appartient pas au programme officiel.`,
		);
	}
}

export class UnknownAccessCodeError extends DomainError {
	constructor() {
		super("UNKNOWN_ACCESS_CODE", "Ce code d'accès n'est pas reconnu.");
	}
}

export class GuardianCannotGenerateError extends DomainError {
	constructor() {
		super(
			"GUARDIAN_CANNOT_GENERATE",
			"Seul l'élève peut demander un nouvel ensemble d'exercices.",
		);
	}
}

export class ChildNotLinkedError extends DomainError {
	constructor() {
		super(
			"CHILD_NOT_LINKED",
			"Cet élève n'est pas lié à votre compte parent.",
		);
	}
}

export class ExerciseGenerationError extends DomainError {
	constructor(message = "La génération d'exercices a échoué.") {
		super("GENERATION_FAILED", message);
	}
}

export class EdayaContextFetchError extends DomainError {
	constructor(message = "Impossible de récupérer le contexte académique EDAYA.") {
		super("EDAYA_CONTEXT_FETCH_FAILED", message);
	}
}
