import { and, desc, eq, gt, isNull, sql, type SQL } from "drizzle-orm";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import {
	exerciseTrack,
	learnerQueryForIssuedCode,
	type ExerciseSet,
	type ExerciseSetRepository,
	type LearnerAcademicSnapshot,
	type LearnerContextQuery,
	type PracticePlanRepository,
	type PracticeSessionPlan,
	type PracticeSettings,
	type PracticeSettingsRepository,
	type PracticeTrackKind,
	type SessionActor,
	type SessionStore,
	type SnapshotRepository,
	type StudentAccessCode,
	type StudentAccessCodeRepository,
} from "@edaya-spark/domain";
import * as schema from "./schema.ts";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SparkDb = PgliteDatabase<typeof schema>;

export type SparkClock = {
	now(): Date;
};

const systemClock: SparkClock = { now: () => new Date() };

/** Hyperdrive caches a SELECT and does not drop it after a write. NOW() makes the read uncacheable, so Terminer is visible on the next request. */
export function freshRead(): SQL {
	return sql`NOW() IS NOT NULL`;
}

function readJson<T>(value: unknown): T {
	if (typeof value === "string") return JSON.parse(value) as T;
	return value as T;
}

export class PostgresSnapshotRepository implements SnapshotRepository {
	constructor(private readonly db: SparkDb) {}

	async getCurrent(query: LearnerContextQuery): Promise<LearnerAcademicSnapshot | null> {
		const rows = await this.db
			.select()
			.from(schema.snapshots)
			.where(
				and(
					eq(schema.snapshots.schoolId, query.schoolId),
					eq(schema.snapshots.studentId, query.studentId),
					freshRead(),
				),
			)
			.orderBy(desc(schema.snapshots.createdAt), desc(schema.snapshots.id))
			.limit(1);
		const row = rows[0];
		return row ? readJson<LearnerAcademicSnapshot>(row.payload) : null;
	}

	async save(snapshot: LearnerAcademicSnapshot): Promise<void> {
		await this.db
			.insert(schema.snapshots)
			.values({
				id: snapshot.id,
				schoolId: snapshot.schoolId,
				studentId: snapshot.studentId,
				createdAt: snapshot.createdAt,
				payload: snapshot,
			})
			.onConflictDoUpdate({
				target: schema.snapshots.id,
				set: {
					schoolId: snapshot.schoolId,
					studentId: snapshot.studentId,
					createdAt: snapshot.createdAt,
					payload: snapshot,
				},
			});
	}
}

export class PostgresExerciseSetRepository implements ExerciseSetRepository {
	constructor(private readonly db: SparkDb) {}

	async findBySnapshotId(snapshotId: string): Promise<ExerciseSet | null> {
		const rows = await this.db
			.select()
			.from(schema.exerciseSets)
			.where(and(eq(schema.exerciseSets.snapshotId, snapshotId), freshRead()))
			.orderBy(desc(schema.exerciseSets.generatedAt))
			.limit(1);
		const row = rows[0];
		return row ? readJson<ExerciseSet>(row.payload) : null;
	}

	async findBySnapshotTrack(
		snapshotId: string,
		track: PracticeTrackKind,
	): Promise<ExerciseSet | null> {
		const rows = await this.db
			.select()
			.from(schema.exerciseSets)
			.where(and(eq(schema.exerciseSets.snapshotId, snapshotId), freshRead()))
			.orderBy(desc(schema.exerciseSets.generatedAt));
		for (const row of rows) {
			const set = readJson<ExerciseSet>(row.payload);
			if (exerciseTrack(set) === track) return set;
		}
		return null;
	}

	async listByStudentId(query: LearnerContextQuery): Promise<ExerciseSet[]> {
		const rows = await this.db
			.select()
			.from(schema.exerciseSets)
			.where(
				and(
					eq(schema.exerciseSets.schoolId, query.schoolId),
					eq(schema.exerciseSets.studentId, query.studentId),
					freshRead(),
				),
			)
			.orderBy(desc(schema.exerciseSets.generatedAt));
		return rows.map((row) => readJson<ExerciseSet>(row.payload));
	}

	async getById(id: string): Promise<ExerciseSet | null> {
		const rows = await this.db
			.select()
			.from(schema.exerciseSets)
			.where(and(eq(schema.exerciseSets.id, id), freshRead()))
			.limit(1);
		const row = rows[0];
		return row ? readJson<ExerciseSet>(row.payload) : null;
	}

	async save(set: ExerciseSet): Promise<void> {
		await this.db
			.insert(schema.exerciseSets)
			.values({
				id: set.id,
				snapshotId: set.snapshotId,
				schoolId: set.schoolId,
				studentId: set.studentId,
				generatedAt: set.generatedAt,
				payload: set,
			})
			.onConflictDoUpdate({
				target: schema.exerciseSets.id,
				set: {
					snapshotId: set.snapshotId,
					schoolId: set.schoolId,
					studentId: set.studentId,
					generatedAt: set.generatedAt,
					payload: set,
				},
			});
	}
}

export class PostgresPracticeSettingsRepository implements PracticeSettingsRepository {
	constructor(private readonly db: SparkDb) {}

	async get(query: LearnerContextQuery): Promise<PracticeSettings | null> {
		const rows = await this.db
			.select()
			.from(schema.practiceSettings)
			.where(
				and(
					eq(schema.practiceSettings.schoolId, query.schoolId),
					eq(schema.practiceSettings.studentId, query.studentId),
					freshRead(),
				),
			)
			.limit(1);
		const row = rows[0];
		return row ? readJson<PracticeSettings>(row.payload) : null;
	}

