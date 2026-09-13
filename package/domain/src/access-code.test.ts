import { describe, expect, test } from "bun:test";
import {
	formatStudentAccessCode,
	generateStudentAccessCode,
	hashStudentAccessCode,
	isCompleteStudentAccessCode,
	normalizeStudentAccessCode,
	studentAccessCodeHint,
} from "./access-code.ts";

describe("student access codes", () => {
	test("normalizes case and strips cosmetic dashes", () => {
		expect(normalizeStudentAccessCode("a123-b456-c789-d125")).toBe("A123B456C789D125");
		expect(formatStudentAccessCode("a123b456c789d125")).toBe("A123-B456-C789-D125");
		expect(studentAccessCodeHint("A123-B456-C789-D125")).toBe("D125");
		expect(isCompleteStudentAccessCode("A123-B456-C789-D125")).toBe(true);
		expect(isCompleteStudentAccessCode("SHORT")).toBe(false);
	});

	test("hashes the normalized plaintext, not the dashed display form", async () => {
		const dashed = "A123-B456-C789-D125";
		const compact = "A123B456C789D125";
		expect(await hashStudentAccessCode(dashed)).toBe(await hashStudentAccessCode(compact));
		expect(await hashStudentAccessCode(dashed.toLowerCase())).toBe(
			await hashStudentAccessCode(compact),
		);
	});

	test("generates 16 alphanumeric characters grouped by four", () => {
		const code = generateStudentAccessCode(
			Uint8Array.from({ length: 16 }, (_, index) => index),
		);
		expect(code).toBe("ABCD-EFGH-IJKL-MNOP");
		expect(normalizeStudentAccessCode(code)).toHaveLength(16);
	});
});
