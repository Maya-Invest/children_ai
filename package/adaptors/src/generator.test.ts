import { describe, expect, test } from "bun:test";
import type { CurriculumLesson, LearnerAcademicSnapshot } from "@children-ai/domain";
import { CryptoIdGenerator, SystemClock } from "./runtime.ts";
import { createExerciseGenerator, resolveGeneratorName } from "./generator.ts";
import { GeminiFlashExerciseGenerator, type GeminiFetch } from "./generator-gemini.ts";
import { StubExerciseGenerator } from "./generator-stub.ts";

const lesson: CurriculumLesson = {
	id: "ci.college.6e.math.c1.t1.l3",
	packVersion: "pack",
	country: "CI",
	cycle: "college",
	grade: "6e",
	subject: "MATH",
	competence: { id: "c1", title: "Calculs" },
	theme: { id: "t1", title: "Nombres" },
	title: "Fractions",
	sequence: 3,
	exampleSituation: "Partager un plat.",
	skills: ["Comparer deux fractions", "Additionner"],
	contents: ["Fractions égales"],
	sourcePdf: "01.pdf",
};

const snapshot: LearnerAcademicSnapshot = {
	id: "snap-1",
	schoolId: "school",
	studentId: "student-1",
	fingerprint: "abc",
	packVersion: "pack",
	createdAt: "2026-09-07T10:00:00.000Z",
	context: {
		student: {
			edayaStudentId: "student-1",
			firstName: "Emma",
			lastName: "Martin",
			grade: "6e",
			classLabel: "6ème 1",
		},
		academicYearId: "2025-2026",
		periodId: "T1",
		marks: [],
		classProgress: [],
		timetable: [],
		observations: [],
	},
};

describe("exercise generator selection", () => {
	test("uses the stub when no Gemini key is set", () => {
		expect(resolveGeneratorName(undefined)).toBe("stub");
		expect(resolveGeneratorName("")).toBe("stub");
		const generator = createExerciseGenerator({
			ids: new CryptoIdGenerator(),
			clock: new SystemClock(),
		});
		expect(generator).toBeInstanceOf(StubExerciseGenerator);
	});

	test("uses Gemini Flash when a key is present", () => {
		expect(resolveGeneratorName("test-key")).toBe("gemini-flash");
		const generator = createExerciseGenerator({
			ids: new CryptoIdGenerator(),
			clock: new SystemClock(),
			apiKey: "test-key",
			fetchImpl: async () => new Response("{}"),
		});
		expect(generator).toBeInstanceOf(GeminiFlashExerciseGenerator);
	});

	test("maps Gemini JSON to an llm set with expected answers and no solution field", async () => {
		const fetchImpl: GeminiFetch = async () =>
			new Response(
				JSON.stringify({
					candidates: [
						{
							content: {
								parts: [
									{
										text: JSON.stringify({
											questions: [
												{
													prompt: "Compare 1/2 et 1/3.",
													kind: "written",
													expectedAnswer: "1/2 > 1/3",
													solution: "must be stripped",
												},
												{ prompt: "Calcule 1/4 + 1/4.", kind: "written", expectedAnswer: "1/2" },
												{
													prompt: "Quelle fraction est la plus grande ?",
													kind: "mcq",
													choices: ["1/5", "1/2", "1/8"],
													expectedAnswer: "1/2",
												},
											],
										}),
									},
								],
							},
						},
					],
				}),
			);

		const generator = new GeminiFlashExerciseGenerator({
			apiKey: "test-key",
			ids: new CryptoIdGenerator(),
			clock: new SystemClock(),
			model: "gemini-3.5-flash",
			fetchImpl,
		});

		const set = await generator.generate({
			snapshot,
			lesson,
			focus: {
				lessonId: lesson.id,
				subject: lesson.subject,
				rationale: "note faible",
				brief: "Voici la série d'exercices suggérée.",
				intent: "improve_results",
			},
		});

		expect(set.generator).toBe("llm");
		expect(set.questions.length).toBe(3);
		expect(JSON.stringify(set)).not.toContain("must be stripped");
		expect(set.questions.some((question) => "solution" in question)).toBe(false);
		expect(set.questions.map((question) => question.kind).sort()).toEqual(["mcq", "written", "written"]);
		expect(set.questions.every((question) => Boolean(question.expectedAnswer))).toBe(true);
		expect(set.questions.find((question) => question.kind === "mcq")?.expectedAnswer).toBe("1/2");
	});
});