	async save(settings: PracticeSettings): Promise<void> {
		await this.db
			.insert(schema.practiceSettings)
			.values({
				schoolId: settings.schoolId,
				studentId: settings.studentId,
				payload: settings,
			})
			.onConflictDoUpdate({
				target: [schema.practiceSettings.schoolId, schema.practiceSettings.studentId],
				set: { payload: settings },
			});
	}
}

export class PostgresPracticePlanRepository implements PracticePlanRepository {
	constructor(private readonly db: SparkDb) {}

	async get(query: LearnerContextQuery, planningDate: string): Promise<PracticeSessionPlan | null> {
		const rows = await this.db
			.select()
			.from(schema.practicePlans)
			.where(
				and(
					eq(schema.practicePlans.schoolId, query.schoolId),
					eq(schema.practicePlans.studentId, query.studentId),
					eq(schema.practicePlans.planningDate, planningDate),
					freshRead(),
				),
			)
			.limit(1);
		const row = rows[0];
		return row ? readJson<PracticeSessionPlan>(row.payload) : null;
	}

	async save(
		query: LearnerContextQuery,
		planningDate: string,
		plan: PracticeSessionPlan,
	): Promise<void> {
		await this.db
			.insert(schema.practicePlans)
			.values({
				schoolId: query.schoolId,
				studentId: query.studentId,
				planningDate,
				payload: plan,
			})
			.onConflictDoUpdate({
				target: [
					schema.practicePlans.schoolId,
					schema.practicePlans.studentId,
					schema.practicePlans.planningDate,
				],
				set: { payload: plan },
			});
	}
}

export class PostgresStudentAccessCodeRepository implements StudentAccessCodeRepository {
	constructor(private readonly db: SparkDb) {}

	async getById(id: string): Promise<StudentAccessCode | null> {
		const rows = await this.db
			.select()
			.from(schema.accessCodes)
			.where(and(eq(schema.accessCodes.id, id), freshRead()))
			.limit(1);
		const row = rows[0];
		return row ? readJson<StudentAccessCode>(row.payload) : null;
	}

	async getByHash(codeHash: string): Promise<StudentAccessCode | null> {
		const rows = await this.db
			.select()
			.from(schema.accessCodes)
			.where(and(eq(schema.accessCodes.codeHash, codeHash), freshRead()))
			.limit(1);
		const row = rows[0];
		return row ? readJson<StudentAccessCode>(row.payload) : null;
	}

	async getActiveByStudentId(studentId: string): Promise<StudentAccessCode | null> {
		const rows = await this.db
			.select()
			.from(schema.accessCodes)
			.where(
				and(eq(schema.accessCodes.studentId, studentId), isNull(schema.accessCodes.revokedAt), freshRead()),
			)
			.limit(1);
		const row = rows[0];
		return row ? readJson<StudentAccessCode>(row.payload) : null;
	}

	async listByStudentId(studentId: string): Promise<StudentAccessCode[]> {
		const rows = await this.db
			.select()
			.from(schema.accessCodes)
			.where(and(eq(schema.accessCodes.studentId, studentId), freshRead()));
		return rows.map((row) => readJson<StudentAccessCode>(row.payload));
	}

	async listActiveLearners(): Promise<LearnerContextQuery[]> {
		const rows = await this.db
			.select()
			.from(schema.accessCodes)
			.where(and(isNull(schema.accessCodes.revokedAt), freshRead()));
		return rows.map((row) => learnerQueryForIssuedCode(readJson<StudentAccessCode>(row.payload)));
	}

	async save(code: StudentAccessCode): Promise<void> {
		await this.db
			.insert(schema.accessCodes)
			.values({
				id: code.id,
				schoolId: code.schoolId,
				studentId: code.studentId,
				codeHash: code.codeHash,
				revokedAt: code.revokedAt,
				payload: code,
			})
			.onConflictDoUpdate({
				target: schema.accessCodes.id,
				set: {
					schoolId: code.schoolId,
					studentId: code.studentId,
					codeHash: code.codeHash,
					revokedAt: code.revokedAt,
					payload: code,
				},
			});
	}
}

export class PostgresSessionStore implements SessionStore {
	constructor(
		private readonly db: SparkDb,
		private readonly clock: SparkClock = systemClock,
		private readonly ttlMs = SESSION_TTL_MS,
	) {}

	async get(token: string): Promise<SessionActor | null> {
		const now = this.clock.now().toISOString();
		const rows = await this.db
			.select()
			.from(schema.sessions)
			.where(and(eq(schema.sessions.token, token), gt(schema.sessions.expiresAt, now), freshRead()))
			.limit(1);
		const row = rows[0];
		if (!row) {
			await this.db.delete(schema.sessions).where(eq(schema.sessions.token, token));
			return null;
		}
		return readJson<SessionActor>(row.actor);
	}

	async set(token: string, actor: SessionActor): Promise<void> {
		const expiresAt = new Date(this.clock.now().getTime() + this.ttlMs).toISOString();
		const studentId = actor.role === "student" ? actor.studentId : null;
		await this.db
			.insert(schema.sessions)
			.values({ token, studentId, actor, expiresAt })
			.onConflictDoUpdate({
				target: schema.sessions.token,
				set: { studentId, actor, expiresAt },
			});
	}

	async deleteByStudentId(studentId: string): Promise<void> {
		await this.db.delete(schema.sessions).where(eq(schema.sessions.studentId, studentId));
	}
}
