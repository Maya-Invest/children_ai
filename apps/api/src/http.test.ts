import { describe, expect, test } from "bun:test";
import { ChildrenAiApp } from "@children-ai/app";
import {
	createDemoEdayaContext,
	createSchoolEdayaStack,
	CryptoIdGenerator,
	FIXTURE_TIMETABLE,
	EmptyGuardianChildrenPort,
	FixtureGuardianChildrenPort,
	InMemoryExerciseSetRepository,
	InMemoryPracticeSettingsRepository,
	InMemorySnapshotRepository,
	InMemoryStudentAccessCodeRepository,
	JsonCurriculumCatalog,
	MemorySessionStore,
	StubExerciseGenerator,
	SystemClock,
} from "@children-ai/adaptors";
import { verifyIdentityToken } from "@maya-invest/edaya-identity-client";
import { createTestIdentityKeys, signTestIdentityToken } from "@maya-invest/edaya-identity-client/testing";
import type { GuardianChildrenPort } from "@children-ai/domain";
import { createHttpApp, type HttpOptions } from "./http.ts";

const issuer = "http://localhost:9900";
const audience = "http://localhost:8787";

async function createRuntime(
	children: GuardianChildrenPort = new EmptyGuardianChildrenPort(),
	httpOptions: Partial<HttpOptions> = {},
) {
	const ids = new CryptoIdGenerator();
	const demo = createDemoEdayaContext({ palier: "in-memory" });
	const sessions = new MemorySessionStore();
	const app = new ChildrenAiApp({
		edaya: demo.edaya,
		catalog: new JsonCurriculumCatalog(),
		generator: new StubExerciseGenerator(ids),
		snapshots: new InMemorySnapshotRepository(),
		sets: new InMemoryExerciseSetRepository(),
		practiceSettings: new InMemoryPracticeSettingsRepository(),
		codes: new InMemoryStudentAccessCodeRepository(),
		children,
		studentSessions: sessions,
		clock: new SystemClock(),
		ids,
		syncDebounceMs: 0,
	});
	const keys = await createTestIdentityKeys();
	const http = createHttpApp(app, {
		sessions,
		identity: {
			verifyAccessToken: (token) =>
				verifyIdentityToken(token, { issuer, audience, jwks: keys.jwks }),
		},
		generatorName: "stub",
		palier: httpOptions.palier ?? demo.palier,
		contextMode: httpOptions.contextMode ?? "http",
	});
	return { http, keys };
}

