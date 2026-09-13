import { describe, expect, test } from "bun:test";
import { ChildrenAiApp } from "@children-ai/app";
import {
	createDemoEdayaContext,
	CryptoIdGenerator,
	EmptyGuardianChildrenPort,
	FixtureGuardianChildrenPort,
	InMemoryExerciseSetRepository,
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
import { createHttpApp } from "./http.ts";

const issuer = "http://localhost:9900";
const audience = "http://localhost:8787";

async function createRuntime(
	children: GuardianChildrenPort = new FixtureGuardianChildrenPort(),
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
		palier: demo.palier,
		contextMode: demo.contextMode,
	});
	return { http, keys };
}

async function parentHeaders(
	keys: Awaited<ReturnType<typeof createTestIdentityKeys>>,
	email = "m.kone@mail.ci",
) {
	const token = await signTestIdentityToken(keys, {
		sub: "subject-parent",
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
			contextMode: "fixture",
		});
	});

	test("parent JWT lists fixture children and issues a student code", async () => {
		const { http, keys } = await createRuntime();
		const headers = await parentHeaders(keys);

		const children = await http.request("http://localhost/parent/children", { headers });
		expect(children.status).toBe(200);
		const listing = (await children.json()) as {
			children: Array<{ studentId: string; accessCode: null | { hint: string } }>;
		};
		expect(listing.children[0]?.studentId).toBe("ci-s1");
		expect(listing.children[0]?.accessCode).toBeNull();

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
		expect((await home.json()) as { lessonTitle: string }).toMatchObject({
			lessonTitle: "Fractions",
		});
	});

	test("student can generate once then receives ALREADY_GENERATED", async () => {
		const { http, keys } = await createRuntime();
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
});
