import { describe, expect, test } from "bun:test";
import type { ExerciseSet, LearnerAcademicSnapshot, PracticeSessionPlan, SessionActor, StudentAccessCode } from "@edaya-spark/domain";
import { demoSchoolCredentials } from "@edaya-spark/adaptors";
import { openSparkDatabase } from "./open.ts";
import { PostgresSessionStore } from "./repositories.ts";
import { PostgresSchoolIntegrationVault } from "./vault.ts";

const snapshot = (id: string, createdAt: string): LearnerAcademicSnapshot => ({
	id,
	schoolId: "school",
	studentId: "student-1",
	fingerprint: id,
	packVersion: "pack",
	createdAt,
	context: {
		student: {
			edayaStudentId: "student-1",
			firstName: "Léa",
			lastName: "Mercier",
			gradeLevel: { id: "demo-6eme", name: "Sixième", label: "6ème", order: 1, cycle: "Collège" },
			classLabel: "6ème 1",
		},
		academicYearId: "2025-ci",
		periodId: "T1",
		marks: [],
		classProgress: [],
		timetable: [],
		observations: [],
	},
});

const set = (id: string, snapshotId: string): ExerciseSet => ({
	id,
	snapshotId,
	schoolId: "school",
	studentId: "student-1",
	lessonId: "lesson",
	generatedAt: "2026-09-07T10:01:00.000Z",
	generator: "stub",
	promptVersion: "v1",
	questions: [],
});

describe("postgres repositories", () => {
	test("stores snapshots, sets, settings, codes, sessions, and the vault", async () => {
		const db = await openSparkDatabase("pglite");
		await db.snapshots.save(snapshot("snap-old", "2026-09-01T00:00:00.000Z"));
		await db.snapshots.save(snapshot("snap-new", "2026-09-07T00:00:00.000Z"));
		expect((await db.snapshots.getCurrent({ schoolId: "school", studentId: "student-1" }))?.id).toBe("snap-new");

		const exercise = set("set-1", "snap-new");
		await db.sets.save(exercise);
		exercise.submittedAt = "2026-09-07T11:00:00.000Z";
		await db.sets.save(exercise);
		expect((await db.sets.getById("set-1"))?.submittedAt).toBe("2026-09-07T11:00:00.000Z");
		expect(await db.sets.findBySnapshotId("snap-new")).toMatchObject({ id: "set-1" });
		await db.sets.save({
			...set("set-2", "snap-new"),
			track: "homework",
			generatedAt: "2026-09-07T12:00:00.000Z",
		});
		expect((await db.sets.findBySnapshotTrack("snap-new", "revision"))?.id).toBe("set-1");
		expect((await db.sets.findBySnapshotTrack("snap-new", "homework"))?.id).toBe("set-2");

		await db.practiceSettings.save({
			schoolId: "school",
			studentId: "student-1",
			autoReleaseCorrection: true,
		});
		expect(
			(await db.practiceSettings.get({ schoolId: "school", studentId: "student-1" }))?.autoReleaseCorrection,
		).toBe(true);

		const plan: PracticeSessionPlan = {
			summary: "Fin de journée",
			totalMinutes: 120,
			tracks: [],
		};
		const learner = { schoolId: "school", studentId: "student-1" };
		await db.plans.save(learner, "2026-10-13", plan);
		expect((await db.plans.get(learner, "2026-10-13"))?.summary).toBe("Fin de journée");
		expect(await db.plans.get(learner, "2026-10-14")).toBeNull();

		const code: StudentAccessCode = {
			id: "code-1",
			schoolId: "school",
			studentId: "student-1",
			guardianSubjectId: "guardian-1",
			codeHash: "hash-1",
			displayHint: "D125",
			createdAt: "2026-09-07T10:00:00.000Z",
			revokedAt: null,
		};
		await db.codes.save(code);
		expect((await db.codes.getActiveByStudentId("student-1"))?.id).toBe("code-1");
		await db.codes.save({ ...code, revokedAt: "2026-09-08T00:00:00.000Z" });
		expect(await db.codes.getActiveByStudentId("student-1")).toBeNull();

		const actor: SessionActor = {
			role: "student",
			studentId: "student-1",
			schoolId: "school",
			guardianSubjectId: "guardian-1",
			codeId: "code-1",
			displayName: "Léa",
			childFirstName: "Léa",
		};
		let now = new Date("2026-09-07T10:00:00.000Z");
		const sessions = new PostgresSessionStore(db.db, { now: () => now });
		await sessions.set("token-1", actor);
		expect((await sessions.get("token-1"))?.role).toBe("student");
		now = new Date("2026-09-15T10:00:00.000Z");
		expect(await sessions.get("token-1")).toBeNull();

		const vault = new PostgresSchoolIntegrationVault(db.db, "test-master-key");
		await vault.put(
			demoSchoolCredentials({
				schoolId: "school",
				edayaApiBaseUrl: "http://localhost:9999",
				apiKey: "s2s_live_local_school_edaya_spark01",
			}),
		);
		const stored = await vault.getActive("school");
		expect(stored?.apiKey).toBe("s2s_live_local_school_edaya_spark01");
		expect(stored?.integration.status).toBe("active");

		await db.close();
	}, 20000);
});
