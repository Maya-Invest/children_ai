import { join } from "node:path";
import { EdayaSparkApp } from "@edaya-spark/app";
import {
	assertProdRejectsDemoSeed,
	createCloudflareRagClient,
	createExerciseGenerator,
	createPracticeFocus,
	createSchoolEdayaStack,
	CryptoIdGenerator,
	demoSchoolCredentials,
	resolveFocusName,
	resolveGeneratorName,
	createRuntimeClock,
	resolveEdayaContextMode,
	type FocusName,
	type GeneratorName,
} from "@edaya-spark/adaptors";
import { openSparkDatabase, PostgresSchoolIntegrationVault } from "@edaya-spark/adaptor-postgres";
import {
	parsePalier,
	resolvePalierEdayaOrigin,
	resolveVaultMasterKey,
	type Palier,
	type SessionStore,
} from "@edaya-spark/domain";
import { createIdentityVerifier } from "./identity.ts";
import type { IdentityVerifier } from "./http.ts";
import { assertWorkerHyperdrive } from "./runtime/boundaries.ts";

export type CloudflareAdaptorEnv = {
	HYPERDRIVE?: { connectionString?: string };
	FOCUS?: string;
	GENERATOR?: string;
	CLOUDFLARE_ACCOUNT_ID?: string;
	CLOUDFLARE_API_TOKEN?: string;
	CLOUDFLARE_RAG_NAMESPACE?: string;
	CLOUDFLARE_RAG_INSTANCE?: string;
	CLOUDFLARE_BYOK_ALIAS?: string;
	FOCUS_MODEL?: string;
	RAG_GENERATOR_MODEL?: string;
	RAG_PACK_VERSION?: string;
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
	EDAYA_SPARK_RESOLVE_SECRET?: string;
	FIXTURE_TODAY?: string;
	PRACTICE_WEEKDAY?: string;
};

export type WorkerRuntime = {
	app: EdayaSparkApp;
	sessions: SessionStore;
	identity: IdentityVerifier;
	generatorName: GeneratorName;
	focusName: FocusName;
	corsOrigins: string[];
	palier: Palier;
	schoolId: string;
	contextMode: "fixture" | "http";
	close(): Promise<void>;
};

const repoRoot = import.meta.dir ? join(import.meta.dir, "../../..") : undefined;

export async function createCloudflareRuntime(
	env: CloudflareAdaptorEnv,
): Promise<WorkerRuntime> {
	const ids = new CryptoIdGenerator();
	const palier = parsePalier(env.PALIER, "local");
	const contextMode = resolveEdayaContextMode(
		palier,
		env.EDAYA_CONTEXT,
		env.EDAYA_DEMO_API_KEY,
		env.EDAYA_API_ORIGIN,
	);
	const clock = createRuntimeClock({
		contextMode,
		fixtureToday: env.FIXTURE_TODAY,
		practiceWeekday: env.PRACTICE_WEEKDAY,
	});
	const generatorName = resolveGeneratorName({
		generator: env.GENERATOR,
		geminiApiKey: env.GEMINI_API_KEY,
	});
	const focusName = resolveFocusName(env.FOCUS);
	const rag = focusName === "cloudflare" || generatorName === "rag"
		? createCloudflareRagClient({
			accountId: env.CLOUDFLARE_ACCOUNT_ID,
			apiToken: env.CLOUDFLARE_API_TOKEN,
			namespace: env.CLOUDFLARE_RAG_NAMESPACE,
			instance: env.CLOUDFLARE_RAG_INSTANCE,
			byokAlias: env.CLOUDFLARE_BYOK_ALIAS,
		})
		: undefined;
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
		resolveGuardianSecret: env.EDAYA_SPARK_RESOLVE_SECRET,
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

	const app = new EdayaSparkApp({
		edaya: demo.edaya,
		focus: createPracticeFocus({
			focus: focusName,
			rag,
			model: env.FOCUS_MODEL,
			packVersion: env.RAG_PACK_VERSION,
		}),
		generator: createExerciseGenerator({
			ids,
			clock,
			generator: generatorName,
			apiKey: env.GEMINI_API_KEY,
			model: env.GEMINI_MODEL,
			rag,
			ragModel: env.RAG_GENERATOR_MODEL,
		}),
		snapshots: persistence.snapshots,
		sets: persistence.sets,
		plans: persistence.plans,
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
		focusName,
		corsOrigins: (env.CORS_ORIGIN ?? "")
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean),
		palier,
		schoolId: demo.schoolId,
		contextMode: demo.contextMode,
		close: () => persistence.close(),
	};
}
