import { describe, expect, test } from "bun:test";
import {
	EdayaContextFetchError,
	PalierOriginMismatchError,
	SchoolIntegrationMissingError,
} from "@children-ai/domain";
import {
	FixtureEdayaContext,
	FIXTURE_SCHOOL_ID,
	FIXTURE_STUDENT_ID,
} from "./edaya-fixture.ts";
import { HttpEdayaContext } from "./edaya-http.ts";
import {
	demoSchoolCredentials,
	deriveLocalChildrenAiApiKey,
	MemorySchoolIntegrationVault,
} from "./school-integration-vault.ts";
import {
	createDemoEdayaContext,
	createSchoolEdayaStack,
	DualEdayaContext,
	SchoolScopedEdayaContext,
} from "./school-scoped-edaya.ts";
import { resolveEdayaContextMode } from "./edaya-context-mode.ts";

describe("SchoolScopedEdayaContext", () => {
	test("pulls demo student context when the school vault row matches the palier", async () => {
		const vault = new MemorySchoolIntegrationVault();
		vault.put(
			demoSchoolCredentials({
				schoolId: FIXTURE_SCHOOL_ID,
				edayaApiBaseUrl: "http://localhost:9999",
			}),
		);
		const edaya = new SchoolScopedEdayaContext(
			"local",
			vault,
			new FixtureEdayaContext(),
		);

		const context = await edaya.pullLearnerContext({
			schoolId: FIXTURE_SCHOOL_ID,
			studentId: FIXTURE_STUDENT_ID,
		});
		expect(context.student.firstName).toBe("Aminata");
		expect(context.student.lastName).toBe("Koné");
		expect(context.student.edayaStudentId).toBe("ci-s1");
	});

	test("fails closed when the school has no integration on this palier", async () => {
		const edaya = new SchoolScopedEdayaContext(
			"local",
			new MemorySchoolIntegrationVault(),
			new FixtureEdayaContext(),
		);

		await expect(
			edaya.pullLearnerContext({
				schoolId: FIXTURE_SCHOOL_ID,
				studentId: FIXTURE_STUDENT_ID,
			}),
		).rejects.toBeInstanceOf(SchoolIntegrationMissingError);
	});

	test("rejects a school row pointed at another palier's EDAYA", async () => {
		const vault = new MemorySchoolIntegrationVault();
		vault.put(
			demoSchoolCredentials({
				schoolId: FIXTURE_SCHOOL_ID,
				edayaApiBaseUrl: "https://api.edayaplus.com",
			}),
		);
		const edaya = new SchoolScopedEdayaContext(
			"local",
			vault,
			new FixtureEdayaContext(),
		);

		await expect(
			edaya.pullLearnerContext({
				schoolId: FIXTURE_SCHOOL_ID,
				studentId: FIXTURE_STUDENT_ID,
			}),
		).rejects.toBeInstanceOf(PalierOriginMismatchError);
	});

	test("createDemoEdayaContext refuses a prod origin on the local palier", () => {
		expect(() =>
			createDemoEdayaContext({
				palier: "local",
				edayaApiBaseUrl: "https://api.edayaplus.com",
			}),
		).toThrow(PalierOriginMismatchError);
	});

	test("refuses the elevated seeding key as a children-ai credential", () => {
		expect(() =>
			demoSchoolCredentials({
				schoolId: FIXTURE_SCHOOL_ID,
				edayaApiBaseUrl: "http://localhost:9999",
				apiKey: "sk_live_dev_edaya_ci_cocody_seeding_integration_key",
			}),
		).toThrow(/seeding key/);
	});
});

