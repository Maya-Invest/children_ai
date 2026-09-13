import type { Clock, ExerciseGeneratorPort, IdGenerator } from "@children-ai/domain";
import { StubExerciseGenerator } from "./generator-stub.ts";
import {
	DEFAULT_GEMINI_FLASH_MODEL,
	GeminiFlashExerciseGenerator,
	type GeminiFetch,
} from "./generator-gemini.ts";

export type GeneratorRuntime = {
	ids: IdGenerator;
	clock: Clock;
	apiKey?: string;
	model?: string;
	fetchImpl?: GeminiFetch;
};

export function resolveGeneratorName(apiKey?: string): "stub" | "gemini-flash" {
	return apiKey?.trim() ? "gemini-flash" : "stub";
}

export function createExerciseGenerator(
	runtime: GeneratorRuntime,
): ExerciseGeneratorPort {
	const apiKey = runtime.apiKey?.trim();
	if (!apiKey) return new StubExerciseGenerator(runtime.ids);
	return new GeminiFlashExerciseGenerator({
		apiKey,
		ids: runtime.ids,
		clock: runtime.clock,
		model: runtime.model?.trim() || DEFAULT_GEMINI_FLASH_MODEL,
		fetchImpl: runtime.fetchImpl,
	});
}
