import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { type Subprocess } from "bun";
import {
	ACADEMIC_YEAR_ID,
	PARENT_SUBJECT_ID,
	RESOLVE_SECRET,
	SCHOOL_ID,
	SECOND_STUDENT_ID,
	S2S_API_KEY,
	STAFF_SUBJECT_ID,
	STUDENT_ID,
} from "./edaya-contract.ts";
import { ENROLLMENT_CONFIRM_CODE, startEdayaDouble, type EdayaDouble } from "./edaya-double.ts";

const repoRoot = path.join(import.meta.dir, "../..");
const evidencePath = path.join(repoRoot, ".ci-evidence", "integration-summary.json");
const apiPort = process.env.EDAYA_SPARK_TEST_PORT ?? "18787";

let standIn: EdayaDouble;
let api: Subprocess | undefined;
let dataDir = "";

beforeAll(async () => {
	standIn = await startEdayaDouble();
}, 20_000);

afterAll(async () => {
	await stopApi();
	await standIn?.stop();
});

test("stand-in rejects a bad resolve secret and a bad S2S key", async () => {
	const resolve = await request(`${standIn.origin}/internal/edaya-spark/resolve-guardian`, {
		method: "POST",
		headers: { "x-edaya-spark-resolve-secret": "wrong-secret" },
		body: JSON.stringify({ subjectId: PARENT_SUBJECT_ID }),
	});
	expect(resolve.status).toBe(401);

	const list = await request(`${standIn.origin}/core/entities/students/list`, {
		method: "POST",
		headers: {
			authorization: "Bearer not-the-school-key",
			"x-academic-year-id": ACADEMIC_YEAR_ID,
		},
		body: JSON.stringify({ schoolId: SCHOOL_ID }),
	});
	expect(list.status).toBe(401);
}, 15_000);

test("live parent and student path uses the simulated Edaya", async () => {
	const evidence: { ok: boolean; studentIds: string[] } = { ok: false, studentIds: [] };
	dataDir = mkdtempSync(path.join(tmpdir(), "edaya-spark-integration-"));
	try {
		api = startApi(standIn.origin, dataDir);
		const health = await waitForHealth(apiUrl("/health"));
		expect(health).toMatchObject({ contextMode: "http", generator: "stub" });

		const signedInParent = await accessTokenAfterLogin("m.kone@mail.ci", false);
		const signedInChildren = await request(apiUrl("/parent/children"), {
			headers: { authorization: `Bearer ${signedInParent}` },
		});
		expect(signedInChildren.status).toBe(200);
		const signedInListing = await signedInChildren.json() as { children: Array<{ studentId: string }> };
		expect(signedInListing.children.map((child) => child.studentId)).toEqual([STUDENT_ID, SECOND_STUDENT_ID]);

		const enrolledStaff = await accessTokenAfterLogin("a.toure@ecole-ci.edaya.dev", true);
		const enrolledChildren = await request(apiUrl("/parent/children"), {
			headers: { authorization: `Bearer ${enrolledStaff}` },
		});
		expect(enrolledChildren.status).toBe(200);
		const enrolledListing = await enrolledChildren.json() as { children: unknown[] };
		expect(enrolledListing.children).toEqual([]);

		const parentToken = await standIn.signParentJwt(PARENT_SUBJECT_ID, "m.kone@mail.ci");
		const parentHeaders = { authorization: `Bearer ${parentToken}` };
		const childrenResponse = await request(apiUrl("/parent/children"), {
			headers: parentHeaders,
		});
		expect(childrenResponse.status).toBe(200);
		const listing = await childrenResponse.json() as {
			children: Array<{ studentId: string }>;
		};
		evidence.studentIds = listing.children.map((child) => child.studentId);
		expect(evidence.studentIds).toEqual([STUDENT_ID, SECOND_STUDENT_ID]);

		const staffToken = await standIn.signParentJwt(STAFF_SUBJECT_ID, "a.toure@ecole-ci.edaya.dev");
		const staffResponse = await request(apiUrl("/parent/children"), {
			headers: { authorization: `Bearer ${staffToken}` },
		});
		expect(staffResponse.status).toBe(200);
		const staffListing = await staffResponse.json() as { children: unknown[] };
		expect(staffListing.children).toEqual([]);

		const issuedResponse = await request(
			apiUrl(`/parent/children/${STUDENT_ID}/access-codes`),
			{ method: "POST", headers: parentHeaders },
		);
		expect(issuedResponse.status).toBe(201);
		const issued = await issuedResponse.json() as { code: string };
		expect(issued.code).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/);

		const studentAuth = await request(apiUrl("/auth/student-code"), {
			method: "POST",
			body: JSON.stringify({ code: issued.code }),
		});
		expect(studentAuth.status).toBe(200);
		const student = await studentAuth.json() as {
			token: string;
			actor: { role: string; schoolId: string; studentId: string };
		};
		expect(student.actor).toMatchObject({
			role: "student",
			schoolId: SCHOOL_ID,
			studentId: STUDENT_ID,
		});

		const homeResponse = await request(apiUrl("/home"), {
			headers: { authorization: `Bearer ${student.token}` },
		});
		expect(homeResponse.status).toBe(200);
		const home = await homeResponse.json() as {
			student?: { classLabel?: string; gradeLevel?: { label?: string } };
			marks: Array<{ subject: string }>;
			timetable: Array<{ title: string }>;
		};
		expect(home.student?.gradeLevel?.label).toBe("6ème");
		expect(home.student?.classLabel).toContain("6ème");
		expect(home.timetable.length).toBeGreaterThan(0);
		expect(home.timetable.some((slot) => slot.title === "Mathématiques")).toBe(true);
		expect(home.marks.map((mark) => mark.subject)).toContain("Mathématiques");

		const studentHeaders = { authorization: `Bearer ${student.token}` };
		const first = await request(apiUrl("/exercise-sets/generate"), {
			method: "POST",
			headers: studentHeaders,
		});
		expect(first.status).toBe(201);
		const second = await request(apiUrl("/exercise-sets/generate"), {
			method: "POST",
			headers: studentHeaders,
		});
		expect(second.status).toBe(409);
		expect(await second.json()).toMatchObject({ error: "ALREADY_GENERATED" });
		evidence.ok = true;
	} finally {
		mkdirSync(path.dirname(evidencePath), { recursive: true });
		writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
		await stopApi();
		if (dataDir) rmSync(dataDir, { recursive: true, force: true });
	}
}, 60_000);