async function parentHeaders(
	keys: Awaited<ReturnType<typeof createTestIdentityKeys>>,
	email = "m.kone@mail.ci",
	sub = "subject-parent",
) {
	const token = await signTestIdentityToken(keys, {
		sub,
		email,
		iss: issuer,
		aud: audience,
	});
	return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

describe("Hono API", () => {
	test("health reports Hono and the stub generator without keys", async () => {
		const { http } = await createRuntime();
		const response = await http.request("http://localhost/health");
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			ok: true,
			framework: "hono",
			generator: "stub",
			palier: "in-memory",
			schoolTenancy: "per-school",
			contextMode: "http",
		});
	});

	test("parent JWT lists live children and never injects Aminata", async () => {
		const live: GuardianChildrenPort = {
			async listChildren() {
				return {
					schoolId: "school-uuid",
					displayName: "Awa Diallo",
					children: [{
						studentId: "stu-live-1",
						schoolId: "school-uuid",
						firstName: "Kofi",
						lastName: "Mensah",
					}],
				};
			},
		};
		const { http, keys } = await createRuntime(live);
		const headers = await parentHeaders(keys, "awa@mail.ci", "sub-live");
		const children = await http.request("http://localhost/parent/children", { headers });
		expect(children.status).toBe(200);
		const listing = (await children.json()) as {
			children: Array<{ studentId: string }>;
		};
		expect(listing.children.map((child) => child.studentId)).toEqual(["stu-live-1"]);
		expect(listing.children.some((child) => child.studentId === "ci-s1")).toBe(false);
	});

	test("parent JWT with a fixture children port can still issue a student code", async () => {
		const { http, keys } = await createRuntime(new FixtureGuardianChildrenPort());
		const headers = await parentHeaders(keys);

		const children = await http.request("http://localhost/parent/children", { headers });
		expect(children.status).toBe(200);
		const listing = (await children.json()) as {
			children: Array<{ studentId: string; accessCode: null | { hint: string } }>;
		};
		expect(listing.children[0]?.studentId).toBe("ci-s1");
		expect(listing.children[0]?.accessCode).toBeNull();

		const childHome = await http.request("http://localhost/parent/children/ci-s1", { headers });
		expect(childHome.status).toBe(200);
		const childBody = await childHome.json() as {
			lessonTitle: string;
			timetable: unknown[];
			child?: { studentId: string };
		};
		expect(childBody.lessonTitle).toBe("Fractions");
		expect(childBody.child?.studentId).toBe("ci-s1");
		expect(childBody.timetable).toHaveLength(FIXTURE_TIMETABLE.length);
		expect(childBody.timetable[0]).toMatchObject({
			id: "sch-ci-6a-math-mon",
			dayOfWeek: "monday",
			title: "Mathématiques — fractions",
		});

		const issued = await http.request("http://localhost/parent/children/ci-s1/access-codes", {
			method: "POST",
			headers,
		});
		expect(issued.status).toBe(201);
		const body = (await issued.json()) as { code: string; hint: string };
		expect(body.code).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/);

		const studentAuth = await http.request("http://localhost/auth/student-code", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code: body.code }),
		});
		expect(studentAuth.status).toBe(200);
		const { token, actor } = (await studentAuth.json()) as {
			token: string;
			actor: { schoolId: string; studentId: string; role: string };
		};
		expect(actor.role).toBe("student");
		expect(actor.schoolId).toBe("sch-edaya-ci-cocody");
		expect(actor.studentId).toBe("ci-s1");

		const home = await http.request("http://localhost/home", {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(home.status).toBe(200);
		const homeBody = (await home.json()) as {
			lessonTitle: string;
			programmeLine?: string;
			subjects?: string[];
			marks: Array<{ subject: string; title: string }>;
			timetable: unknown[];
			attendance?: { presentRate: number };
		};
		expect(homeBody.lessonTitle).toBe("Fractions");
		expect(homeBody.programmeLine).toContain("6ème 1");
		expect(homeBody.programmeLine).toContain("Français");
		expect(homeBody.programmeLine).not.toMatch(/6ème 1 · Mathématiques · Programme/);
		expect(homeBody.subjects).toEqual(
			expect.arrayContaining(["Mathématiques", "Français", "Histoire-Géographie", "SVT"]),
		);
		expect(homeBody.marks.map((mark) => mark.subject)).toEqual(
			expect.arrayContaining(["Mathématiques", "Français", "Histoire-Géographie"]),
		);
		expect(homeBody.attendance?.presentRate).toBe(0.92);
		expect(homeBody.timetable).toHaveLength(FIXTURE_TIMETABLE.length);
		expect(homeBody.timetable[0]).toMatchObject({
			id: "sch-ci-6a-math-mon",
			dayOfWeek: "monday",
			title: "Mathématiques — fractions",
		});
	});

	test("student can generate once then receives ALREADY_GENERATED", async () => {
		const { http, keys } = await createRuntime(new FixtureGuardianChildrenPort());
		const headers = await parentHeaders(keys);
		const issued = await http.request("http://localhost/parent/children/ci-s1/access-codes", {
			method: "POST",
			headers,
		});
		const { code } = (await issued.json()) as { code: string };
		const auth = await http.request("http://localhost/auth/student-code", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code }),
		});
		const { token } = (await auth.json()) as { token: string };
		const studentHeaders = { Authorization: `Bearer ${token}` };

		const first = await http.request("http://localhost/exercise-sets/generate", {
			method: "POST",
			headers: studentHeaders,
		});
		expect(first.status).toBe(201);

		const second = await http.request("http://localhost/exercise-sets/generate", {
			method: "POST",
			headers: studentHeaders,
		});
		expect(second.status).toBe(409);
		expect(await second.json()).toMatchObject({ error: "ALREADY_GENERATED" });
	});

	test("parent JWT is rejected on student routes and student tokens on parent routes", async () => {
		const { http, keys } = await createRuntime();
		const headers = await parentHeaders(keys);
		const home = await http.request("http://localhost/home", { headers });
		expect(home.status).toBe(403);

		const parent = await http.request("http://localhost/parent/children", {
			headers: { Authorization: "Bearer 00000000-0000-0000-0000-000000000000" },
		});
		expect(parent.status).toBe(401);
	});

	test("http-style empty guardian listing is not filled with demo children", async () => {
		const { http, keys } = await createRuntime(new EmptyGuardianChildrenPort());
		const headers = await parentHeaders(keys, "nobody@mail.ci");
		const children = await http.request("http://localhost/parent/children", { headers });
		expect(children.status).toBe(200);
		const body = (await children.json()) as {
			children: unknown[];
			emptyMessage?: string;
		};
		expect(body.children).toEqual([]);
		expect(body.emptyMessage).toContain("Aucun enfant");
	});

	test("demo parent lists Aminata then student enters only with a generated code", async () => {
		const { http, keys } = await createRuntime();
		const demo = await http.request("http://localhost/auth/demo", { method: "POST" });
		expect(demo.status).toBe(200);
		const body = (await demo.json()) as {
			token: string;
			actor: { role: string; sessionKind?: string; studentId?: string };
			guardian?: { token: string; actor: { role: string; sessionKind?: string } };
		};
		expect(body.actor.role).toBe("guardian");
		expect(body.actor.sessionKind).toBe("demo");
		expect(body.actor.studentId).toBeUndefined();
		expect(body.guardian?.actor.role).toBe("guardian");
		const guardianToken = body.guardian?.token ?? body.token;
		const parentHeadersDemo = { Authorization: `Bearer ${guardianToken}` };

		const skipped = await http.request("http://localhost/home", {
			headers: parentHeadersDemo,
		});
		expect(skipped.status).toBe(401);

		const parentDemo = await http.request("http://localhost/parent/children", {
			headers: parentHeadersDemo,
		});
		expect(parentDemo.status).toBe(200);
		const demoListing = (await parentDemo.json()) as {
			children: Array<{ studentId: string }>;
			displayName: string;
		};
		expect(demoListing.displayName).toBe("Mariam Koné");
		expect(demoListing.children.map((child) => child.studentId)).toEqual(["ci-s1"]);

		const issued = await http.request("http://localhost/parent/children/ci-s1/access-codes", {
			method: "POST",
			headers: { ...parentHeadersDemo, "Content-Type": "application/json" },
		});
		expect(issued.status).toBe(201);
		const { code } = (await issued.json()) as { code: string };

		const studentAuth = await http.request("http://localhost/auth/student-code", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code }),
		});
		expect(studentAuth.status).toBe(200);
		const { token, actor } = (await studentAuth.json()) as {
			token: string;
			actor: { role: string; studentId: string; sessionKind?: string };
		};
		expect(actor.role).toBe("student");
		expect(actor.studentId).toBe("ci-s1");
		expect(actor.sessionKind).toBe("code");

		const home = await http.request("http://localhost/home", {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(home.status).toBe(200);
		const homeBody = (await home.json()) as {
			lessonTitle: string;
			programmeLine?: string;
			subjects?: string[];
			timetable: unknown[];
		};
		expect(homeBody.lessonTitle).toBe("Fractions");
		expect(homeBody.programmeLine).toContain("Français");
		expect(homeBody.subjects).toEqual(
			expect.arrayContaining(["Mathématiques", "Français"]),
		);
		expect(homeBody.timetable).toHaveLength(FIXTURE_TIMETABLE.length);

		const headers = await parentHeaders(keys);
		const children = await http.request("http://localhost/parent/children", { headers });
		expect(children.status).toBe(200);
		const listing = (await children.json()) as { children: unknown[] };
		expect(listing.children).toEqual([]);
	});

	test("demo-issued student code still loads /home when live EDAYA returns 401", async () => {
		const stack = createSchoolEdayaStack({
			palier: "local",
			contextMode: "http",
			seedDemoSchool: true,
			deriveLocalS2sKey: false,
			edayaApiBaseUrl: "http://localhost:9999",
			apiKey: "s2s_live_dev_edaya_ci_cocody_children_ai_key01",
			fetchImpl: async () => new Response("unauthorized", { status: 401 }),
		});
		const ids = new CryptoIdGenerator();
		const sessions = new MemorySessionStore();
		const app = new ChildrenAiApp({
			edaya: stack.edaya,
			catalog: new JsonCurriculumCatalog(),
			generator: new StubExerciseGenerator(ids),
			snapshots: new InMemorySnapshotRepository(),
			sets: new InMemoryExerciseSetRepository(),
			practiceSettings: new InMemoryPracticeSettingsRepository(),
			codes: new InMemoryStudentAccessCodeRepository(),
			children: stack.children,
			studentSessions: sessions,
			clock: new SystemClock(),
			ids,
			syncDebounceMs: 0,
		});
		const keys = await createTestIdentityKeys();
		const http = createHttpApp(app, {
			sessions,
			identity: {
				verifyAccessToken: (token) =>
					verifyIdentityToken(token, { issuer, audience, jwks: keys.jwks }),
			},
			generatorName: "stub",
			palier: "local",
			contextMode: "http",
		});

		const demo = await http.request("http://localhost/auth/demo", { method: "POST" });
		expect(demo.status).toBe(200);
		const { token: guardianToken } = (await demo.json()) as { token: string };
		const issued = await http.request("http://localhost/parent/children/ci-s1/access-codes", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${guardianToken}`,
				"Content-Type": "application/json",
			},
		});
		expect(issued.status).toBe(201);
		const { code } = (await issued.json()) as { code: string };

		const studentAuth = await http.request("http://localhost/auth/student-code", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code }),
		});
		expect(studentAuth.status).toBe(200);
		const { token, actor } = (await studentAuth.json()) as {
			token: string;
			actor: { sessionKind?: string };
		};
		expect(actor.sessionKind).toBe("code");

		const home = await http.request("http://localhost/home", {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(home.status).toBe(200);
		const homeBody = (await home.json()) as { lessonTitle: string };
		expect(homeBody.lessonTitle).toBe("Fractions");
	});

	test("demo login is blocked on palier prod", async () => {
		const { http } = await createRuntime(new EmptyGuardianChildrenPort(), { palier: "prod" });
		const demo = await http.request("http://localhost/auth/demo", { method: "POST" });
		expect(demo.status).toBe(403);
		expect(await demo.json()).toMatchObject({ error: "DEMO_DISABLED" });
	});

	test("student sees the score without the corrigé until the parent releases it", async () => {
		const { http, keys } = await createRuntime(new FixtureGuardianChildrenPort());
		const headers = await parentHeaders(keys);
		const issued = await http.request("http://localhost/parent/children/ci-s1/access-codes", {
			method: "POST",
			headers,
		});
		const { code } = (await issued.json()) as { code: string };
		const auth = await http.request("http://localhost/auth/student-code", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code }),
		});
		const { token } = (await auth.json()) as { token: string };
		const studentHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

		const generated = await http.request("http://localhost/exercise-sets/generate", {
			method: "POST",
			headers: studentHeaders,
		});
		expect(generated.status).toBe(201);
		const { set } = (await generated.json()) as {
			set: {
				id: string;
				questions: Array<{ id: string; expectedAnswer?: string; kind: string }>;
			};
		};
		expect(set.questions.some((question) => question.kind === "mcq")).toBe(true);
		expect(set.questions.every((question) => question.expectedAnswer === undefined)).toBe(true);

		const parentHome = await http.request("http://localhost/parent/children/ci-s1", { headers });
		const parentBody = (await parentHome.json()) as {
			currentSet: { questions: Array<{ id: string; expectedAnswer?: string }> };
			autoReleaseCorrection: boolean;
		};
		expect(parentBody.autoReleaseCorrection).toBe(false);
		expect(parentBody.currentSet.questions.every((question) => Boolean(question.expectedAnswer))).toBe(true);

		const submitted = await http.request(`http://localhost/exercise-sets/${set.id}/submit`, {
			method: "POST",
			headers: studentHeaders,
			body: JSON.stringify({
				answers: parentBody.currentSet.questions.map((question) => ({
					questionId: question.id,
					value: question.expectedAnswer ?? "",
				})),
			}),
		});
		expect(submitted.status).toBe(200);
		const submittedBody = (await submitted.json()) as {
			set: {
				score?: { correct: number; total: number };
				questions: Array<{ expectedAnswer?: string; correct?: boolean }>;
				correctionReleasedAt?: string | null;
			};
		};
		expect(submittedBody.set.score).toBeUndefined();
		expect(submittedBody.set.questions.every((question) => question.expectedAnswer === undefined)).toBe(true);
		expect(submittedBody.set.questions.every((question) => question.correct === undefined)).toBe(true);
		expect(submittedBody.set.correctionReleasedAt).toBeNull();

		const release = await http.request("http://localhost/parent/children/ci-s1/correction/release", {
			method: "POST",
			headers,
			body: JSON.stringify({}),
		});
		expect(release.status).toBe(200);

		const after = await http.request(`http://localhost/exercise-sets/${set.id}`, {
			headers: studentHeaders,
		});
		const afterBody = (await after.json()) as {
			set: {
				score?: { correct: number; total: number };
				questions: Array<{ expectedAnswer?: string; correct?: boolean }>;
			};
		};
		expect(afterBody.set.score?.correct).toBe(set.questions.length);
		expect(afterBody.set.questions[0]?.expectedAnswer).toBe(
			parentBody.currentSet.questions[0]?.expectedAnswer,
		);
		expect(afterBody.set.questions.every((question) => question.correct === true)).toBe(true);
	});

	test("student can save progress without submitting", async () => {
		const { http, keys } = await createRuntime(new FixtureGuardianChildrenPort());
		const headers = await parentHeaders(keys);
		const issued = await http.request("http://localhost/parent/children/ci-s1/access-codes", {
			method: "POST",
			headers,
		});
		const { code } = (await issued.json()) as { code: string };
		const auth = await http.request("http://localhost/auth/student-code", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code }),
		});
		const { token } = (await auth.json()) as { token: string };
		const studentHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

		const generated = await http.request("http://localhost/exercise-sets/generate", {
			method: "POST",
			headers: studentHeaders,
		});
		const { set } = (await generated.json()) as {
			set: { id: string; questions: Array<{ id: string }> };
		};
		const firstId = set.questions[0]?.id ?? "";

		const progress = await http.request(`http://localhost/exercise-sets/${set.id}/progress`, {
			method: "POST",
			headers: studentHeaders,
			body: JSON.stringify({
				answers: [{ questionId: firstId, value: "brouillon" }],
			}),
		});
		expect(progress.status).toBe(200);
		const progressBody = (await progress.json()) as {
			set: {
				submittedAt?: string;
				score?: { correct: number };
				answers?: Array<{ questionId: string; value: string }>;
				questions: Array<{ expectedAnswer?: string; correct?: boolean }>;
			};
		};
		expect(progressBody.set.submittedAt).toBeUndefined();
		expect(progressBody.set.score).toBeUndefined();
		expect(progressBody.set.answers?.find((answer) => answer.questionId === firstId)?.value).toBe(
			"brouillon",
		);
		expect(progressBody.set.questions.every((question) => question.expectedAnswer === undefined)).toBe(
			true,
		);
		expect(progressBody.set.questions.every((question) => question.correct === undefined)).toBe(true);

		const emptySubmission = await http.request(
			`http://localhost/exercise-sets/${set.id}/submit`,
			{
				method: "POST",
				headers: studentHeaders,
				body: JSON.stringify({ answers: [] }),
			},
		);
		expect(emptySubmission.status).toBe(400);
		expect(await emptySubmission.json()).toMatchObject({ error: "EMPTY_SUBMISSION" });
	});
});
