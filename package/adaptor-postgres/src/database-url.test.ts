import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { postgresPoolConfig } from "./database-url.ts";

describe("postgresPoolConfig", () => {
	test("Hyperdrive disables ssl and drops sslmode", () => {
		const config = postgresPoolConfig(
			"postgres://user:secret@abcdef.hyperdrive.local:5432/neondb?sslmode=require&application_name=spark",
		);
		expect(config.ssl).toBe(false);
		expect(config.max).toBe(1);
		expect(config.connectionString).not.toContain("sslmode");
		expect(config.connectionString).toContain("application_name=spark");
		expect(config.connectionString).toContain("secret");
	});

	test("a direct Neon URL keeps sslmode for CI migrate", () => {
		const url = "postgres://user:secret@ep-example.neon.tech/neondb?sslmode=require";
		const config = postgresPoolConfig(url);
		expect(config.ssl).toBeUndefined();
		expect(config.connectionString).toBe(url);
	});
});

describe("worker module graph", () => {
	test("open and migrate do not statically import PGlite", () => {
		const open = readFileSync(new URL("./open.ts", import.meta.url), "utf8");
		const migrate = readFileSync(new URL("./migrate.ts", import.meta.url), "utf8");
		for (const source of [open, migrate]) {
			const staticImports = [...source.matchAll(/^import\s.+;$/gm)].map((match) => match[0]);
			expect(staticImports.join("\n")).not.toContain("pglite");
			expect(staticImports.join("\n")).not.toContain("node:fs");
		}
	});
});
