import { describe, expect, test } from "bun:test";
import {
	assertEdayaOriginAllowed,
	palierAllowsEdayaOrigin,
	parsePalier,
	PalierOriginMismatchError,
	resolveVaultMasterKey,
} from "./palier.ts";

describe("palier EDAYA origins", () => {
	test("local allows localhost EDAYA and rejects staging/prod", () => {
		expect(palierAllowsEdayaOrigin("local", "http://localhost:9999/")).toBe(
			true,
		);
		expect(
			palierAllowsEdayaOrigin("local", "https://staging.api.edayaplus.com"),
		).toBe(false);
		expect(palierAllowsEdayaOrigin("local", "https://api.edayaplus.com")).toBe(
			false,
		);
	});

	test("staging and prod do not share origins", () => {
		expect(
			palierAllowsEdayaOrigin("staging", "https://staging.api.edayaplus.com"),
		).toBe(true);
		expect(
			palierAllowsEdayaOrigin("staging", "https://api.edayaplus.com"),
		).toBe(false);
		expect(palierAllowsEdayaOrigin("prod", "https://api.edayaplus.com")).toBe(
			true,
		);
		expect(
			palierAllowsEdayaOrigin("prod", "https://staging.api.edayaplus.com"),
		).toBe(false);
	});

	test("assertEdayaOriginAllowed throws PALIER_ORIGIN_MISMATCH", () => {
		expect(() =>
			assertEdayaOriginAllowed("local", "https://api.edayaplus.com"),
		).toThrow(PalierOriginMismatchError);
	});

	test("parsePalier falls back and rejects unknown values", () => {
		expect(parsePalier(undefined, "in-memory")).toBe("in-memory");
		expect(parsePalier("local")).toBe("local");
		expect(() => parsePalier("demo")).toThrow(/Unknown palier/);
	});

	test("staging/prod vault master cannot be the local default", () => {
		expect(() => resolveVaultMasterKey("prod", undefined)).toThrow(
			/VAULT_MASTER_KEY/,
		);
		expect(() =>
			resolveVaultMasterKey(
				"staging",
				"children-ai-local-vault-master-not-for-prod",
			),
		).toThrow(/VAULT_MASTER_KEY/);
		expect(resolveVaultMasterKey("local", undefined)).toContain("local");
	});
});