describe("HttpEdayaContext", () => {
	test("filters EDAYA lists to the requested student and school", async () => {
		const vault = new MemorySchoolIntegrationVault();
		vault.put(
			demoSchoolCredentials({
				schoolId: FIXTURE_SCHOOL_ID,
				edayaApiBaseUrl: "http://localhost:9999",
				academicYearId: "2025-ci",
				apiKey: "s2s_live_dev_edaya_ci_cocody_children_ai_key01",
			}),
		);

		const calls: string[] = [];
		const edaya = new HttpEdayaContext({
			credentials: vault,
			fetchImpl: async (input, init) => {
				const url = String(input);
				calls.push(url);
				const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, string>;
				const headers = new Headers(init?.headers);
				expect(headers.get("authorization")).toBe(
					"Bearer s2s_live_dev_edaya_ci_cocody_children_ai_key01",
				);
				expect(headers.get("x-academic-year-id")).toBe("2025-ci");
				return new Response(JSON.stringify(payloadFor(url, body)), {
					headers: { "content-type": "application/json" },
				});
			},
		});

		const context = await edaya.pullLearnerContext({
			schoolId: FIXTURE_SCHOOL_ID,
			studentId: "ci-s1",
		});

		expect(context.student.firstName).toBe("Aminata");
		expect(context.student.classLabel).toBe("6ème 1");
		expect(context.student.grade).toBe("6e");
		expect(context.marks).toEqual([
			{
				id: "res-1",
				subject: "Mathématiques",
				title: "Contrôle Fractions",
				score: 7,
				maxScore: 20,
				date: "2025-11-03",
			},
			{
				id: "res-fr",
				subject: "Français",
				title: "Contrôle Lecture",
				score: 12,
				maxScore: 20,
				date: "2025-11-05",
			},
		]);
		expect(context.observations).toEqual(["Fragile sur les fractions."]);
		expect(context.rank?.rank).toBe(18);
		expect(context.classProgress).toEqual([
			{ subject: "Mathématiques", subjectMatter: "Fractions", completedPercentage: 45 },
			{ subject: "Français", subjectMatter: "Lecture", completedPercentage: 30 },
		]);
		expect(context.timetable).toEqual([
			{
				id: "sch-ci-6a-math-mon",
				dayOfWeek: "monday",
				startTime: "08:15",
				endTime: "09:00",
				title: "Mathématiques — fractions",
				kind: "lesson",
			},
			{
				id: "sch-ci-6a-anglais-mon",
				dayOfWeek: "monday",
				startTime: "13:00",
				endTime: "14:00",
				title: "Conversation anglaise",
				kind: "activity",
			},
			{
				id: "sch-ci-6a-math-wed",
				dayOfWeek: "wednesday",
				startTime: "09:15",
				endTime: "10:00",
				title: "Mathématiques — géométrie",
				kind: "lesson",
			},
		]);
		expect(calls.some((url) => url.includes("/schedules/list"))).toBe(true);
		expect(calls.some((url) => url.includes("/students/list"))).toBe(true);
		expect(calls.some((url) => url.includes("/class-subject-progress/list"))).toBe(false);
	});

	test("fills an empty live timetable from the Aminata fixture", async () => {
		const vault = new MemorySchoolIntegrationVault();
		vault.put(
			demoSchoolCredentials({
				schoolId: FIXTURE_SCHOOL_ID,
				edayaApiBaseUrl: "http://localhost:9999",
				academicYearId: "2025-ci",
				apiKey: "s2s_live_dev_edaya_ci_cocody_children_ai_key01",
			}),
		);
		const live = new HttpEdayaContext({
			credentials: vault,
			fetchImpl: async (input, init) => {
				const url = String(input);
				const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, string>;
				if (url.endsWith("/schedules/list")) {
					return jsonResponse([]);
				}
				return jsonResponse(payloadFor(url, body));
			},
		});
		const edaya = new DualEdayaContext(
			new SchoolScopedEdayaContext("local", vault, live),
			new FixtureEdayaContext(),
		);

		const context = await edaya.pullLearnerContext({
			schoolId: FIXTURE_SCHOOL_ID,
			studentId: FIXTURE_STUDENT_ID,
		});

		expect(context.timetable.length).toBeGreaterThan(3);
		expect(context.timetable.some((slot) => slot.id === "sch-ci-6a-math-mon")).toBe(true);
		expect(context.timetable.some((slot) => slot.dayOfWeek === "friday")).toBe(true);
	});

	test("skips live EDAYA when the query asks for fixture context", async () => {
		const live = {
			async pullLearnerContext() {
				throw new EdayaContextFetchError("EDAYA students/list a renvoyé 401.");
			},
		};
		const edaya = new DualEdayaContext(live, new FixtureEdayaContext());

		await expect(
			edaya.pullLearnerContext({
				schoolId: FIXTURE_SCHOOL_ID,
				studentId: FIXTURE_STUDENT_ID,
			}),
		).rejects.toBeInstanceOf(EdayaContextFetchError);

		const context = await edaya.pullLearnerContext({
			schoolId: FIXTURE_SCHOOL_ID,
			studentId: FIXTURE_STUDENT_ID,
			contextSource: "fixture",
		});
		expect(context.student.firstName).toBe("Aminata");
	});

	test("lists only students linked to the authenticated guardian", async () => {
		const vault = new MemorySchoolIntegrationVault();
		vault.put(
			demoSchoolCredentials({
				schoolId: FIXTURE_SCHOOL_ID,
				edayaApiBaseUrl: "http://localhost:9999",
				apiKey: "s2s_live_dev_edaya_ci_cocody_children_ai_key01",
			}),
		);
		const edaya = new HttpEdayaContext({
			credentials: vault,
			resolveGuardian: {
				origin: "http://localhost:9999",
				secret: "local-children-ai-resolve-secret",
			},
			fetchImpl: async (input, init) => {
				const url = String(input);
				expect(url).toBe("http://localhost:9999/internal/children-ai/resolve-guardian");
				const headers = new Headers(init?.headers);
				expect(headers.get("x-children-ai-resolve-secret")).toBe("local-children-ai-resolve-secret");
				const body = JSON.parse(String(init?.body ?? "{}")) as { subjectId?: string };
				expect(body.subjectId).toBe("sub-parent");
				return new Response(JSON.stringify({
					schoolId: "school-uuid",
					displayName: "Awa Diallo",
					children: [
						{ studentId: "stu-live-1", schoolId: "school-uuid", firstName: "Kofi", lastName: "Mensah", classLabel: "6ème 1", grade: "6e" },
						{ studentId: "stu-live-2", schoolId: "school-uuid", firstName: "Amina", lastName: "Diallo", classLabel: "5ème 2", grade: "5e" },
					],
				}));
			},
		});

		const listing = await edaya.listChildren({
			subjectId: "sub-parent",
			email: "awa@mail.ci",
		});
		expect(listing.schoolId).toBe("school-uuid");
		expect(listing.children.map((child) => child.studentId)).toEqual(["stu-live-1", "stu-live-2"]);
		expect(listing.children[0]).toMatchObject({ classLabel: "6ème 1", grade: "6e" });
		expect(listing.children[1]).toMatchObject({ classLabel: "5ème 2", grade: "5e" });
		expect(listing.displayName).toBe("Awa Diallo");
	});

	test("reuses resolve-guardian within the cache window", async () => {
		const vault = new MemorySchoolIntegrationVault();
		vault.put(
			demoSchoolCredentials({
				schoolId: FIXTURE_SCHOOL_ID,
				edayaApiBaseUrl: "http://localhost:9999",
				apiKey: "s2s_live_dev_edaya_ci_cocody_children_ai_key01",
			}),
		);
		let resolveCalls = 0;
		const edaya = new HttpEdayaContext({
			credentials: vault,
			resolveGuardian: {
				origin: "http://localhost:9999",
				secret: "local-children-ai-resolve-secret",
			},
			fetchImpl: async () => {
				resolveCalls += 1;
				return new Response(JSON.stringify({
					schoolId: "school-uuid",
					displayName: "Awa Diallo",
					children: [
						{ studentId: "stu-live-1", schoolId: "school-uuid", firstName: "Kofi", lastName: "Mensah" },
					],
				}));
			},
		});

		const first = await edaya.listChildren({ subjectId: "sub-parent" });
		const second = await edaya.listChildren({ subjectId: "sub-parent" });
		expect(resolveCalls).toBe(1);
		expect(second).toEqual(first);
	});

	test("loads chapter progress in two EDAYA waves instead of one call per chapter", async () => {
		const vault = new MemorySchoolIntegrationVault();
		vault.put(
			demoSchoolCredentials({
				schoolId: FIXTURE_SCHOOL_ID,
				edayaApiBaseUrl: "http://localhost:9999",
				academicYearId: "2025-ci",
				apiKey: "s2s_live_dev_edaya_ci_cocody_children_ai_key01",
			}),
		);
		const calls: string[] = [];
		const edaya = new HttpEdayaContext({
			credentials: vault,
			fetchImpl: async (input, init) => {
				const url = String(input);
				calls.push(url);
				const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, string>;
				if (url.endsWith("/subjects/list")) {
					return jsonResponse([
						{ id: "ci-subj-math", code: "MATH", name: "Mathématiques" },
					]);
				}
				if (url.endsWith("/class-subjects/list")) {
					return jsonResponse([
						{ id: "ci-cs-math", classGroupId: body.classGroupId, subjectId: "ci-subj-math" },
					]);
				}
				if (url.endsWith("/class-subject-matters/list")) {
					return jsonResponse([
						{ id: "csm-1", classSubjectId: "ci-cs-math", subjectMatterId: "sm-1", completedPercentage: 80 },
						{ id: "csm-2", classSubjectId: "ci-cs-math", subjectMatterId: "sm-2", completedPercentage: 45 },
						{ id: "csm-3", classSubjectId: "ci-cs-math", subjectMatterId: "sm-3", completedPercentage: 10 },
					]);
				}
				if (url.endsWith("/subject-matters/list")) {
					return jsonResponse([
						{ id: "sm-1", subjectId: "ci-subj-math", name: "Entiers" },
						{ id: "sm-2", subjectId: "ci-subj-math", name: "Fractions" },
						{ id: "sm-3", subjectId: "ci-subj-math", name: "Proportionnalité" },
					]);
				}
				return jsonResponse(payloadFor(url, body));
			},
		});

		const context = await edaya.pullLearnerContext({
			schoolId: FIXTURE_SCHOOL_ID,
			studentId: "ci-s1",
		});
		expect(context.classProgress).toEqual([
			{ subject: "Mathématiques", subjectMatter: "Entiers", completedPercentage: 80 },
			{ subject: "Mathématiques", subjectMatter: "Fractions", completedPercentage: 45 },
			{ subject: "Mathématiques", subjectMatter: "Proportionnalité", completedPercentage: 10 },
		]);
		expect(calls.filter((url) => url.includes("/class-subject-matters/list"))).toHaveLength(1);
		expect(calls.filter((url) => url.includes("/subject-matters/list"))).toHaveLength(1);
		expect(calls.some((url) => url.includes("/class-subject-progress/list"))).toBe(false);
	});

	test("fails closed when the student belongs to another school", async () => {
		const vault = new MemorySchoolIntegrationVault();
		vault.put(
			demoSchoolCredentials({
				schoolId: FIXTURE_SCHOOL_ID,
				edayaApiBaseUrl: "http://localhost:9999",
				apiKey: "s2s_live_dev_edaya_ci_cocody_children_ai_key01",
			}),
		);
		const edaya = new HttpEdayaContext({
			credentials: vault,
			fetchImpl: async () =>
				new Response(
					JSON.stringify([
						{
							id: "ci-s1",
							schoolId: "sch-other",
							firstName: "Aminata",
							lastName: "Koné",
						},
					]),
				),
		});

		await expect(
			edaya.pullLearnerContext({
				schoolId: FIXTURE_SCHOOL_ID,
				studentId: "ci-s1",
			}),
		).rejects.toBeInstanceOf(EdayaContextFetchError);
	});
});

