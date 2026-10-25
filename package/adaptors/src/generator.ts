import type { Clock, ExerciseGeneratorPort, IdGenerator } from "@children-ai/domain";
import {
	CloudflareRagExerciseGenerator,
	DEFAULT_RAG_GENERATOR_MODEL,
	type RagClient,
} from "./cloudflare-rag.ts";
import {
	DEFAULT_GEMINI_FLASH_MODEL,
	GeminiFlashExerciseGenerator,
	type GeminiFetch as GeminiHttp,
} from "./generator-gemini.ts";
import { StubExerciseGenerator } from "./generator-stub.ts";

export type GeneratorName = "stub" | "gemini-flash" | "rag";

export type GeneratorRuntime = {
	ids: IdGenerator;
	clock: Clock;
	generator?: string;
	apiKey?: string;
	model?: string;
	fetchImpl?: GeminiHttp;
	rag?: RagClient;
	ragModel?: string;
};

export function resolveGeneratorName(input: {
	generator?: string;
	geminiApiKey?: string;
} = {}): GeneratorName {
	const raw = input.generator?.trim().toLowerCase() ?? "";
	if (raw === "stub") return "stub";
	if (raw === "gemini" || raw === "gemini-flash") return "gemini-flash";
	if (raw === "rag") return "rag";
	if (raw) throw new Error(`Unknown GENERATOR "${input.generator}". Use stub, gemini, or rag.`);
	return input.geminiApiKey?.trim() ? "gemini-flash" : "stub";
}

export function createExerciseGenerator(runtime: GeneratorRuntime): ExerciseGeneratorPort {
	const name = resolveGeneratorName({
		generator: runtime.generator,
		geminiApiKey: runtime.apiKey,
	});
	if (name === "stub") return new StubExerciseGenerator(runtime.ids);
	if (name === "gemini-flash") {
		const apiKey = runtime.apiKey?.trim() ?? "";
		if (!apiKey) throw new Error("GENERATOR=gemini requires GEMINI_API_KEY.");
		return new GeminiFlashExerciseGenerator({
			apiKey,
			ids: runtime.ids,
			clock: runtime.clock,
			model: runtime.model?.trim() || DEFAULT_GEMINI_FLASH_MODEL,
			fetchImpl: runtime.fetchImpl,
		});
	}
	if (!runtime.rag) throw new Error("GENERATOR=rag requires a Cloudflare RAG client.");
	return new CloudflareRagExerciseGenerator({
		rag: runtime.rag,
		model: runtime.ragModel?.trim() || DEFAULT_RAG_GENERATOR_MODEL,
		ids: runtime.ids,
		clock: runtime.clock,
	});
}
