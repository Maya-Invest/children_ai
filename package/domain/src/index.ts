export type {
	EdayaContextPort,
	EdayaCredentialsPort,
	LearnerContextQuery,
	SchoolCredentials,
	SchoolIntegration,
	CurriculumCatalogPort,
	ExerciseGeneratorPort,
	SnapshotRepository,
	ExerciseSetRepository,
	PracticeSettingsRepository,
	GuardianChildrenPort,
	GuardianChildrenQuery,
	StudentAccessCodeRepository,
	StudentSessionPort,
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
export { suggestFocus } from "./suggest-focus.ts";
export {
	isAnswerCorrect,
	normalizeAnswer,
	questionKind,
	scoreExerciseSet,
} from "./score-set.ts";
export {
	presentExerciseSet,
	type ExerciseAudience,
} from "./present-set.ts";