describe("resolveEdayaContextMode", () => {
	test("defaults local to http when an EDAYA origin is set", () => {
		expect(resolveEdayaContextMode("local", undefined, undefined, "http://localhost:9999")).toBe("http");
		expect(resolveEdayaContextMode("local", undefined, undefined)).toBe("fixture");
		expect(resolveEdayaContextMode("local", "fixture", undefined, "http://localhost:9999")).toBe("fixture");
	});
});

describe("local S2S derive", () => {
	test("puts a deterministic children-ai key when the vault has no row", async () => {
		const schoolId = "550e8400-e29b-41d4-a716-446655440000";
		const stack = createSchoolEdayaStack({
			palier: "local",
			edayaApiBaseUrl: "http://localhost:9999",
			contextMode: "http",
			seedDemoSchool: false,
			deriveLocalS2sKey: true,
		});
		const credentials = await stack.vault.getActive(schoolId);
		expect(credentials?.apiKey).toBe(deriveLocalChildrenAiApiKey(schoolId));
		expect(credentials?.apiKey).toBe("s2s_live_local_550e8400e29b41d4a716446655440000_children_ai01");
	});

	test("does not attach Aminata to Identity parents in compose", async () => {
		const stack = createSchoolEdayaStack({ palier: "in-memory", contextMode: "fixture" });
		const listing = await stack.children.listChildren({ subjectId: "anyone", email: "p@mail.ci" });
		expect(listing.children).toEqual([]);
	});
});