async function accessTokenAfterLogin(email: string, expectEnrollment: boolean): Promise<string> {
	const started = await postAuth("/auth/edaya/otp/start", {
		kind: "email",
		value: email,
		channel: "email",
	});
	expect(started.status).toBe(200);
	const startBody = await started.json() as { state: string; challenge: string };
	expect(startBody.state).toBe("primary_required");

	const revealed = await postAuth("/auth/edaya/testing/otp", { challenge: startBody.challenge });
	expect(revealed.status).toBe(200);
	const { otp } = await revealed.json() as { otp: string };

	const verified = await postAuth("/auth/edaya/otp/verify", { challenge: startBody.challenge, code: otp });
	expect(verified.status).toBe(200);
	const verifiedBody = await verified.json() as {
		state: string;
		challenge?: string;
		proof?: string;
		eligible?: boolean;
	};

	let sessionCookie = "";
	if (expectEnrollment) {
		expect(verifiedBody.state).toBe("enrollment_required");
		expect(verifiedBody.challenge).toBeTruthy();
		const enrolled = await postAuth("/auth/edaya/totp/enroll", { challenge: verifiedBody.challenge });
		expect(enrolled.status).toBe(200);
		const enrolledBody = await enrolled.json() as { state: string; challenge: string; secret?: string };
		expect(enrolledBody.state).toBe("enrollment_required");
		expect(enrolledBody.secret).toBeTruthy();
		const confirmed = await postAuth("/auth/edaya/totp/confirm", {
			challenge: enrolledBody.challenge,
			code: ENROLLMENT_CONFIRM_CODE,
		});
		expect(confirmed.status).toBe(200);
		const confirmedBody = await confirmed.json() as { state: string; recoveryCodes?: string[] };
		expect(confirmedBody.state).toBe("complete");
		expect(confirmedBody.recoveryCodes?.length).toBeGreaterThan(0);
		sessionCookie = sessionCookieFrom(confirmed);
	} else if (verifiedBody.state === "registration_required") {
		expect(verifiedBody.eligible).toBe(true);
		expect(verifiedBody.challenge).toBeTruthy();
		expect(verifiedBody.proof).toBeTruthy();
		const completed = await postAuth("/auth/edaya/registration/complete", {
			challenge: verifiedBody.challenge,
			proof: verifiedBody.proof,
		});
		expect(completed.status).toBe(200);
		const completedBody = await completed.json() as { state: string };
		expect(completedBody.state).toBe("complete");
		sessionCookie = sessionCookieFrom(completed);
	} else {
		expect(verifiedBody.state).toBe("complete");
		sessionCookie = sessionCookieFrom(verified);
	}

	const tokenResponse = await request(`${standIn.origin}/auth/edaya/access-token`, {
		method: "POST",
		headers: { cookie: sessionCookie },
		body: JSON.stringify({ resource: standIn.origin }),
	});
	expect(tokenResponse.status).toBe(200);
	const tokenBody = await tokenResponse.json() as { accessToken: string };
	expect(tokenBody.accessToken).toBeTruthy();
	return tokenBody.accessToken;
}

