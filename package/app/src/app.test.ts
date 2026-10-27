import { describe, expect, test } from "bun:test";
import { EdayaSparkApp, learnerRef } from "@edaya-spark/app";
import {
	createDemoEdayaContext,
	CryptoIdGenerator,
	DualEdayaContext,
	EmptyGuardianChildrenPort,
	FixtureEdayaContext,
	FixtureGuardianChildrenPort,
	FIXTURE_STUDENT_ID as LEA_ID,
	InMemoryExerciseSetRepository,
	InMemoryPracticePlanRepository,
	InMemoryPracticeSettingsRepository,
	InMemorySnapshotRepository,
	InMemoryStudentAccessCodeRepository,
	FIXTURE_CAMILLE_CHAPTER,
	FIXTURE_INES_CHAPTER,
	FIXTURE_LEA_READING,
	FIXTURE_THOMAS_CHAPTER,
	FIXTURE_TIMETABLE,
	FIXTURE_TIMETABLE_BROU,
	StubPracticeFocus,
	MemorySessionStore,
	StubExerciseGenerator,
} from "@edaya-spark/adaptors";
import {
	AlreadyGeneratedError,
	ChildNotLinkedError,
	EdayaContextFetchError,
	GuardianCannotGenerateError,
	NOTHING_TO_PRACTICE_MESSAGE,
	NothingToPracticeError,
	UnknownAccessCodeError,
	type EdayaContextPort,
	type GuardianChildrenPort,
	type PracticeFocusPort,
	type PracticeFocusRequest,
} from "@edaya-spark/domain";

const fixtureMonday = { nowIso: () => "2026-10-05T18:00:00.000Z" };

function createAppWithSets(
	children: GuardianChildrenPort = new FixtureGuardianChildrenPort(),
	edaya?: EdayaContextPort,
	clock: { nowIso(): string } = fixtureMonday,
	options: {
		focus?: PracticeFocusPort;
	} = {},
) {
	const ids = new CryptoIdGenerator();
	const demo = createDemoEdayaContext({ palier: "in-memory" });
	const sessions = new MemorySessionStore();
	const sets = new InMemoryExerciseSetRepository();
	const app = new EdayaSparkApp({
		edaya: edaya ?? demo.edaya,
		focus: options.focus ?? new StubPracticeFocus(),
		generator: new StubExerciseGenerator(ids),
		snapshots: new InMemorySnapshotRepository(),
		sets,
		plans: new InMemoryPracticePlanRepository(),
		practiceSettings: new InMemoryPracticeSettingsRepository(),
		codes: new InMemoryStudentAccessCodeRepository(),
		children,
		studentSessions: sessions,
		clock,
		ids,
		syncDebounceMs: 0,
	});
	return { app, sessions, sets };
}

function createApp(
	children: GuardianChildrenPort = new FixtureGuardianChildrenPort(),
	edaya?: EdayaContextPort,
	clock: { nowIso(): string } = fixtureMonday,
	options: {
		focus?: PracticeFocusPort;
	} = {},
) {
	const { app, sessions } = createAppWithSets(children, edaya, clock, options);
	return { app, sessions };
}

class CountingFocus extends StubPracticeFocus {
	calls = 0;

