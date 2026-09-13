import type {
	ExerciseSet,
	ExerciseSetRepository,
	LearnerAcademicSnapshot,
	LearnerContextQuery,
	SessionActor,
	SnapshotRepository,
	StudentAccessCode,
	StudentAccessCodeRepository,
	StudentActor,
} from "@children-ai/domain";
import type { SessionStore } from "@children-ai/adaptors";

export type KvNamespaceLike = {
	get(key: string): Promise<string | null>;
	put(
		key: string,
		value: string,
		options?: { expirationTtl?: number },
	): Promise<void>;
	delete?(key: string): Promise<void>;
};

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

async function readJson<T>(kv: KvNamespaceLike, key: string): Promise<T | null> {
	const raw = await kv.get(key);
	if (!raw) return null;
	return JSON.parse(raw) as T;
}

async function deleteKey(kv: KvNamespaceLike, key: string): Promise<void> {
	if (kv.delete) {
		await kv.delete(key);
		return;
	}
	await kv.put(key, "");
}

export class KvSnapshotRepository implements SnapshotRepository {
	constructor(private readonly kv: KvNamespaceLike) {}

	async getCurrent(query: { schoolId: string; studentId: string }): Promise<LearnerAcademicSnapshot | null> {
		return readJson<LearnerAcademicSnapshot>(
			this.kv,
			currentKey(query.schoolId, query.studentId),
		);
	}

	async save(snapshot: LearnerAcademicSnapshot): Promise<void> {
		const encoded = JSON.stringify(snapshot);
		await this.kv.put(
			currentKey(snapshot.schoolId, snapshot.studentId),
			encoded,
		);
		await this.kv.put(`snapshot:${snapshot.id}`, encoded);
	}
}

export class KvExerciseSetRepository implements ExerciseSetRepository {
	constructor(private readonly kv: KvNamespaceLike) {}

	async findBySnapshotId(snapshotId: string): Promise<ExerciseSet | null> {
		return readJson<ExerciseSet>(this.kv, `set-by-snapshot:${snapshotId}`);
	}

	async listByStudentId(query: {
		schoolId: string;
		studentId: string;
	}): Promise<ExerciseSet[]> {
		const ids =
			(await readJson<string[]>(
				this.kv,
				studentSetsKey(query.schoolId, query.studentId),
			)) ?? [];
		const sets: ExerciseSet[] = [];
		for (const id of ids) {
			const set = await this.getById(id);
			if (set) sets.push(set);
		}
		return sets.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
	}

	async getById(id: string): Promise<ExerciseSet | null> {
		return readJson<ExerciseSet>(this.kv, `set:${id}`);
	}

	async save(set: ExerciseSet): Promise<void> {
		const encoded = JSON.stringify(set);
		await this.kv.put(`set:${set.id}`, encoded);
		await this.kv.put(`set-by-snapshot:${set.snapshotId}`, encoded);
		const ids =
			(await readJson<string[]>(
				this.kv,
				studentSetsKey(set.schoolId, set.studentId),
			)) ?? [];
		if (!ids.includes(set.id)) ids.unshift(set.id);
		await this.kv.put(
			studentSetsKey(set.schoolId, set.studentId),
			JSON.stringify(ids),
		);
	}
}

export class KvStudentAccessCodeRepository implements StudentAccessCodeRepository {
	constructor(private readonly kv: KvNamespaceLike) {}

	async getById(id: string): Promise<StudentAccessCode | null> {
		return readJson<StudentAccessCode>(this.kv, codeKey(id));
	}

	async getByHash(codeHash: string): Promise<StudentAccessCode | null> {
		const id = await this.kv.get(codeHashKey(codeHash));
		if (!id) return null;
		return this.getById(id);
	}

	async getActiveByStudentId(studentId: string): Promise<StudentAccessCode | null> {
		const id = await this.kv.get(activeCodeKey(studentId));
		if (!id) return null;
		const code = await this.getById(id);
		if (!code || code.revokedAt) return null;
		return code;
	}

