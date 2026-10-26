import type {
	CurriculumLesson,
	ExerciseSet,
	GuardianActor,
	GuardianChildrenListing,
	LearnerAcademicSnapshot,
	LearnerContext,
	PracticeFocus,
	PracticeIntent,
	PracticeSessionPlan,
	PracticeSettings,
	PracticeTrackKind,
	SessionActor,
	StudentAccessCode,
} from "./types.ts";

export type LearnerContextQuery = {
	schoolId: string;
	studentId: string;
	contextSource?: "fixture" | "live";
};

export interface EdayaContextPort {
	pullLearnerContext(query: LearnerContextQuery): Promise<LearnerContext>;
}

export const EDAYA_SPARK_SERVICE_ID = "edaya-spark" as const;

export type SchoolIntegration = {
	schoolId: string;
	edayaApiBaseUrl: string;
	academicYearId: string;
	serviceId: typeof EDAYA_SPARK_SERVICE_ID;
	keyPrefix: string;
	status: "pending" | "active" | "revoked";
	rotatedAt?: string;
};

export type SchoolCredentials = {
	integration: SchoolIntegration;
	apiKey: string;
};

export interface EdayaCredentialsPort {
	getActive(schoolId: string): Promise<SchoolCredentials | null>;
}

export type PracticeRecommendation = {
	focus: PracticeFocus;
	lesson: CurriculumLesson;
};

export type PracticeFocusRequest = {
	snapshot: LearnerAcademicSnapshot;
	intent?: PracticeIntent;
	now?: Date;
	/** Intended duration for the whole session. The recommendation splits it across tracks. */
	sessionMinutes?: { min: number; max: number };
};

export interface PracticeFocusPort {
	packVersion(): string;
	/** Prompt file version. Empty when this focus does not use a versioned prompt. */
	promptVersion(): string;
	recommend(input: PracticeFocusRequest): Promise<PracticeRecommendation>;
	plan(input: PracticeFocusRequest): Promise<PracticeSessionPlan>;
}

export interface ExerciseGeneratorPort {
	generate(input: {
		snapshot: LearnerAcademicSnapshot;
		lesson: CurriculumLesson;
		focus: PracticeFocus;
		plannedMinutes: number;
	}): Promise<ExerciseSet>;
}

export interface SnapshotRepository {
	getCurrent(query: LearnerContextQuery): Promise<LearnerAcademicSnapshot | null>;
	save(snapshot: LearnerAcademicSnapshot): Promise<void>;
}

export interface ExerciseSetRepository {
	findBySnapshotId(snapshotId: string): Promise<ExerciseSet | null>;
	findBySnapshotTrack(snapshotId: string, track: PracticeTrackKind): Promise<ExerciseSet | null>;
	listByStudentId(query: LearnerContextQuery): Promise<ExerciseSet[]>;
	getById(id: string): Promise<ExerciseSet | null>;
	save(set: ExerciseSet): Promise<void>;
}

export interface PracticeSettingsRepository {
	get(query: LearnerContextQuery): Promise<PracticeSettings | null>;
	save(settings: PracticeSettings): Promise<void>;
}

export interface PracticePlanRepository {
	get(query: LearnerContextQuery, planningDate: string): Promise<PracticeSessionPlan | null>;
	save(query: LearnerContextQuery, planningDate: string, plan: PracticeSessionPlan): Promise<void>;
}

export type GuardianChildrenQuery = {
	subjectId: string;
	email?: string;
};

export interface GuardianChildrenPort {
	listChildren(query: GuardianChildrenQuery): Promise<GuardianChildrenListing>;
}

export interface StudentAccessCodeRepository {
	getById(id: string): Promise<StudentAccessCode | null>;
	getByHash(codeHash: string): Promise<StudentAccessCode | null>;
	getActiveByStudentId(studentId: string): Promise<StudentAccessCode | null>;
	listByStudentId(studentId: string): Promise<StudentAccessCode[]>;
	listActiveLearners(): Promise<LearnerContextQuery[]>;
	save(code: StudentAccessCode): Promise<void>;
}

export interface StudentSessionPort {
	deleteByStudentId(studentId: string): Promise<void>;
}

export interface SessionStore extends StudentSessionPort {
	get(token: string): Promise<SessionActor | null>;
	set(token: string, actor: SessionActor): Promise<void>;
}

export type GuardianPrincipal = Pick<GuardianActor, "subjectId"> & {
	email?: string;
	displayName?: string;
};

export type IssuedStudentAccessCode = {
	code: string;
	hint: string;
	studentId: string;
};

export interface Clock {
	nowIso(): string;
}

export interface IdGenerator {
	next(): string;
}