function postAuth(pathname: string, body: object): Promise<Response> {
	return request(`${standIn.origin}${pathname}`, { method: "POST", body: JSON.stringify(body) });
}

function sessionCookieFrom(response: Response): string {
	const listed = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
	const headers = listed.length > 0 ? listed : [response.headers.get("set-cookie") ?? ""];
	const pair = headers
		.map((value) => value.split(";")[0]?.trim() ?? "")
		.find((value) => value.startsWith("cai_session="));
	if (!pair) throw new Error("Session cookie missing");
	return pair;
}

function apiUrl(pathname: string): string {
	return `http://127.0.0.1:${apiPort}${pathname}`;
}

function request(url: string, init: RequestInit = {}): Promise<Response> {
	const headers = new Headers(init.headers);
	headers.set("connection", "close");
	if (init.body !== undefined && !headers.has("content-type")) {
		headers.set("content-type", "application/json");
	}
	return fetch(url, { ...init, headers });
}

function startApi(origin: string, databaseDir: string): Subprocess {
	const child = Bun.spawn({
		cmd: [process.execPath, "apps/api/src/main.ts"],
		cwd: repoRoot,
		env: {
			...process.env,
			PORT: apiPort,
			RUNTIME: "local",
			PALIER: "local",
			DATABASE_URL: `pglite:${databaseDir}`,
			EDAYA_API_ORIGIN: origin,
			EDAYA_CONTEXT: "http",
			EDAYA_DEMO_SCHOOL_ID: SCHOOL_ID,
			EDAYA_DEMO_ACADEMIC_YEAR_ID: ACADEMIC_YEAR_ID,
			EDAYA_DEMO_API_KEY: S2S_API_KEY,
			EDAYA_SPARK_RESOLVE_SECRET: RESOLVE_SECRET,
			GENERATOR: "stub",
			FOCUS: "stub",
			GEMINI_API_KEY: "",
			FIXTURE_TODAY: "",
			PRACTICE_WEEKDAY: "",
		},
		stdout: "ignore",
		stderr: "ignore",
	});
	child.unref();
	return child;
}

async function waitForHealth(url: string): Promise<{ contextMode: string; generator: string }> {
	const deadline = Date.now() + 30_000;
	let last = "";
	while (Date.now() < deadline) {
		if (api && api.exitCode !== null) {
			throw new Error(`Edaya Spark API exited ${api.exitCode}.`);
		}
		try {
			const response = await request(url);
			if (response.ok) return await response.json() as { contextMode: string; generator: string };
			last = `${response.status} ${await response.text()}`;
		} catch (error) {
			last = error instanceof Error ? error.message : String(error);
		}
		await Bun.sleep(200);
	}
	throw new Error(`Edaya Spark API did not become ready. ${last}`);
}

async function stopApi(): Promise<void> {
	if (!api) return;
	const child = api;
	api = undefined;
	if (process.platform === "win32") {
		const killer = Bun.spawn({
			cmd: ["taskkill", "/F", "/T", "/PID", String(child.pid)],
			stdout: "ignore",
			stderr: "ignore",
		});
		killer.unref();
	} else {
		child.kill();
	}
	child.unref();
}