	async listByStudentId(studentId: string): Promise<StudentAccessCode[]> {
		const ids = (await readJson<string[]>(this.kv, "access-codes:index")) ?? [];
		const codes: StudentAccessCode[] = [];
		for (const id of ids) {
			const code = await this.getById(id);
			if (code?.studentId === studentId) codes.push(code);
		}
		return codes;
	}

	async listActiveLearners(): Promise<LearnerContextQuery[]> {
		const ids = (await readJson<string[]>(this.kv, "access-codes:index")) ?? [];
		const learners: LearnerContextQuery[] = [];
		for (const id of ids) {
			const code = await this.getById(id);
			if (code && !code.revokedAt) {
				learners.push({ schoolId: code.schoolId, studentId: code.studentId });
			}
		}
		return learners;
	}

	async save(code: StudentAccessCode): Promise<void> {
		await this.kv.put(codeKey(code.id), JSON.stringify(code));
		await this.kv.put(codeHashKey(code.codeHash), code.id);
		if (code.revokedAt) {
			const activeId = await this.kv.get(activeCodeKey(code.studentId));
			if (activeId === code.id) {
				await deleteKey(this.kv, activeCodeKey(code.studentId));
			}
		} else {
			await this.kv.put(activeCodeKey(code.studentId), code.id);
		}
		const ids = (await readJson<string[]>(this.kv, "access-codes:index")) ?? [];
		if (!ids.includes(code.id)) ids.push(code.id);
		await this.kv.put("access-codes:index", JSON.stringify(ids));
	}
}

export class KvSessionStore implements SessionStore {
	constructor(private readonly kv: KvNamespaceLike) {}

	async get(token: string): Promise<SessionActor | null> {
		return readJson<SessionActor>(this.kv, sessionKey(token));
	}

	async set(token: string, actor: SessionActor): Promise<void> {
		await this.kv.put(sessionKey(token), JSON.stringify(actor), {
			expirationTtl: SESSION_TTL_SECONDS,
		});
		if (actor.role !== "student") return;
		const tokens =
			(await readJson<string[]>(this.kv, studentSessionsKey(actor.studentId))) ?? [];
		if (!tokens.includes(token)) tokens.push(token);
		await this.kv.put(studentSessionsKey(actor.studentId), JSON.stringify(tokens));
	}

	async deleteByStudentId(studentId: string): Promise<void> {
		const tokens =
			(await readJson<string[]>(this.kv, studentSessionsKey(studentId))) ?? [];
		for (const token of tokens) {
			const actor = await this.get(token);
			if (isStudent(actor) && actor.studentId === studentId) {
				await deleteKey(this.kv, sessionKey(token));
			}
		}
		await deleteKey(this.kv, studentSessionsKey(studentId));
	}
}

export class MemoryKv implements KvNamespaceLike {
	private readonly data = new Map<string, string>();

	async get(key: string): Promise<string | null> {
		const value = this.data.get(key);
		return value ? value : null;
	}

	async put(key: string, value: string): Promise<void> {
		this.data.set(key, value);
	}

	async delete(key: string): Promise<void> {
		this.data.delete(key);
	}
}

function isStudent(actor: SessionActor | null): actor is StudentActor {
	return actor?.role === "student";
}

function currentKey(schoolId: string, studentId: string): string {
	return `snapshot:current:${schoolId}:${studentId}`;
}

function studentSetsKey(schoolId: string, studentId: string): string {
	return `sets-of:${schoolId}:${studentId}`;
}

function sessionKey(token: string): string {
	return `session:${token}`;
}

function studentSessionsKey(studentId: string): string {
	return `session-student:${studentId}`;
}

function codeKey(id: string): string {
	return `access-code:${id}`;
}

function codeHashKey(hash: string): string {
	return `access-code-hash:${hash}`;
}

function activeCodeKey(studentId: string): string {
	return `access-code-active:${studentId}`;
}
