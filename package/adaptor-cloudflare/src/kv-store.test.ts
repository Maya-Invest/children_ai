import { describe, expect, test } from "bun:test";
import type { ExerciseSet, LearnerAcademicSnapshot, SessionActor } from "@children-ai/domain";
import {
	KvExerciseSetRepository,
	KvSessionStore,
	KvSnapshotRepository,
	MemoryKv,
} from "./kv-store.ts";

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

const set: ExerciseSet = {
	id: "set-1",
	snapshotId: "snap-1",
	schoolId: "school",
	studentId: "student-1",
	lessonId: "lesson",
	generatedAt: "2026-09-07T10:01:00.000Z",
	generator: "stub",
	promptVersion: "stub-v1",
	questions: [{ id: "q1", kind: "written", prompt: "Calcule.", expectedAnswer: "1" }],
};

const actor: SessionActor = {
	role: "student",
	studentId: "student-1",
	schoolId: "school",
	guardianSubjectId: "sub-parent",
	codeId: "code-1",
	displayName: "Emma",
	childFirstName: "Emma",
};

describe("Cloudflare KV adaptors", () => {
	test("stores the current snapshot and exercise set", async () => {
		const kv = new MemoryKv();
		const snapshots = new KvSnapshotRepository(kv);
		const sets = new KvExerciseSetRepository(kv);

		await snapshots.save(snapshot);
		expect((await snapshots.getCurrent({ schoolId: "school", studentId: "student-1" }))?.id).toBe("snap-1");

		await sets.save(set);
		expect((await sets.findBySnapshotId("snap-1"))?.id).toBe("set-1");
		expect((await sets.listByStudentId({ schoolId: "school", studentId: "student-1" }))[0]?.id).toBe("set-1");

		await sets.save({ ...set, submittedAt: "2026-09-13T02:00:00.000Z", score: { correct: 1, total: 1 } });
		expect((await sets.getById("set-1"))?.score).toEqual({ correct: 1, total: 1 });
		expect((await sets.listByStudentId({ schoolId: "school", studentId: "student-1" }))).toHaveLength(1);
	});

	test("stores sessions without a process-wide Map", async () => {
		const sessions = new KvSessionStore(new MemoryKv());
		await sessions.set("token-1", actor);
		const stored = await sessions.get("token-1");
		expect(stored?.role).toBe("student");
		if (stored?.role === "student") {
			expect(stored.studentId).toBe("student-1");
		}
	});
});

describe("KvSchoolIntegrationVault", () => {
	test("encrypts the school API key at rest", async () => {
		const { KvSchoolIntegrationVault } = await import("./kv-vault.ts");
		const { demoSchoolCredentials } = await import("@children-ai/adaptors");
		const kv = new MemoryKv();
		const vault = new KvSchoolIntegrationVault(kv, "staging-master-key-not-local-default");
		await vault.put(
			demoSchoolCredentials({
				schoolId: "sch-edaya-ci-cocody",
				edayaApiBaseUrl: "https://staging.api.edayaplus.com",
				apiKey: "s2s_live_dev_edaya_ci_cocody_children_ai_key01",
			}),
		);
		const raw = await kv.get("vault:school:sch-edaya-ci-cocody");
		expect(raw).toBeTruthy();
		expect(raw).not.toContain("s2s_live_dev_edaya_ci_cocody_children_ai_key01");
		const active = await vault.getActive("sch-edaya-ci-cocody");
		expect(active?.apiKey).toBe("s2s_live_dev_edaya_ci_cocody_children_ai_key01");
		expect(active?.integration.keyPrefix).toBe("s2s_live_dev_eda");
	});
});
