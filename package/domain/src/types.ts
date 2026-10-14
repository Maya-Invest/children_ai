export type GradeId = "6e" | "5e" | "4e" | "3e";

/** Built-in Sophie Tremblay demo family — landing hint “Essayer la démo” only, never Identity parents. */
export const DEMO_FIXTURE_SCHOOL_ID = "sch-edaya-ci-cocody";
export const DEMO_FIXTURE_STUDENT_ID = "ci-s1";
export const DEMO_FIXTURE_STUDENT_ID_BROU = "ci-s31";
export const DEMO_FIXTURE_GUARDIAN_SUBJECT_ID = "demo-guardian";
export const DEMO_FIXTURE_GUARDIAN_NAME = "Sophie Tremblay";

export const CHILDREN_AI_RESOLVE_SECRET_HEADER = "x-children-ai-resolve-secret";

export type CurriculumLesson = {
	id: string;
	packVersion: string;
	country: "CI";
	cycle: "college";
	grade: GradeId;
	subject: string;
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
	subject: string;
	title: string;
	score: number;
	maxScore: number;
	date: string;
};

export type ClassProgressItem = {
	subject?: string;
	subjectMatter: string;
	completedPercentage: number;
	/** Fixture-only link from a timetable slot to this chapter. Live payloads omit it. */
	slotId?: string;
};

export type TimetableDay =
	| "monday"
	| "tuesday"
	| "wednesday"
	| "thursday"
	| "friday"
	| "saturday"
	| "sunday";

export type TimetableSlot = {
	id: string;
	dayOfWeek: TimetableDay;
	startTime: string;
	endTime: string;
	title: string;
	kind: "lesson" | "activity";
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
	timetable: TimetableSlot[];
	attendance?: {
		presentRate: number;
	};
	observations: string[];
	upcomingAssessments?: UpcomingAssessment[];
};

export type UpcomingAssessmentKind = "homework" | "exam" | "quiz" | "project" | "other";

export type UpcomingAssessment = {
	id: string;
	subject: string;
	title: string;
	kind: UpcomingAssessmentKind;
	dueAt: string;
};

export const PRACTICE_INTENTS = [
	"upcoming_work",
	"improve_results",
	"prepare_next_day",
] as const;

export type PracticeIntent = (typeof PRACTICE_INTENTS)[number];

export const DEFAULT_PRACTICE_INTENT: PracticeIntent = "improve_results";

export function isPracticeIntent(value: unknown): value is PracticeIntent {
	return PRACTICE_INTENTS.some((intent) => intent === value);
}

export type LearnerAcademicSnapshot = {
	id: string;
	schoolId: string;
	studentId: string;
	fingerprint: string;
	packVersion: string;
	createdAt: string;
	context: LearnerContext;
};

export type ExerciseProposal = {
	objective: string;
	theme: string;
	exerciseType: string;
	difficulty: string;
	minutes: number;
	promptHint: string;
};

export type PracticeFocus = {
	lessonId: string;
	subject: string;
	rationale: string;
	brief: string;
	intent: PracticeIntent;
	proposals: ExerciseProposal[];
};

export const PRACTICE_TRACKS = ["revision", "homework"] as const;

export type PracticeTrackKind = (typeof PRACTICE_TRACKS)[number];

export function isPracticeTrack(value: unknown): value is PracticeTrackKind {
	return PRACTICE_TRACKS.some((track) => track === value);
}

/** Sets saved before tracks existed stay on the revision list. */
export function exerciseTrack(set: { track?: PracticeTrackKind | null }): PracticeTrackKind {
	return set.track === "homework" ? "homework" : "revision";
}

export type PracticeTrackItem = {
	minutes: number;
	focus: PracticeFocus;
	lesson: CurriculumLesson;
	assessmentLabel: string | null;
};

export type PracticeTrackPlan = {
	kind: PracticeTrackKind;
	minutes: number;
	available: boolean;
	focus: PracticeFocus | null;
	lesson: CurriculumLesson | null;
	/** Short label of the targeted assessment, when this track prepares one. */
	assessmentLabel: string | null;
	/** One entry per timetable subject kept on this track. */
	items: PracticeTrackItem[];
};

/** Stored plans from before several subjects per day are planned again. */
export const PRACTICE_PLAN_VERSION = 4;

