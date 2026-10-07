import { ChildrenAiApp } from "@children-ai/app";
import {
	assertProdRejectsDemoSeed,
	createExerciseGenerator,
	createSchoolEdayaStack,
	CryptoIdGenerator,
	demoSchoolCredentials,
	JsonCurriculumCatalog,
	resolveGeneratorName,
	SystemClock,
	type SessionStore,
} from "@children-ai/adaptors";
import {
	KvExerciseSetRepository,
	KvPracticeSettingsRepository,
	KvSchoolIntegrationVault,
	KvSessionStore,
	KvSnapshotRepository,
	KvStudentAccessCodeRepository,
	type KvNamespaceLike,
} from "@children-ai/adaptor-cloudflare";
import {
	parsePalier,
	resolvePalierEdayaOrigin,
	resolveVaultMasterKey,
	type Palier,
} from "@children-ai/domain";
import { createIdentityVerifier } from "./identity.ts";
import type { IdentityVerifier } from "./http.ts";

export type CloudflareAdaptorEnv = {
	STORE: KvNamespaceLike;
	SESSIONS: KvNamespaceLike;
	GEMINI_API_KEY?: string;
	GEMINI_MODEL?: string;
	CORS_ORIGIN?: string;
	PALIER?: string;
	VAULT_MASTER_KEY?: string;
	EDAYA_DEMO_SCHOOL_ID?: string;
	EDAYA_API_ORIGIN?: string;
	EDAYA_DEMO_ACADEMIC_YEAR_ID?: string;
	EDAYA_DEMO_API_KEY?: string;
	EDAYA_CONTEXT?: string;
	IDENTITY_JWKS_URL?: string;
	CHILDREN_AI_RESOLVE_SECRET?: string;
};

export type WorkerRuntime = {
	app: ChildrenAiApp;
	sessions: SessionStore;
	identity: IdentityVerifier;
	generatorName: "stub" | "gemini-flash";
	corsOrigins: string[];
	palier: Palier;
	schoolId: string;
	contextMode: "fixture" | "http";
};

export async function createCloudflareRuntime(
	env: CloudflareAdaptorEnv,
): Promise<WorkerRuntime> {
	const ids = new CryptoIdGenerator();
	const clock = new SystemClock();
	const generatorName = resolveGeneratorName(env.GEMINI_API_KEY);
	const palier = parsePalier(env.PALIER, "local");
	const edayaApiBaseUrl = resolvePalierEdayaOrigin(palier, env.EDAYA_API_ORIGIN);
	const vaultMasterKey = resolveVaultMasterKey(palier, env.VAULT_MASTER_KEY);
	assertProdRejectsDemoSeed(palier, { demoApiKey: env.EDAYA_DEMO_API_KEY });

	const vault = new KvSchoolIntegrationVault(env.STORE, vaultMasterKey);
	const schoolId = env.EDAYA_DEMO_SCHOOL_ID?.trim() || "";
	if (palier !== "prod" && schoolId) {
		await vault.put(
			demoSchoolCredentials({
				schoolId,
				edayaApiBaseUrl,
				academicYearId: env.EDAYA_DEMO_ACADEMIC_YEAR_ID,
				apiKey: env.EDAYA_DEMO_API_KEY,
			}),
		);
	}

	const demo = createSchoolEdayaStack({
		palier,
		schoolId: schoolId || undefined,
		edayaApiBaseUrl,
		academicYearId: env.EDAYA_DEMO_ACADEMIC_YEAR_ID,
		apiKey: env.EDAYA_DEMO_API_KEY,
		contextMode: env.EDAYA_CONTEXT,
		credentials: vault,
		seedDemoSchool: false,
		resolveGuardianSecret: env.CHILDREN_AI_RESOLVE_SECRET,
		deriveLocalS2sKey: palier === "local",
	});
	const sessions = new KvSessionStore(env.SESSIONS);

	const app = new ChildrenAiApp({
		edaya: demo.edaya,
		catalog: new JsonCurriculumCatalog(),
		generator: createExerciseGenerator({
			ids,
			clock,
			apiKey: env.GEMINI_API_KEY,
			model: env.GEMINI_MODEL,
		}),
		snapshots: new KvSnapshotRepository(env.STORE),
		sets: new KvExerciseSetRepository(env.STORE),
		practiceSettings: new KvPracticeSettingsRepository(env.STORE),
		codes: new KvStudentAccessCodeRepository(env.STORE),
		children: demo.children,
		studentSessions: sessions,
		clock,
		ids,
	});

	return {
		app,
		sessions,
		identity: createIdentityVerifier(env),
		generatorName,
		corsOrigins: (env.CORS_ORIGIN ?? "")
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean),
		palier,
		schoolId: demo.schoolId,
		contextMode: demo.contextMode,
	};
}
