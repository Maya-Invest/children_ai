import type {
	CurriculumLesson,
	ExerciseSet,
	GuardianActor,
	GuardianChildrenListing,
	LearnerAcademicSnapshot,
	LearnerContext,
	PracticeFocus,
	PracticeSettings,
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

export const CHILDREN_AI_SERVICE_ID = "children-ai" as const;

export type SchoolIntegration = {
	schoolId: string;
	edayaApiBaseUrl: string;
	academicYearId: string;
	serviceId: typeof CHILDREN_AI_SERVICE_ID;
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

export interface CurriculumCatalogPort {
	packVersion(): string;
	listLessons(grade: CurriculumLesson["grade"]): CurriculumLesson[];
	getLesson(lessonId: string): CurriculumLesson | undefined;
}

export interface ExerciseGeneratorPort {
	generate(input: {
		snapshot: LearnerAcademicSnapshot;
		lesson: CurriculumLesson;
		focus: PracticeFocus;
	}): Promise<ExerciseSet>;
}

export interface SnapshotRepository {
	getCurrent(query: LearnerContextQuery): Promise<LearnerAcademicSnapshot | null>;
	save(snapshot: LearnerAcademicSnapshot): Promise<void>;
}

export interface ExerciseSetRepository {
	findBySnapshotId(snapshotId: string): Promise<ExerciseSet | null>;
	listByStudentId(query: LearnerContextQuery): Promise<ExerciseSet[]>;
	getById(id: string): Promise<ExerciseSet | null>;
	save(set: ExerciseSet): Promise<void>;
}

export interface PracticeSettingsRepository {
	get(query: LearnerContextQuery): Promise<PracticeSettings | null>;
	save(settings: PracticeSettings): Promise<void>;
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
