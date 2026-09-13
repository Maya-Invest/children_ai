import { describe, expect, test } from "bun:test";
import { ChildrenAiApp, learnerRef } from "@children-ai/app";
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
import {
	AlreadyGeneratedError,
	ChildNotLinkedError,
	GuardianCannotGenerateError,
	UnknownAccessCodeError,
	type GuardianChildrenPort,
} from "@children-ai/domain";
import { FIXTURE_STUDENT_ID as AMINA_ID } from "@children-ai/adaptors";

function createApp(children: GuardianChildrenPort = new FixtureGuardianChildrenPort()) {
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
	return { app, sessions };
}

async function fixtureStudent(app: ChildrenAiApp) {
	const guardian = await app.resolveGuardian({
		subjectId: "sub-parent",
		email: "m.kone@mail.ci",
	});
	const issued = await app.issueAccessCode(guardian, AMINA_ID);
	const student = await app.signInStudent(issued.code);
	return { guardian, issued, student };
}

describe("ChildrenAiApp", () => {
	test("suggests fractions from the weakest MATH mark", async () => {
		const { app } = createApp();
		const { student } = await fixtureStudent(app);
		const home = await app.getHome(learnerRef(student));
		expect(home.lessonTitle).toBe("Fractions");
		expect(home.currentSet).toBeNull();
	});

	test("allows generate once per snapshot then rejects regenerate", async () => {
		const { app } = createApp();
		const { student } = await fixtureStudent(app);
		const first = await app.generate(student);
		expect(first.questions.length).toBeGreaterThan(0);
		expect(first.schoolId).toBe(student.schoolId);
		expect(first.lessonId).toBe("ci.college.6e.math.c1.t1.l3");

		const home = await app.getHome(learnerRef(student));
		expect(home.currentSet?.id).toBe(first.id);

		await expect(app.generate(student)).rejects.toBeInstanceOf(AlreadyGeneratedError);
	});

	test("does not open a new snapshot when the academic picture is unchanged", async () => {
		const { app } = createApp();
		const { student } = await fixtureStudent(app);
		const a = await app.syncSnapshot(learnerRef(student));
		const b = await app.syncSnapshot(learnerRef(student));
		expect(b.id).toBe(a.id);
	});

	test("forbids parent generation", async () => {
		const { app } = createApp();
		const guardian = await app.resolveGuardian({
			subjectId: "sub-parent",
			email: "m.kone@mail.ci",
		});
		await expect(app.generate(guardian)).rejects.toBeInstanceOf(GuardianCannotGenerateError);
	});

	test("keeps a single active code per student and invalidates the previous session", async () => {
		const { app, sessions } = createApp();
		const guardian = await app.resolveGuardian({
			subjectId: "sub-parent",
			email: "m.kone@mail.ci",
		});
		const first = await app.issueAccessCode(guardian, AMINA_ID);
		const student = await app.signInStudent(first.code);
		await sessions.set("token-1", student);

		const second = await app.issueAccessCode(guardian, AMINA_ID);
		expect(second.code).not.toBe(first.code);
		await expect(app.signInStudent(first.code)).rejects.toBeInstanceOf(UnknownAccessCodeError);
		expect(await sessions.get("token-1")).toBeNull();

		const next = await app.signInStudent(second.code);
		expect(next.codeId).not.toBe(student.codeId);
	});

	test("revoke invalidates the student session", async () => {
		const { app, sessions } = createApp();
		const { guardian, issued, student } = await fixtureStudent(app);
		await sessions.set("token-1", student);
		await app.revokeAccessCode(guardian, issued.studentId);
		await expect(app.signInStudent(issued.code)).rejects.toBeInstanceOf(UnknownAccessCodeError);
		expect(await sessions.get("token-1")).toBeNull();
	});

	test("parent cannot issue a code for an unlinked child", async () => {
		const { app } = createApp(new EmptyGuardianChildrenPort());
		const guardian = await app.resolveGuardian({
			subjectId: "sub-parent",
			email: "nobody@mail.ci",
		});
		await expect(app.issueAccessCode(guardian, AMINA_ID)).rejects.toBeInstanceOf(ChildNotLinkedError);
		const listing = await app.listChildren(guardian);
		expect(listing.children).toEqual([]);
	});

	test("CRON-style sync covers students with an active access code", async () => {
		const { app } = createApp();
		expect(await app.syncLinkedSnapshots()).toEqual([]);
		await fixtureStudent(app);
		const results = await app.syncLinkedSnapshots();
		expect(results.length).toBe(1);
		expect(results[0]?.studentId).toBe("ci-s1");
		const again = await app.syncLinkedSnapshots();
		expect(again[0]?.snapshotId).toBe(results[0]?.snapshotId);
	});
});
