import { describe, expect, test } from "bun:test";
import { MemoryKv } from "@children-ai/adaptor-cloudflare";
import { createCloudflareRuntime } from "./compose-cloudflare.ts";

describe("createCloudflareRuntime", () => {
	test("staging seeds a per-school vault row and never uses a palier-wide key", async () => {
		const runtime = await createCloudflareRuntime({
			STORE: new MemoryKv(),
			SESSIONS: new MemoryKv(),
			PALIER: "staging",
			EDAYA_API_ORIGIN: "https://staging.api.edayaplus.com",
			EDAYA_DEMO_SCHOOL_ID: "sch-edaya-ci-cocody",
			EDAYA_DEMO_ACADEMIC_YEAR_ID: "2025-ci",
			EDAYA_DEMO_API_KEY: "s2s_live_dev_edaya_ci_cocody_children_ai_key01",
			VAULT_MASTER_KEY: "staging-vault-master-key-for-tests",
			EDAYA_CONTEXT: "fixture",
		});
		expect(runtime.palier).toBe("staging");
		expect(runtime.schoolId).toBe("sch-edaya-ci-cocody");
		expect(runtime.contextMode).toBe("fixture");
	});

	test("prod refuses a demo API key in env", async () => {
		await expect(
			createCloudflareRuntime({
				STORE: new MemoryKv(),
				SESSIONS: new MemoryKv(),
				PALIER: "prod",
				EDAYA_API_ORIGIN: "https://api.edayaplus.com",
				EDAYA_DEMO_API_KEY: "s2s_live_dev_edaya_ci_cocody_children_ai_key01",
				VAULT_MASTER_KEY: "prod-vault-master-key-for-tests",
			}),
		).rejects.toThrow(/EDAYA_DEMO_API_KEY/);
	});

	test("prod refuses the local vault master default", async () => {
		await expect(
			createCloudflareRuntime({
				STORE: new MemoryKv(),
				SESSIONS: new MemoryKv(),
				PALIER: "prod",
				EDAYA_API_ORIGIN: "https://api.edayaplus.com",
				VAULT_MASTER_KEY: "children-ai-local-vault-master-not-for-prod",
			}),
		).rejects.toThrow(/VAULT_MASTER_KEY/);
	});
});
