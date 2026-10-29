import { describe, expect, test } from "bun:test";
import { corsPreflight } from "./http.ts";

describe("cors preflight", () => {
	test("echoes the staging app origin without opening the database", () => {
		const response = corsPreflight(
			new Request("https://staging.api.spark.edayaplus.com/auth/demo", {
				method: "OPTIONS",
				headers: { Origin: "https://staging.app.spark.edayaplus.com" },
			}),
			["https://staging.app.spark.edayaplus.com"],
		);
		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
			"https://staging.app.spark.edayaplus.com",
		);
		expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
	});

	test("does not reflect an unknown origin", () => {
		const response = corsPreflight(
			new Request("https://staging.api.spark.edayaplus.com/auth/demo", {
				method: "OPTIONS",
				headers: { Origin: "https://evil.example" },
			}),
			["https://staging.app.spark.edayaplus.com"],
		);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});
});
