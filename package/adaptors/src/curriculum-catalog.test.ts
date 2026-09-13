import { describe, expect, test } from "bun:test";
import { JsonCurriculumCatalog } from "./curriculum-catalog.ts";

describe("DPFC collège Maths catalog", () => {
	const catalog = new JsonCurriculumCatalog();

	test("covers 6e–3e under one pack version", () => {
		expect(catalog.packVersion()).toBe("dpfc-college-maths-6e-3e-cnd-0923");
		for (const grade of ["6e", "5e", "4e", "3e"] as const) {
			expect(catalog.listLessons(grade).length).toBeGreaterThan(0);
		}
	});
});
