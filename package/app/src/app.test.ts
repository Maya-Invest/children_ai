import { describe, expect, test } from "bun:test";
import { ChildrenAiApp, learnerRef } from "@children-ai/app";
import {
	createDemoEdayaContext,
	CryptoIdGenerator,
	DualEdayaContext,
	EmptyGuardianChildrenPort,
	FixtureEdayaContext,
	FixtureGuardianChildrenPort,
	FIXTURE_STUDENT_ID as AMINA_ID,
	InMemoryExerciseSetRepository,
	InMemoryPracticeSettingsRepository,
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
	EdayaContextFetchError,
	GuardianCannotGenerateError,
	UnknownAccessCodeError,
	type EdayaContextPort,
	type GuardianChildrenPort,
} from "@children-ai/domain";

function createAppWithSets(
	children: GuardianChildrenPort = new FixtureGuardianChildrenPort(),
	edaya?: EdayaContextPort,
) {
	const ids = new CryptoIdGenerator();
	const demo = createDemoEdayaContext({ palier: "in-memory" });
	const sessions = new MemorySessionStore();
	const sets = new InMemoryExerciseSetRepository();
	const app = new ChildrenAiApp({
		edaya: edaya ?? demo.edaya,
		catalog: new JsonCurriculumCatalog(),
		generator: new StubExerciseGenerator(ids),
		snapshots: new InMemorySnapshotRepository(),
		sets,
		practiceSettings: new InMemoryPracticeSettingsRepository(),
		codes: new InMemoryStudentAccessCodeRepository(),
		children,
		studentSessions: sessions,
		clock: new SystemClock(),
		ids,
		syncDebounceMs: 0,
	});
	return { app, sessions, sets };
}

function createApp(
	children: GuardianChildrenPort = new FixtureGuardianChildrenPort(),
	edaya?: EdayaContextPort,
) {
	const { app, sessions } = createAppWithSets(children, edaya);
	return { app, sessions };
}

class ThrowingGuardianChildrenPort implements GuardianChildrenPort {
	async listChildren(): Promise<never> {
		throw new Error("EDAYA resolve-guardian a renvoyé 401.");
	}
}

