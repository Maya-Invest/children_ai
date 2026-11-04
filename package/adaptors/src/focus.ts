import type { PracticeFocusPort } from "@edaya-spark/domain";
import {
	CloudflarePracticeFocus,
	DEFAULT_FOCUS_MODEL,
	type RagClient,
} from "./cloudflare-rag.ts";
import { StubPracticeFocus } from "./focus-stub.ts";

export type FocusName = "stub" | "cloudflare";

export function resolveFocusName(value: string | undefined): FocusName {
	const raw = value?.trim().toLowerCase() ?? "";
	if (!raw || raw === "stub") return "stub";
	if (raw === "cloudflare") return "cloudflare";
	throw new Error(`Unknown FOCUS "${value}". Use stub or cloudflare.`);
}

export function createPracticeFocus(options: {
	focus?: string;
	rag?: RagClient;
	model?: string;
	packVersion?: string;
	ragEnabled?: boolean;
}): PracticeFocusPort {
	const name = resolveFocusName(options.focus);
	if (name === "stub") return new StubPracticeFocus();
	if (!options.rag) {
		throw new Error("FOCUS=cloudflare requires a Cloudflare RAG client.");
	}
	const model = options.model?.trim() || DEFAULT_FOCUS_MODEL;
	return new CloudflarePracticeFocus({
		rag: options.rag,
		model,
		ragEnabled: options.ragEnabled,
	});
}
