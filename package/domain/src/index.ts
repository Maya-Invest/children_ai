export type {
	EdayaContextPort,
	EdayaCredentialsPort,
	LearnerContextQuery,
	SchoolCredentials,
	SchoolIntegration,
	CurriculumCatalogPort,
	PracticeFocusPort,
	PracticeFocusRequest,
	PracticeRecommendation,
	ExerciseGeneratorPort,
	SnapshotRepository,
	ExerciseSetRepository,
	PracticeSettingsRepository,
	PracticePlanRepository,
	GuardianChildrenPort,
	GuardianChildrenQuery,
	StudentAccessCodeRepository,
	StudentSessionPort,
	SessionStore,
	GuardianPrincipal,
	IssuedStudentAccessCode,
	Clock,
	IdGenerator,
} from "./ports.ts";
export { CHILDREN_AI_SERVICE_ID } from "./ports.ts";
export * from "./types.ts";
export {
	formatStudentAccessCode,
	generateStudentAccessCode,
	hashStudentAccessCode,
	isCompleteStudentAccessCode,
	normalizeStudentAccessCode,
	studentAccessCodeHint,
	STUDENT_ACCESS_CODE_LENGTH,
} from "./access-code.ts";
export {
	PALIERS,
	PALIER_EDAYA_ORIGINS,
	assertEdayaOriginAllowed,
	isPalier,
	normalizeEdayaOrigin,
	palierAllowsEdayaOrigin,
	parsePalier,
	resolvePalierEdayaOrigin,
	resolveVaultMasterKey,
	PalierOriginMismatchError,
	SchoolIntegrationMissingError,
	type Palier,
} from "./palier.ts";
export { snapshotFingerprint } from "./fingerprint.ts";
export {
	demoFamilyChildren,
	demoFamilyListing,
	demoGuardianActor,
	demoStudentActor,
	isDemoGuardian,
	isDemoIssuedAccess,
	learnerQueryForIssuedCode,
} from "./demo-family.ts";
export {
	displaySubjectLabel,
	formatProgrammeLine,
	listLearnerSubjects,
	subjectsMatch,
} from "./display-subject.ts";
export { calendarDaysUntil, matchOfficialLesson, officialLessonsForSubject, suggestFocus, suggestHomeworkWithinHorizon } from "./suggest-focus.ts";
export {
	DAILY_PRACTICE_MAX_MINUTES,
	DAILY_PRACTICE_MINUTES,
	DAILY_PRACTICE_MIN_MINUTES,
	isDailyPracticeDuration,
	UPCOMING_EVALUATION_HORIZON_DAYS,
	MIN_DAILY_SUBJECTS,
	SNAPSHOT_PACK_VERSION,
	endOfDayCandidates,
	endOfDaySnapshotLessons,
	matchTimetableLesson,
	planningDateKey,
	resolveSnapshotLesson,
	revisionLessonsForDay,
	scanPracticeWindow,
	splitMinutes,
	upcomingCandidates,
	upcomingSnapshotLessons,
} from "./practice-window.ts";
export {
	composeSessionPlan,
	emptySessionPlan,
	exerciseProposalInstruction,
	formatPracticeDuration,
	questionTargetForMinutes,
} from "./session-plan.ts";
export {
	distinctMcqChoices,
	isAnswerCorrect,
	normalizeAnswer,
	questionKind,
	scoreExerciseSet,
} from "./score-set.ts";
export {
	presentExerciseSet,
	type ExerciseAudience,
} from "./present-set.ts";
