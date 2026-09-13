export { JsonCurriculumCatalog } from "./curriculum-catalog.ts";
export { FixtureGuardianChildrenPort, EmptyGuardianChildrenPort } from "./access-fixture.ts";
export {
	FixtureEdayaContext,
	FIXTURE_ACADEMIC_YEAR_ID,
	FIXTURE_SCHOOL_ID,
	FIXTURE_STUDENT_ID,
} from "./edaya-fixture.ts";
export {
	SchoolScopedEdayaContext,
	createDemoEdayaContext,
	createSchoolEdayaStack,
} from "./school-scoped-edaya.ts";
export {
	assertProdRejectsDemoSeed,
	resolveEdayaContextMode,
	type EdayaContextMode,
} from "./edaya-context-mode.ts";
export { HttpEdayaContext } from "./edaya-http.ts";
export { encryptVaultSecret, decryptVaultSecret } from "./vault-crypto.ts";
export {
	LOCAL_FIXTURE_KEY,
	MemorySchoolIntegrationVault,
	demoSchoolCredentials,
	keyPrefixOf,
} from "./school-integration-vault.ts";
export { StubExerciseGenerator } from "./generator-stub.ts";
export {
	DEFAULT_GEMINI_FLASH_MODEL,
	GEMINI_PROMPT_VERSION,
	GeminiFlashExerciseGenerator,
} from "./generator-gemini.ts";
export { createExerciseGenerator, resolveGeneratorName } from "./generator.ts";
export { MemorySessionStore, type SessionStore } from "./session-store.ts";
export {
	InMemoryExerciseSetRepository,
	InMemorySnapshotRepository,
	InMemoryStudentAccessCodeRepository,
} from "./memory-store.ts";
export { CryptoIdGenerator, SystemClock } from "./runtime.ts";
