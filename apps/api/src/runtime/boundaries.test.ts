import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
	assertPersistedPgliteUrl,
	assertWorkerHyperdrive,
	parseRuntime,
} from "./boundaries.ts";

const repoRoot = join(import.meta.dir, "../../../..");

describe("spark runtime boundaries", () => {
	test("local requires a persisted PGlite directory", () => {
		expect(assertPersistedPgliteUrl("pglite:.data/spark")).toBe("pglite:.data/spark");
		expect(() => assertPersistedPgliteUrl("pglite")).toThrow(/pglite:\.data\/spark/);
		expect(() => assertPersistedPgliteUrl("postgres://localhost/spark")).toThrow(/pglite:\.data\/spark/);
		expect(() => assertPersistedPgliteUrl(undefined)).toThrow(/pglite:\.data\/spark/);
	});

	test("worker requires a Hyperdrive connection string", () => {
		expect(assertWorkerHyperdrive("postgres://hyperdrive/spark")).toBe("postgres://hyperdrive/spark");
		expect(() => assertWorkerHyperdrive(undefined)).toThrow(/HYPERDRIVE/);
		expect(() => assertWorkerHyperdrive("")).toThrow(/HYPERDRIVE/);
	});

	test("RUNTIME is separate from PALIER", () => {
		expect(parseRuntime(undefined)).toBe("local");
		expect(parseRuntime("in-memory")).toBe("in-memory");
		expect(() => parseRuntime("staging")).toThrow(/RUNTIME/);
	});

	test(".env.example pins local PGlite and does not treat in-memory as a palier", () => {
		const example = readFileSync(join(repoRoot, ".env.example"), "utf8");
		expect(example).toContain("RUNTIME=local");
		expect(example).toContain("DATABASE_URL=pglite:.data/spark");
		expect(example).not.toContain("DATA_DIR=");
		const palierLine = example.split(/\r?\n/).find((line) => line.startsWith("# Palier"));
		expect(palierLine ?? "").not.toContain("in-memory");
	});

	test("wrangler binds Hyperdrive and no KV namespaces", () => {
		const wrangler = readFileSync(join(repoRoot, "apps/api/wrangler.jsonc"), "utf8");
		expect(wrangler).not.toContain("kv_namespaces");
		const bindings = wrangler.match(/"binding": "HYPERDRIVE"/g) ?? [];
		expect(bindings.length).toBe(3);
	});
});
