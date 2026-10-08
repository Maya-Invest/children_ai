import { join } from "node:path";
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
} from "@children-ai/adaptors";
import { openSparkDatabase, PostgresSchoolIntegrationVault } from "@children-ai/adaptor-postgres";
import {
	parsePalier,
	resolvePalierEdayaOrigin,
	resolveVaultMasterKey,
	type Palier,
	type SessionStore,
} from "@children-ai/domain";
import { createIdentityVerifier } from "./identity.ts";
import type { IdentityVerifier } from "./http.ts";
import { assertWorkerHyperdrive } from "./runtime/boundaries.ts";

export type CloudflareAdaptorEnv = {
	HYPERDRIVE?: { connectionString?: string };
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

const repoRoot = join(import.meta.dir, "../../..");

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
	const connectionString = assertWorkerHyperdrive(env.HYPERDRIVE?.connectionString);
	const persistence = await openSparkDatabase(connectionString, { repoRoot });
	const vault = new PostgresSchoolIntegrationVault(persistence.db, vaultMasterKey);

	const schoolId = env.EDAYA_DEMO_SCHOOL_ID?.trim() || "";
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
	await demo.ready;

	const app = new ChildrenAiApp({
		edaya: demo.edaya,
		catalog: new JsonCurriculumCatalog(),
		generator: createExerciseGenerator({
			ids,
			clock,
			apiKey: env.GEMINI_API_KEY,
			model: env.GEMINI_MODEL,
		}),
		snapshots: persistence.snapshots,
		sets: persistence.sets,
		practiceSettings: persistence.practiceSettings,
		codes: persistence.codes,
		children: demo.children,
		studentSessions: persistence.sessions,
		clock,
		ids,
	});

	return {
		app,
		sessions: persistence.sessions,
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