function jsonResponse(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		headers: { "content-type": "application/json" },
	});
}

function payloadFor(url: string, body: Record<string, string>): unknown[] {
	if (url.endsWith("/students/list")) {
		return [
			{
				id: "ci-s1",
				schoolId: FIXTURE_SCHOOL_ID,
				firstName: "Aminata",
				lastName: "Koné",
			},
			{
				id: "ci-s2",
				schoolId: FIXTURE_SCHOOL_ID,
				firstName: "Moussa",
				lastName: "Traoré",
			},
		];
	}
	if (url.endsWith("/enrollments/list")) {
		return [
			{
				id: "ci-enr-s1",
				studentId: "ci-s1",
				classGroupId: "ci-6a",
				academicYearId: "2025-ci",
			},
			{
				id: "ci-enr-s2",
				studentId: "ci-s2",
				classGroupId: "ci-6a",
				academicYearId: "2025-ci",
			},
		];
	}
	if (url.endsWith("/class-groups/list")) {
		return [{ id: "ci-6a", name: "6ème 1", gradeLevelId: "ci-gl-6" }];
	}
	if (url.endsWith("/grade-levels/list")) {
		return [{ id: "ci-gl-6", name: "Sixième", label: "6ème" }];
	}
	if (url.endsWith("/subjects/list")) {
		return [
			{ id: "ci-subj-math", code: "MATH", name: "Mathématiques" },
			{ id: "ci-subj-fr", code: "FR", name: "Français" },
		];
	}
	if (url.endsWith("/assessments/list")) {
		return [
			{
				id: "asmt-1",
				classSubjectId: "ci-cs-math",
				title: "Contrôle Fractions",
				maxScore: 20,
				startsAt: "2025-11-03T09:00:00.000Z",
			},
			{
				id: "asmt-fr",
				classSubjectId: "ci-cs-fr",
				title: "Contrôle Lecture",
				maxScore: 20,
				startsAt: "2025-11-05T09:00:00.000Z",
			},
		];
	}
	if (url.endsWith("/assessment-results/list")) {
		return [
			{ id: "res-1", studentId: "ci-s1", assessmentId: "asmt-1", score: 7 },
			{ id: "res-2", studentId: "ci-s2", assessmentId: "asmt-1", score: 16 },
			{ id: "res-fr", studentId: "ci-s1", assessmentId: "asmt-fr", score: 12 },
		];
	}
	if (url.endsWith("/student-notes/list")) {
		return [
			{
				studentId: "ci-s1",
				visibility: "staff",
				body: "Fragile sur les fractions.",
			},
			{
				studentId: "ci-s1",
				visibility: "admin_only",
				body: "Dossier confidentiel",
			},
			{ studentId: "ci-s2", visibility: "staff", body: "Autre élève" },
		];
	}
	if (url.endsWith("/results/list")) {
		return [
			{
				studentId: "ci-s1",
				rank: 18,
				classSize: 42,
				overallAverage: 11.4,
				periodId: "ci-2025-t1",
			},
		];
	}
	if (url.endsWith("/class-subjects/list")) {
		return [
			{ id: "ci-cs-math", classGroupId: body.classGroupId, subjectId: "ci-subj-math" },
			{ id: "ci-cs-fr", classGroupId: body.classGroupId, subjectId: "ci-subj-fr" },
		];
	}
	if (url.endsWith("/class-subject-matters/list")) {
		return [
			{ id: "csm-1", classSubjectId: "ci-cs-math", subjectMatterId: "sm-frac", completedPercentage: 45 },
			{ id: "csm-fr", classSubjectId: "ci-cs-fr", subjectMatterId: "sm-lecture", completedPercentage: 30 },
		];
	}
	if (url.endsWith("/subject-matters/list")) {
		return [
			{ id: "sm-frac", subjectId: "ci-subj-math", name: "Fractions" },
			{ id: "sm-lecture", subjectId: "ci-subj-fr", name: "Lecture" },
		];
	}
	if (url.endsWith("/class-subject-progress/list")) {
		return [{ classSubjectMatterId: "csm-1", completedPercentage: 45 }];
	}
	if (url.endsWith("/attendances/list")) {
		return [
			{ studentId: "ci-s1", status: "present" },
			{ studentId: "ci-s1", status: "absent" },
		];
	}
	if (url.endsWith("/academic-years/list")) {
		return [{ id: "2025-ci" }];
	}
	if (url.endsWith("/academic-periods/list")) {
		return [
			{
				id: "ci-2025-t1",
				startDate: "2025-09-15",
				endDate: "2025-12-20",
			},
		];
	}
	if (url.endsWith("/schedules/list")) {
		return [
			{
				id: "sch-ci-6a-math-mon",
				classGroupId: "ci-6a",
				scheduleKind: "lesson",
				title: "Mathématiques — fractions",
				isRecurring: true,
				dayOfWeek: "monday",
				startTime: "08:15",
				endTime: "09:00",
			},
			{
				id: "sch-ci-6a-anglais-mon",
				classGroupId: "ci-6a",
				scheduleKind: "activity",
				title: "Conversation anglaise",
				isRecurring: true,
				dayOfWeek: "monday",
				startTime: "13:00",
				endTime: "14:00",
			},
			{
				id: "sch-ci-5a-math-tue",
				classGroupId: "ci-5a",
				scheduleKind: "lesson",
				title: "Mathématiques — équations",
				isRecurring: true,
				dayOfWeek: "tuesday",
				startTime: "08:15",
				endTime: "09:00",
			},
			{
				id: "sch-ci-6a-math-wed",
				classGroupId: "ci-6a",
				scheduleKind: "lesson",
				title: "Mathématiques — géométrie",
				isRecurring: true,
				dayOfWeek: "wednesday",
				startTime: "09:15",
				endTime: "10:00",
			},
		];
	}
	return [];
}