function throwingLiveEdaya(): EdayaContextPort {
	return {
		async pullLearnerContext() {
			throw new EdayaContextFetchError("EDAYA students/list a renvoyé 401.");
		},
	};
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
	test("suggests fractions from the weakest mark that has an official pack", async () => {
		const { app } = createApp();
		const { student } = await fixtureStudent(app);
		const home = await app.getHome(learnerRef(student));
		expect(home.lessonTitle).toBe("Fractions");
		expect(home.focus.subject).toBe("MATH");
		expect(home.focus.rationale).toContain("Mathématiques");
		expect(home.focus.rationale).not.toMatch(/MATH «/);
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

	test("demo sign-in uses fixture Aminata without a parent code", async () => {
		const { app } = createApp(new EmptyGuardianChildrenPort());
		const student = await app.signInDemo();
		expect(student.studentId).toBe("ci-s1");
		expect(student.sessionKind).toBe("demo");
		const home = await app.getHome(learnerRef(student));
		expect(home.lessonTitle).toBe("Fractions");
	});

	test("demo guardian lists Aminata even when Identity children are empty", async () => {
		const { app } = createApp(new EmptyGuardianChildrenPort());
		const guardian = await app.signInDemoGuardian();
		expect(guardian.sessionKind).toBe("demo");
		const listing = await app.listChildren(guardian);
		expect(listing.children.map((child) => child.studentId)).toEqual(["ci-s1"]);
		expect(listing.displayName).toBe("Mariam Koné");
	});

	test("demo-issued student codes use fixture EDAYA; Identity codes stay on live", async () => {
		const edaya = new DualEdayaContext(throwingLiveEdaya(), new FixtureEdayaContext());

		const { app: demoApp } = createApp(new ThrowingGuardianChildrenPort(), edaya);
		const guardian = await demoApp.signInDemoGuardian();
		const issued = await demoApp.issueAccessCode(guardian, AMINA_ID);
		const demoStudent = await demoApp.signInStudent(issued.code);
		expect(demoStudent.sessionKind).toBe("code");
		expect(demoStudent.displayName).toBe("Aminata Koné");
		expect(learnerRef(demoStudent).contextSource).toBe("fixture");
		const home = await demoApp.getHome(learnerRef(demoStudent));
		expect(home.lessonTitle).toBe("Fractions");
		const synced = await demoApp.syncLinkedSnapshots();
		expect(synced.map((item) => item.studentId)).toEqual(["ci-s1"]);

		const { app: liveApp } = createApp(new FixtureGuardianChildrenPort(), edaya);
		const { student } = await fixtureStudent(liveApp);
		expect(learnerRef(student).contextSource).toBeUndefined();
		await expect(liveApp.getHome(learnerRef(student))).rejects.toBeInstanceOf(
			EdayaContextFetchError,
		);
	});

	test("student submit scores answers and hides the corrigé until the parent releases it", async () => {
		const { app } = createApp();
		const { guardian, student } = await fixtureStudent(app);
		const generated = await app.generate(student);
		expect(generated.questions.some((question) => question.kind === "mcq")).toBe(true);
		expect(generated.questions.some((question) => question.kind === "written")).toBe(true);
		expect(generated.questions.every((question) => question.expectedAnswer === undefined)).toBe(true);

		const parentHome = await app.getHome(learnerRef(student), "guardian");
		const expected = parentHome.currentSet?.questions ?? [];
		expect(expected.every((question) => Boolean(question.expectedAnswer))).toBe(true);

		const submitted = await app.submitSet(
			student,
			generated.id,
			expected.map((question) => ({
				questionId: question.id,
				value: question.expectedAnswer ?? "",
			})),
		);
		expect(submitted.score).toBeUndefined();
		expect(submitted.questions.every((question) => question.expectedAnswer === undefined)).toBe(true);
		expect(submitted.questions.every((question) => question.correct === undefined)).toBe(true);
		expect(submitted.correctionReleasedAt).toBeNull();

		await expect(app.submitSet(student, generated.id, [])).rejects.toMatchObject({
			code: "ALREADY_SUBMITTED",
		});

		const released = await app.releaseCorrection(guardian, student.studentId);
		expect(released.correctionReleasedAt).toBeTruthy();
		const studentView = await app.getSet(learnerRef(student), generated.id, "student");
		expect(studentView?.score).toEqual({ correct: expected.length, total: expected.length });
		expect(studentView?.questions[0]?.expectedAnswer).toBe(expected[0]?.expectedAnswer);
		expect(studentView?.questions.every((question) => question.correct === true)).toBe(true);
	});

	test("student can save in-progress answers without submitting the series", async () => {
		const { app } = createApp();
		const { student } = await fixtureStudent(app);
		const generated = await app.generate(student);
		const firstId = generated.questions[0]?.id;
		expect(firstId).toBeTruthy();

		const saved = await app.saveSetProgress(student, generated.id, [
			{ questionId: firstId ?? "", value: "brouillon" },
		]);
		expect(saved.submittedAt).toBeUndefined();
		expect(saved.score).toBeUndefined();
		expect(saved.questions.every((question) => question.expectedAnswer === undefined)).toBe(true);
		expect(saved.answers?.find((answer) => answer.questionId === firstId)?.value).toBe("brouillon");

		const reloaded = await app.getSet(learnerRef(student), generated.id, "student");
		expect(reloaded?.submittedAt).toBeUndefined();
		expect(reloaded?.answers?.find((answer) => answer.questionId === firstId)?.value).toBe("brouillon");

		await expect(app.saveSetProgress(student, generated.id, [])).resolves.toMatchObject({
			id: generated.id,
		});

		const submitted = await app.submitSet(student, generated.id, [
			{ questionId: firstId ?? "", value: "brouillon" },
		]);
		expect(submitted.submittedAt).toBeTruthy();
		await expect(app.saveSetProgress(student, generated.id, [])).rejects.toMatchObject({
			code: "ALREADY_SUBMITTED",
		});
	});

	test("does not submit a series when every answer is empty", async () => {
		const { app } = createApp();
		const { student } = await fixtureStudent(app);
		const generated = await app.generate(student);

		await expect(
			app.submitSet(
				student,
				generated.id,
				generated.questions.map((question) => ({
					questionId: question.id,
					value: "   ",
				})),
			),
		).rejects.toMatchObject({ code: "EMPTY_SUBMISSION" });

		const reloaded = await app.getSet(learnerRef(student), generated.id, "student");
		expect(reloaded?.submittedAt).toBeUndefined();
		expect(reloaded?.score).toBeUndefined();
	});

	test("does not release a fabricated correction for a legacy ungradable series", async () => {
		const { app, sets } = createAppWithSets();
		const { guardian, student } = await fixtureStudent(app);
		const snapshot = await app.syncSnapshot(learnerRef(student));
		await sets.save({
			id: "legacy-submitted",
			snapshotId: snapshot.id,
			schoolId: student.schoolId,
			studentId: student.studentId,
			lessonId: "ci.college.6e.math.c1.t1.l3",
			generatedAt: "2026-09-13T00:00:00.000Z",
			generator: "stub",
			promptVersion: "stub-v1",
			questions: [{ id: "q1", kind: "written", prompt: "Ancienne question." }],
			answers: [{ questionId: "q1", value: "Une réponse" }],
			submittedAt: "2026-09-13T01:00:00.000Z",
			score: { correct: 0, total: 1 },
		});

		await expect(
			app.releaseCorrection(guardian, student.studentId, "legacy-submitted"),
		).rejects.toMatchObject({ code: "CORRECTION_UNAVAILABLE" });
	});

	test("does not release a correction when a legacy submission contains no answer", async () => {
		const { app, sets } = createAppWithSets();
		const { guardian, student } = await fixtureStudent(app);
		const snapshot = await app.syncSnapshot(learnerRef(student));
		await sets.save({
			id: "empty-submitted",
			snapshotId: snapshot.id,
			schoolId: student.schoolId,
			studentId: student.studentId,
			lessonId: "ci.college.6e.math.c1.t1.l3",
			generatedAt: "2026-09-13T00:00:00.000Z",
			generator: "stub",
			promptVersion: "stub-v2",
			questions: [{
				id: "q1",
				kind: "written",
				prompt: "Question sans réponse.",
				expectedAnswer: "Réponse",
			}],
			answers: [{ questionId: "q1", value: " " }],
			submittedAt: "2026-09-13T01:00:00.000Z",
			score: { correct: 0, total: 1 },
		});

		await expect(
			app.releaseCorrection(guardian, student.studentId, "empty-submitted"),
		).rejects.toMatchObject({ code: "EMPTY_SUBMISSION" });
	});

	test("auto-release shows the corrigé to the student as soon as the series is submitted", async () => {
		const { app } = createApp();
		const { guardian, student } = await fixtureStudent(app);
		const generated = await app.generate(student);
		await app.updatePracticeSettings(guardian, student.studentId, true);
		const parentHome = await app.getHome(learnerRef(student), "guardian");
		const submitted = await app.submitSet(
			student,
			generated.id,
			(parentHome.currentSet?.questions ?? []).map((question) => ({
				questionId: question.id,
				value: question.expectedAnswer ?? "",
			})),
		);
		expect(submitted.correctionReleasedAt).toBeTruthy();
		expect(submitted.questions[0]?.expectedAnswer).toBeTruthy();
		expect(submitted.score?.total).toBe(generated.questions.length);
	});

	test("replaces an unsubmitted series that has no expected answers", async () => {
		const { app, sets } = createAppWithSets();
		const { student } = await fixtureStudent(app);
		const snapshot = await app.syncSnapshot(learnerRef(student));
		await sets.save({
			id: "legacy-set",
			snapshotId: snapshot.id,
			schoolId: student.schoolId,
			studentId: student.studentId,
			lessonId: "ci.college.6e.math.c1.t1.l3",
			generatedAt: "2026-09-13T00:00:00.000Z",
			generator: "stub",
			promptVersion: "stub-v1",
			questions: [{ id: "q1", kind: "written", prompt: "Ancienne question." }],
		});
		const home = await app.getHome(learnerRef(student));
		expect(home.exerciseUpgradeAvailable).toBe(true);
		const upgraded = await app.generate(student);
		expect(upgraded.id).toBe("legacy-set");
		expect(upgraded.questions.some((question) => question.kind === "mcq")).toBe(true);
		expect(upgraded.questions.every((question) => question.expectedAnswer === undefined)).toBe(true);
		const parentHome = await app.getHome(learnerRef(student), "guardian");
		expect(parentHome.currentSet?.questions.every((question) => Boolean(question.expectedAnswer))).toBe(true);
	});
});
