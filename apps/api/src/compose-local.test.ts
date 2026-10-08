import { describe, expect, test } from "bun:test";
import { createLocalRuntime } from "./compose.ts";

describe("createLocalRuntime", () => {
	test("refuses ephemeral PGlite and the worker profile", async () => {
		const previousUrl = process.env.DATABASE_URL;
		const previousRuntime = process.env.RUNTIME;
		try {
			process.env.RUNTIME = "local";
			process.env.DATABASE_URL = "pglite";
			await expect(createLocalRuntime()).rejects.toThrow(/pglite:\.data\/spark/);

			process.env.RUNTIME = "worker";
			await expect(createLocalRuntime()).rejects.toThrow(/HYPERDRIVE/);
		} finally {
			restore("DATABASE_URL", previousUrl);
			restore("RUNTIME", previousRuntime);
		}
	});
});

function restore(key: string, value: string | undefined) {
	if (value === undefined) delete process.env[key];
	else process.env[key] = value;
}
