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
	MemorySchoolIntegrationVault,
} from "./school-integration-vault.ts";
import { createDemoEdayaContext, SchoolScopedEdayaContext } from "./school-scoped-edaya.ts";

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
				subject: "MATH",
				title: "Contrôle Fractions",
				score: 7,
				maxScore: 20,
				date: "2025-11-03",
			},
		]);
		expect(context.observations).toEqual(["Fragile sur les fractions."]);
		expect(context.rank?.rank).toBe(18);
		expect(calls.some((url) => url.includes("/students/list"))).toBe(true);
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
			schoolId: FIXTURE_SCHOOL_ID,
			fetchImpl: async (input) => {
				const url = String(input);
				if (url.endsWith("/guardians/list")) {
					return new Response(JSON.stringify([
						{
							id: "ci-g1",
							schoolId: FIXTURE_SCHOOL_ID,
							subjectId: "sub-parent",
							email: "m.kone@mail.ci",
							firstName: "Mariam",
							lastName: "Koné",
						},
					]));
				}
				if (url.endsWith("/guardian-links/list")) {
					return new Response(JSON.stringify([
						{ guardianId: "ci-g1", studentId: "ci-s1" },
						{ guardianId: "ci-g1", studentId: "ci-s10" },
					]));
				}
				if (url.endsWith("/students/list")) {
					return new Response(JSON.stringify([
						{ id: "ci-s1", schoolId: FIXTURE_SCHOOL_ID, firstName: "Aminata", lastName: "Koné" },
						{ id: "ci-s10", schoolId: FIXTURE_SCHOOL_ID, firstName: "Yao", lastName: "Koné" },
						{ id: "ci-s2", schoolId: FIXTURE_SCHOOL_ID, firstName: "Moussa", lastName: "Traoré" },
					]));
				}
				return new Response("[]");
			},
		});

		const listing = await edaya.listChildren({
			subjectId: "sub-parent",
			email: "m.kone@mail.ci",
		});
		expect(listing.children.map((child) => child.studentId)).toEqual(["ci-s1", "ci-s10"]);
		expect(listing.displayName).toBe("Mariam Koné");
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
		return [{ id: "ci-subj-math", code: "MATH", name: "Mathématiques" }];
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
		];
	}
	if (url.endsWith("/assessment-results/list")) {
		return [
			{ id: "res-1", studentId: "ci-s1", assessmentId: "asmt-1", score: 7 },
			{ id: "res-2", studentId: "ci-s2", assessmentId: "asmt-1", score: 16 },
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
		return [{ id: "ci-cs-math", classGroupId: body.classGroupId, subjectId: "ci-subj-math" }];
	}
	if (url.endsWith("/class-subject-matters/list")) {
		return [{ id: "csm-1", classSubjectId: "ci-cs-math", subjectMatterId: "sm-frac", completedPercentage: 45 }];
	}
	if (url.endsWith("/subject-matters/list")) {
		return [{ id: "sm-frac", name: "Fractions" }];
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
	return [];
}