export type PracticeSessionPlan = {
	summary: string;
	totalMinutes: number;
	tracks: PracticeTrackPlan[];
	planVersion?: number;
	/** Prompt file that produced this plan, for example "1.0". */
	promptVersion?: string;
};

export type QuestionKind = "mcq" | "written";

export type ExerciseQuestion = {
	id: string;
	prompt: string;
	kind: QuestionKind;
	choices?: string[];
	/** Kept server-side; omitted for the student until a parent releases the corrigé. */
	expectedAnswer?: string;
	/** Whether a non-empty answer was supplied; added only when presenting a submitted set. */
	answered?: boolean;
	/** Per-question verdict; omitted for the student until a parent releases the corrigé. */
	correct?: boolean;
};

export type StudentAnswer = {
	questionId: string;
	value: string;
};

export type ExerciseScore = {
	correct: number;
	total: number;
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
	answers?: StudentAnswer[];
	submittedAt?: string;
	score?: ExerciseScore;
	correctionReleasedAt?: string | null;
	/** Revision or upcoming-homework series. Missing values count as revision. */
	track?: PracticeTrackKind;
	/** Minutes assigned from the 2 h contract when the series was prepared. */
	plannedMinutes?: number;
};

export type PracticeSettings = {
	schoolId: string;
	studentId: string;
	autoReleaseCorrection: boolean;
	focusIntent?: PracticeIntent;
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
	sessionKind?: "demo";
};

export type StudentActor = {
	role: "student";
	studentId: string;
	schoolId: string;
	guardianSubjectId: string;
	codeId: string;
	displayName: string;
	childFirstName: string;
	sessionKind?: "demo" | "code";
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

export const NOTHING_TO_PRACTICE_MESSAGE =
	"Aucune leçon n'est prévue aujourd'hui ni demain, et aucune évaluation n'arrive dans les deux prochaines semaines.";

export const PRACTICE_MINUTES_MESSAGE = "La séance proposée doit durer entre 1 h 50 et 2 h 10.";

export const PRACTICE_UNREADABLE_MESSAGE = "La recommandation n'est pas un plan lisible.";

export const PRACTICE_NO_PROGRAMME_MESSAGE =
	"Aucun extrait du programme n'a été trouvé pour préparer la séance.";

export const PRACTICE_NO_PROPOSALS_MESSAGE = "La recommandation ne propose aucun exercice.";

export const PRACTICE_TIMETABLE_MISMATCH_MESSAGE =
	"La leçon retenue ne correspond pas à l'emploi du temps.";

export const PRACTICE_INTENT_MESSAGE =
	"La fin de journée et l'évaluation à venir ne sont pas correctement séparées.";

export class NothingToPracticeError extends DomainError {
	constructor() {
		super("NOTHING_TO_PRACTICE", NOTHING_TO_PRACTICE_MESSAGE);
	}
}

export class PracticePlanError extends DomainError {
	constructor(message: string) {
		super("PRACTICE_PLAN_INVALID", message);
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

export class AlreadySubmittedError extends DomainError {
	constructor() {
		super(
			"ALREADY_SUBMITTED",
			"Cette série a déjà été terminée.",
		);
	}
}

export class SetNotSubmittedError extends DomainError {
	constructor() {
		super(
			"SET_NOT_SUBMITTED",
			"L'élève n'a pas encore terminé cette série.",
		);
	}
}

export class EmptySubmissionError extends DomainError {
	constructor() {
		super(
			"EMPTY_SUBMISSION",
			"Réponds à au moins une question avant de terminer la série.",
		);
	}
}

export class CorrectionUnavailableError extends DomainError {
	constructor() {
		super(
			"CORRECTION_UNAVAILABLE",
			"Cette ancienne série ne contient pas de corrigé exploitable.",
		);
	}
}

export class ExerciseSetNotFoundError extends DomainError {
	constructor() {
		super("NOT_FOUND", "Aucun ensemble d'exercices trouvé.");
	}
}

export class StudentOnlyActionError extends DomainError {
	constructor(message = "Cette action est réservée à l'élève.") {
		super("FORBIDDEN", message);
	}
}

export class EdayaContextFetchError extends DomainError {
	constructor(message = "Impossible de récupérer le contexte académique EDAYA.") {
		super("EDAYA_CONTEXT_FETCH_FAILED", message);
	}
}
