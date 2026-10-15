import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ChildrenAiApp } from "@children-ai/app";
import {
	createCloudflareRagClient,
	createExerciseGenerator,
	createPracticeFocus,
	createSchoolEdayaStack,
	CryptoIdGenerator,
	resolveFocusName,
	resolveGeneratorName,
	createRuntimeClock,
	resolveEdayaContextMode,
	type FocusName,
	type GeneratorName,
} from "@children-ai/adaptors";
import {
	openSparkDatabase,
	PostgresSchoolIntegrationVault,
	type SparkPersistence,
} from "@children-ai/adaptor-postgres";
import { parsePalier, resolvePalierEdayaOrigin, resolveVaultMasterKey, type Palier, type SessionStore } from "@children-ai/domain";
import { createIdentityVerifier } from "./identity.ts";
import type { IdentityVerifier } from "./http.ts";
import { assertPersistedPgliteUrl, parseRuntime, type RuntimeKind } from "./runtime/boundaries.ts";

export type LocalRuntime = {
	app: ChildrenAiApp;
	sessions: SessionStore;
	identity: IdentityVerifier;
	generatorName: GeneratorName;
	focusName: FocusName;
	palier: Palier;
	runtime: RuntimeKind;
	schoolId: string;
	contextMode: "fixture" | "http";
	persistence: SparkPersistence;
};

const repoRoot = join(import.meta.dir, "../../..");

export async function createLocalRuntime(): Promise<LocalRuntime> {
	loadRepoEnvFile();
	const runtime = parseRuntime(process.env.RUNTIME, "local");
	if (runtime === "worker") {
		throw new Error(
			"RUNTIME=worker boots from the Cloudflare Worker entry (HYPERDRIVE), not the local Bun process.",
		);
	}
	const palier = parsePalier(process.env.PALIER, "local");
	resolvePalierEdayaOrigin(palier, process.env.EDAYA_API_ORIGIN);
	const databaseUrl = runtime === "in-memory" ? "pglite" : assertPersistedPgliteUrl(process.env.DATABASE_URL);
	const persistence = await openSparkDatabase(databaseUrl, { repoRoot });
	const ids = new CryptoIdGenerator();
	const contextMode = resolveEdayaContextMode(
		palier,
		process.env.EDAYA_CONTEXT,
		process.env.EDAYA_DEMO_API_KEY,
		process.env.EDAYA_API_ORIGIN,
	);
	const clock = createRuntimeClock({
		contextMode,
		fixtureToday: process.env.FIXTURE_TODAY,
	});
	const geminiKey = process.env.GEMINI_API_KEY;
	const generatorName = resolveGeneratorName({
		generator: process.env.GENERATOR,
		geminiApiKey: geminiKey,
	});
	const focusName = resolveFocusName(process.env.FOCUS);
	const rag = focusName === "cloudflare" || generatorName === "rag"
		? createCloudflareRagClient({
			accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
			apiToken: process.env.CLOUDFLARE_API_TOKEN,
			namespace: process.env.CLOUDFLARE_RAG_NAMESPACE,
			instance: process.env.CLOUDFLARE_RAG_INSTANCE,
			byokAlias: process.env.CLOUDFLARE_BYOK_ALIAS,
		})
		: undefined;
	const credentials = new PostgresSchoolIntegrationVault(
		persistence.db,
		resolveVaultMasterKey(palier, process.env.VAULT_MASTER_KEY),
	);
	const demo = createSchoolEdayaStack({
		palier,
		schoolId: process.env.EDAYA_DEMO_SCHOOL_ID,
		edayaApiBaseUrl: process.env.EDAYA_API_ORIGIN,
		academicYearId: process.env.EDAYA_DEMO_ACADEMIC_YEAR_ID,
		apiKey: process.env.EDAYA_DEMO_API_KEY,
		contextMode: process.env.EDAYA_CONTEXT,
		credentials,
		seedDemoSchool: palier !== "prod",
		resolveGuardianSecret: process.env.CHILDREN_AI_RESOLVE_SECRET,
	});
	await demo.ready;

	const app = new ChildrenAiApp({
		edaya: demo.edaya,
		focus: createPracticeFocus({
			focus: focusName,
			rag,
			model: process.env.FOCUS_MODEL,
			packVersion: process.env.RAG_PACK_VERSION,
		}),
		generator: createExerciseGenerator({
			ids,
			clock,
			generator: generatorName,
			apiKey: geminiKey,
			model: process.env.GEMINI_MODEL,
			rag,
			ragModel: process.env.RAG_GENERATOR_MODEL,
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
		identity: createIdentityVerifier(),
		generatorName,
		focusName,
		palier,
		runtime,
		schoolId: demo.schoolId,
		contextMode: demo.contextMode,
		persistence,
	};
}

function loadRepoEnvFile() {
	const envPath = join(repoRoot, ".env");
	if (!existsSync(envPath)) return;
	for (const raw of readFileSync(envPath, "utf8").split(/\r?\n/)) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		const eq = line.indexOf("=");
		if (eq <= 0) continue;
		const key = line.slice(0, eq).trim();
		let value = line.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (process.env[key] === undefined) process.env[key] = value;
	}
}