	override async plan(input: PracticeFocusRequest) {
		this.calls += 1;
		return super.plan(input);
	}
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

async function fixtureStudent(app: EdayaSparkApp) {
	const guardian = await app.resolveGuardian({
		subjectId: "sub-parent",
		email: "m.kone@mail.ci",
	});
	const issued = await app.issueAccessCode(guardian, LEA_ID);
	const student = await app.signInStudent(issued.code);
	return { guardian, issued, student };
}

describe("EdayaSparkApp", () => {
	test("prepares today's timetable lesson at the end of the day", async () => {
		const { app } = createApp();
		const { student } = await fixtureStudent(app);
		const home = await app.getHome(learnerRef(student));
		expect(home.planningDate).toBe("2026-10-05");
		expect(FIXTURE_TIMETABLE[0]?.title).toBe("Français");
		expect(home.lessonTitle).toBe(FIXTURE_LEA_READING);
		expect(home.focus?.subject).toBe("Français");
		expect(home.focus?.rationale).toContain("Français");
		expect(home.focus?.brief).toContain("série d'exercices suggérée");
		expect(home.focus?.brief).toContain(FIXTURE_LEA_READING);
		expect(home.focus?.proposals.length).toBeGreaterThan(0);
		expect(home.focusIntent).toBe("prepare_next_day");
		expect(home.currentSet).toBeNull();
	});

	test("keeps at least three subjects from the day's timetable", async () => {
		const { app } = createApp(new FixtureGuardianChildrenPort(), undefined, {
			nowIso: () => "2026-10-13T18:00:00.000Z",
		});
		const { student } = await fixtureStudent(app);
		const home = await app.getHome(learnerRef(student));
		const revision = home.session.tracks.find((track) => track.kind === "revision");
		expect(revision?.items.map((item) => item.subjectLabel)).toEqual([
			"Physique-Chimie",
			"Sciences de la Vie et de la Terre",
			"Français",
			"Mathématiques",
		]);
		expect(revision?.items.length).toBeGreaterThanOrEqual(3);
	});

	test("plans once per day, then refresh and generate reuse that plan", async () => {
		const focus = new CountingFocus();
		const { app } = createApp(new FixtureGuardianChildrenPort(), undefined, fixtureMonday, { focus });
		const { student } = await fixtureStudent(app);
		const first = await app.getHome(learnerRef(student));
		const second = await app.getHome(learnerRef(student));
		expect(focus.calls).toBe(1);
		expect(second.lessonTitle).toBe(first.lessonTitle);
		expect(second.focus?.subject).toBe(first.focus?.subject);

		const generated = await app.generate(student, "revision");
		expect(focus.calls).toBe(1);
		expect(generated.lessonId).toBe(FIXTURE_TIMETABLE[0]!.id);
	});

	test("shows a sentence when the timetable and the next two weeks are empty", async () => {
		const edaya: EdayaContextPort = {
			async pullLearnerContext() {
				const context = await new FixtureEdayaContext().pullLearnerContext({
					schoolId: "sch-edaya-ci-cocody",
					studentId: LEA_ID,
				});
				return { ...context, timetable: [], upcomingAssessments: [] };
			},
		};
		const { app } = createApp(new FixtureGuardianChildrenPort(), edaya);
		const { student } = await fixtureStudent(app);
		const home = await app.getHome(learnerRef(student));
		expect(home.session.summary).toBe(NOTHING_TO_PRACTICE_MESSAGE);
		expect(home.lessonTitle).toBe("");
		expect(home.focus).toBeNull();
		expect(home.session.tracks.every((track) => track.available === false)).toBe(true);
		await expect(app.generate(student, "revision")).rejects.toMatchObject({
			message: NOTHING_TO_PRACTICE_MESSAGE,
		});
		await expect(app.generate(student, "revision")).rejects.toBeInstanceOf(NothingToPracticeError);
	});

	test("saturday after the near evaluation has nothing to prepare", async () => {
		const { app } = createApp(new FixtureGuardianChildrenPort(), undefined, {
			nowIso: () => "2026-10-17T18:00:00.000Z",
		});
		const { student } = await fixtureStudent(app);
		const home = await app.getHome(learnerRef(student));
		expect(home.planningDate).toBe("2026-10-17");
		expect(home.session.summary).toBe(NOTHING_TO_PRACTICE_MESSAGE);
		expect(home.focus).toBeNull();
	});

	test("keeps both tracks when a parent focus choice is stored", async () => {
		const { app } = createApp(new FixtureGuardianChildrenPort(), undefined, {
			nowIso: () => "2026-10-05T08:00:00.000Z",
		});
		const { guardian, student } = await fixtureStudent(app);
		const settings = await app.updatePracticeSettings(guardian, student.studentId, {
			focusIntent: "upcoming_work",
		});
		expect(settings.focusIntent).toBe("upcoming_work");
		expect(settings.autoReleaseCorrection).toBe(false);

		const home = await app.getHome(learnerRef(student));
		expect(home.focusIntent).toBe("prepare_next_day");
		expect(home.lessonTitle).toBe(FIXTURE_LEA_READING);
		expect(home.session.totalMinutes).toBe(120);
		expect(home.session.summary.toLocaleLowerCase("fr")).toContain(FIXTURE_LEA_READING.toLocaleLowerCase("fr"));
		expect(home.session.summary).toContain("devoir");
		expect(home.session.summary).not.toContain("«");
		expect(home.session.summary).not.toContain("Fin de journée");
		expect(home.session.tracks.find((track) => track.kind === "revision")).toMatchObject({
			minutes: 80,
			available: true,
			lessonTitle: FIXTURE_LEA_READING,
		});
		expect(home.session.tracks.find((track) => track.kind === "homework")).toMatchObject({
			minutes: 40,
			available: true,
		});
	});

	test("generates one series per track on the same snapshot", async () => {
		const { app } = createApp(new FixtureGuardianChildrenPort(), undefined, {
			nowIso: () => "2026-10-05T08:00:00.000Z",
		});
		const { student } = await fixtureStudent(app);
		const revision = await app.generate(student, "revision");
		const homework = await app.generate(student, "homework");
		expect(revision.track).toBe("revision");
		expect(revision.plannedMinutes).toBe(27);
		expect(homework.track).toBe("homework");
		expect(homework.plannedMinutes).toBe(40);
		expect(homework.id).not.toBe(revision.id);

		const home = await app.getHome(learnerRef(student));
		const revisionTrack = home.session.tracks.find((track) => track.kind === "revision");
		expect(revisionTrack?.minutes).toBe(80);
		expect(revisionTrack?.items.reduce((sum, item) => sum + item.minutes, 0)).toBe(80);
		expect(home.currentSet?.id).toBe(revision.id);
		expect(home.session.tracks.find((track) => track.kind === "homework")?.currentSet?.id).toBe(
			homework.id,
		);
		expect(revisionTrack?.items[0]?.canGenerate).toBe(false);
		expect(home.session.tracks.find((track) => track.kind === "homework")?.canGenerate).toBe(false);

		await expect(app.generate(student, "revision")).rejects.toBeInstanceOf(AlreadyGeneratedError);
		await expect(app.generate(student, "homework")).rejects.toBeInstanceOf(AlreadyGeneratedError);
	});

	test("replaces an unstarted series whose lesson is not the official one", async () => {
		const { app, sets } = createAppWithSets();
		const { student } = await fixtureStudent(app);
		const snapshot = await app.syncSnapshot(learnerRef(student));
		await sets.save({
			id: "set-invented",
			snapshotId: snapshot.id,
			schoolId: student.schoolId,
			studentId: student.studentId,
			lessonId: "Leçon 1",
			generatedAt: "2026-10-09T19:14:04.686Z",
			generator: "llm",
			promptVersion: "cloudflare-rag-v1:test",
			track: "revision",
			plannedMinutes: 60,
			questions: [
				{ id: "q1", prompt: "Pourquoi le calcul littéral ?", kind: "written", expectedAnswer: "parce que" },
			],
		});

		const before = await app.getHome(learnerRef(student));
		expect(before.lessonTitle).toBe(FIXTURE_LEA_READING);
		expect(before.currentSet).toBeNull();
		expect(before.session.tracks.find((track) => track.kind === "revision")?.canGenerate).toBe(true);

		const replaced = await app.generate(student, "revision");
		expect(replaced.id).toBe("set-invented");
		expect(replaced.lessonId).toBe(FIXTURE_TIMETABLE[0]!.id);
		const after = await app.getHome(learnerRef(student));
		expect(after.currentSet?.lessonId).toBe(FIXTURE_TIMETABLE[0]?.id);
	});

	test("allows generate once per snapshot then rejects regenerate", async () => {
		const { app } = createApp();
		const { student } = await fixtureStudent(app);
		const first = await app.generate(student);
		expect(first.questions.length).toBeGreaterThan(0);
		expect(first.schoolId).toBe(student.schoolId);
		expect(first.lessonId).toBe(FIXTURE_TIMETABLE[0]!.id);

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
		const first = await app.issueAccessCode(guardian, LEA_ID);
		const student = await app.signInStudent(first.code);
		await sessions.set("token-1", student);

		const second = await app.issueAccessCode(guardian, LEA_ID);
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
		await expect(app.issueAccessCode(guardian, LEA_ID)).rejects.toBeInstanceOf(ChildNotLinkedError);
		const listing = await app.listChildren(guardian);
		expect(listing.children).toEqual([]);
	});

	test("sync covers students with an active access code", async () => {
		const { app } = createApp();
		expect(await app.syncLinkedSnapshots()).toEqual([]);
		await fixtureStudent(app);
		const results = await app.syncLinkedSnapshots();
		expect(results.length).toBe(1);
		expect(results[0]?.studentId).toBe("ci-s1");
		const again = await app.syncLinkedSnapshots();
		expect(again[0]?.snapshotId).toBe(results[0]?.snapshotId);
	});

	test("demo sign-in uses fixture Léa without a parent code", async () => {
		const { app } = createApp(new EmptyGuardianChildrenPort());
		const student = await app.signInDemo();
		expect(student.studentId).toBe("ci-s1");
		expect(student.sessionKind).toBe("demo");
		const home = await app.getHome(learnerRef(student));
		expect(home.lessonTitle).toBe(FIXTURE_LEA_READING);
	});

	test("demo guardian lists Léa even when Identity children are empty", async () => {
		const { app } = createApp(new EmptyGuardianChildrenPort());
		const guardian = await app.signInDemoGuardian();
		expect(guardian.sessionKind).toBe("demo");
		const listing = await app.listChildren(guardian);
		expect(listing.children.map((child) => child.studentId)).toEqual(["ci-s1", "ci-s31", "ci-s32", "ci-s33"]);
		expect(listing.children[1]).toMatchObject({
			firstName: "Thomas",
			lastName: "Mercier",
			classLabel: "5ème 1",
			gradeLevel: {
				id: "demo-5eme",
				name: "Cinquième",
				label: "5ème",
				order: 2,
				cycle: "Collège",
			},
		});
		expect(listing.children[2]).toMatchObject({
			firstName: "Camille",
			lastName: "Mercier",
			classLabel: "2nde C 1",
			gradeLevel: { id: "demo-2nde", label: "2nde C", cycle: "Lycée" },
		});
		expect(listing.children[3]).toMatchObject({
			firstName: "Inès",
			lastName: "Mercier",
			classLabel: "Tle D 1",
			gradeLevel: { id: "demo-tle", label: "Tle D", cycle: "Lycée" },
		});
		expect(listing.displayName).toBe("Sophie Mercier");
	});

	test("demo-issued student codes use fixture EDAYA; Identity codes stay on live", async () => {
		const edaya = new DualEdayaContext(throwingLiveEdaya(), new FixtureEdayaContext());

		const { app: demoApp } = createApp(new ThrowingGuardianChildrenPort(), edaya);
		const guardian = await demoApp.signInDemoGuardian();
		const issued = await demoApp.issueAccessCode(guardian, LEA_ID);
		const demoStudent = await demoApp.signInStudent(issued.code);
		expect(demoStudent.sessionKind).toBe("code");
		expect(demoStudent.displayName).toBe("Léa Mercier");
		expect(learnerRef(demoStudent).contextSource).toBe("fixture");
		const home = await demoApp.getHome(learnerRef(demoStudent));
		expect(home.lessonTitle).toBe(FIXTURE_LEA_READING);
		const synced = await demoApp.syncLinkedSnapshots();
		expect(synced.map((item) => item.studentId)).toEqual(["ci-s1"]);
		const brouIssued = await demoApp.issueAccessCode(guardian, "ci-s31");
		const brouStudent = await demoApp.signInStudent(brouIssued.code);
		expect(brouStudent.displayName).toBe("Thomas Mercier");
		expect(learnerRef(brouStudent).contextSource).toBe("fixture");
		const brouHome = await demoApp.getHome(learnerRef(brouStudent));
		expect(FIXTURE_TIMETABLE_BROU[0]?.title).toBe("Physique-Chimie");
		expect(brouHome.lessonTitle).toBe(FIXTURE_THOMAS_CHAPTER);
		expect(brouHome.focusIntent).toBe("prepare_next_day");
		expect(brouHome.session.tracks.find((track) => track.kind === "homework")?.available).toBe(true);
		expect(brouHome.snapshot.context.student.classLabel).toBe("5ème 1");

		const camilleIssued = await demoApp.issueAccessCode(guardian, "ci-s32");
		const camilleStudent = await demoApp.signInStudent(camilleIssued.code);
		expect(camilleStudent.displayName).toBe("Camille Mercier");
		expect(learnerRef(camilleStudent).contextSource).toBe("fixture");
		const camilleHome = await demoApp.getHome(learnerRef(camilleStudent));
		expect(camilleHome.lessonTitle).toBe(FIXTURE_CAMILLE_CHAPTER);
		expect(camilleHome.snapshot.context.student.gradeLevel).toMatchObject({
			label: "2nde C",
			cycle: "Lycée",
		});
		expect(camilleHome.snapshot.context.student.classLabel).toBe("2nde C 1");

		const inesIssued = await demoApp.issueAccessCode(guardian, "ci-s33");
		const inesStudent = await demoApp.signInStudent(inesIssued.code);
		expect(inesStudent.displayName).toBe("Inès Mercier");
		expect(learnerRef(inesStudent).contextSource).toBe("fixture");
		const inesHome = await demoApp.getHome(learnerRef(inesStudent));
		expect(inesHome.lessonTitle).toBe(FIXTURE_INES_CHAPTER);
		expect(inesHome.snapshot.context.student.gradeLevel).toMatchObject({
			label: "Tle D",
			cycle: "Lycée",
		});
		expect(inesHome.snapshot.context.student.classLabel).toBe("Tle D 1");

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
		await app.updatePracticeSettings(guardian, student.studentId, {
			autoReleaseCorrection: true,
		});
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
			lessonId: FIXTURE_TIMETABLE[0]?.id ?? "",
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
