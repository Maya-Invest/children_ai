import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ChildrenAiApp } from "@children-ai/app";
import {
	createExerciseGenerator,
	createSchoolEdayaStack,
	CryptoIdGenerator,
	JsonCurriculumCatalog,
	MemorySessionStore,
	resolveGeneratorName,
	SystemClock,
	type SessionStore,
} from "@children-ai/adaptors";
import {
	FileExerciseSetRepository,
	FilePracticeSettingsRepository,
	FileSnapshotRepository,
	FileStudentAccessCodeRepository,
	JsonFileStore,
} from "@children-ai/adaptors/file-store";
import { parsePalier, resolvePalierEdayaOrigin, type Palier } from "@children-ai/domain";
import { createIdentityVerifier } from "./identity.ts";
import type { IdentityVerifier } from "./http.ts";

export type LocalRuntime = {
	app: ChildrenAiApp;
	sessions: SessionStore;
	identity: IdentityVerifier;
	generatorName: "stub" | "gemini-flash";
	palier: Palier;
	schoolId: string;
	contextMode: "fixture" | "http";
};

export function createLocalRuntime(): LocalRuntime {
	loadRepoEnvFile();
	const palier = parsePalier(process.env.PALIER, "local");
	resolvePalierEdayaOrigin(palier, process.env.EDAYA_API_ORIGIN);
	const dataDir = process.env.DATA_DIR ?? join(import.meta.dir, "../../../.data");
	const store = new JsonFileStore(join(dataDir, "store.json"));
	const ids = new CryptoIdGenerator();
	const clock = new SystemClock();
	const geminiKey = process.env.GEMINI_API_KEY;
	const generatorName = resolveGeneratorName(geminiKey);
	const demo = createSchoolEdayaStack({
		palier,
		schoolId: process.env.EDAYA_DEMO_SCHOOL_ID,
		edayaApiBaseUrl: process.env.EDAYA_API_ORIGIN,
		academicYearId: process.env.EDAYA_DEMO_ACADEMIC_YEAR_ID,
		apiKey: process.env.EDAYA_DEMO_API_KEY,
		contextMode: process.env.EDAYA_CONTEXT,
		seedDemoSchool: palier !== "prod",
		resolveGuardianSecret: process.env.CHILDREN_AI_RESOLVE_SECRET,
	});
	const sessions = new MemorySessionStore();

	const app = new ChildrenAiApp({
		edaya: demo.edaya,
		catalog: new JsonCurriculumCatalog(),
		generator: createExerciseGenerator({
			ids,
			clock,
			apiKey: geminiKey,
			model: process.env.GEMINI_MODEL,
		}),
		snapshots: new FileSnapshotRepository(store),
		sets: new FileExerciseSetRepository(store),
		practiceSettings: new FilePracticeSettingsRepository(store),
		codes: new FileStudentAccessCodeRepository(store),
		children: demo.children,
		studentSessions: sessions,
		clock,
		ids,
	});

	return {
		app,
		sessions,
		identity: createIdentityVerifier(),
		generatorName,
		palier,
		schoolId: demo.schoolId,
		contextMode: demo.contextMode,
	};
}

export function createApp(): ChildrenAiApp {
	return createLocalRuntime().app;
}

function loadRepoEnvFile() {
	const envPath = join(import.meta.dir, "../../../.env");
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
