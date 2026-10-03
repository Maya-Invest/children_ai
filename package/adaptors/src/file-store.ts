import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
	learnerQueryForIssuedCode,
	type ExerciseSet,
	type ExerciseSetRepository,
	type LearnerAcademicSnapshot,
	type LearnerContextQuery,
	type PracticeSettings,
	type PracticeSettingsRepository,
	type SessionActor,
	type SnapshotRepository,
	type StudentAccessCode,
	type StudentAccessCodeRepository,
} from "@children-ai/domain";
import type { SessionStore } from "./session-store.ts";

type StoredSession = {
	token: string;
	actor: SessionActor;
};

type StoreFile = {
	snapshots: LearnerAcademicSnapshot[];
	sets: ExerciseSet[];
	accessCodes: StudentAccessCode[];
	practiceSettings: PracticeSettings[];
	sessions: StoredSession[];
};

const empty = (): StoreFile => ({
	snapshots: [],
	sets: [],
	accessCodes: [],
	practiceSettings: [],
	sessions: [],
});

function normalize(parsed: Partial<StoreFile>): StoreFile {
	return {
		snapshots: parsed.snapshots ?? [],
		sets: parsed.sets ?? [],
		accessCodes: parsed.accessCodes ?? [],
		practiceSettings: parsed.practiceSettings ?? [],
		sessions: parsed.sessions ?? [],
	};
}

export class JsonFileStore {
	private tail: Promise<void> = Promise.resolve();

	constructor(private readonly filePath: string) {}

	async read(): Promise<StoreFile> {
		return this.enqueue(() => this.readUnlocked());
	}

	async write(store: StoreFile): Promise<void> {
		await this.enqueue(async () => {
			await this.writeUnlocked(store);
		});
	}

	async update(mutator: (data: StoreFile) => void): Promise<void> {
		await this.enqueue(async () => {
			const data = await this.readUnlocked();
			mutator(data);
			await this.writeUnlocked(data);
		});
	}

	private enqueue<T>(work: () => Promise<T>): Promise<T> {
		const run = this.tail.then(work, work);
		this.tail = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	}

	private async readUnlocked(): Promise<StoreFile> {
		try {
			const raw = await readFile(this.filePath, "utf8");
			return normalize(JSON.parse(raw) as Partial<StoreFile>);
		} catch {
			return empty();
		}
	}

	private async writeUnlocked(store: StoreFile): Promise<void> {
		await mkdir(dirname(this.filePath), { recursive: true });
		await writeFile(this.filePath, JSON.stringify(normalize(store), null, 2), "utf8");
	}
}

export class FileSnapshotRepository implements SnapshotRepository {
	constructor(private readonly store: JsonFileStore) {}

	async getCurrent(query: LearnerContextQuery): Promise<LearnerAcademicSnapshot | null> {
		const data = await this.store.read();
		const matches = data.snapshots.filter(
			(item) =>
				item.studentId === query.studentId && item.schoolId === query.schoolId,
		);
		return matches.at(-1) ?? null;
	}

	async save(snapshot: LearnerAcademicSnapshot): Promise<void> {
		await this.store.update((data) => {
			data.snapshots.push(snapshot);
		});
	}
}

export class FileExerciseSetRepository implements ExerciseSetRepository {
	constructor(private readonly store: JsonFileStore) {}

	async findBySnapshotId(snapshotId: string): Promise<ExerciseSet | null> {
		const data = await this.store.read();
		return data.sets.find((item) => item.snapshotId === snapshotId) ?? null;
	}

	async listByStudentId(query: LearnerContextQuery): Promise<ExerciseSet[]> {
		const data = await this.store.read();
		return data.sets
			.filter(
				(item) =>
					item.studentId === query.studentId && item.schoolId === query.schoolId,
			)
			.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
	}

	async getById(id: string): Promise<ExerciseSet | null> {
		const data = await this.store.read();
		return data.sets.find((item) => item.id === id) ?? null;
	}

	async save(set: ExerciseSet): Promise<void> {
		await this.store.update((data) => {
			const index = data.sets.findIndex((item) => item.id === set.id);
			if (index >= 0) data.sets[index] = set;
			else data.sets.push(set);
		});
	}
}

export class FilePracticeSettingsRepository implements PracticeSettingsRepository {
	constructor(private readonly store: JsonFileStore) {}

	async get(query: LearnerContextQuery): Promise<PracticeSettings | null> {
		const data = await this.store.read();
		return (
			data.practiceSettings.find(
				(item) =>
					item.schoolId === query.schoolId && item.studentId === query.studentId,
			) ?? null
		);
	}

	async save(settings: PracticeSettings): Promise<void> {
		await this.store.update((data) => {
			const index = data.practiceSettings.findIndex(
				(item) =>
					item.schoolId === settings.schoolId && item.studentId === settings.studentId,
			);
			if (index >= 0) data.practiceSettings[index] = settings;
			else data.practiceSettings.push(settings);
		});
	}
}

export class FileStudentAccessCodeRepository implements StudentAccessCodeRepository {
	constructor(private readonly store: JsonFileStore) {}

	async getById(id: string): Promise<StudentAccessCode | null> {
		const data = await this.store.read();
		return data.accessCodes.find((item) => item.id === id) ?? null;
	}

	async getByHash(codeHash: string): Promise<StudentAccessCode | null> {
		const data = await this.store.read();
		return data.accessCodes.find((item) => item.codeHash === codeHash) ?? null;
	}

	async getActiveByStudentId(studentId: string): Promise<StudentAccessCode | null> {
		const data = await this.store.read();
		return data.accessCodes.find((item) => item.studentId === studentId && item.revokedAt === null) ?? null;
	}

	async listByStudentId(studentId: string): Promise<StudentAccessCode[]> {
		const data = await this.store.read();
		return data.accessCodes.filter((item) => item.studentId === studentId);
	}

	async listActiveLearners(): Promise<LearnerContextQuery[]> {
		const data = await this.store.read();
		return data.accessCodes
			.filter((item) => item.revokedAt === null)
			.map((item) => learnerQueryForIssuedCode(item));
	}

	async save(code: StudentAccessCode): Promise<void> {
		await this.store.update((data) => {
			const index = data.accessCodes.findIndex((item) => item.id === code.id);
			if (index >= 0) data.accessCodes[index] = code;
			else data.accessCodes.push(code);
		});
	}
}

export class FileSessionStore implements SessionStore {
	constructor(private readonly store: JsonFileStore) {}

	async get(token: string): Promise<SessionActor | null> {
		const data = await this.store.read();
		return data.sessions.find((item) => item.token === token)?.actor ?? null;
	}

	async set(token: string, actor: SessionActor): Promise<void> {
		await this.store.update((data) => {
			const index = data.sessions.findIndex((item) => item.token === token);
			if (index >= 0) data.sessions[index] = { token, actor };
			else data.sessions.push({ token, actor });
		});
	}

	async deleteByStudentId(studentId: string): Promise<void> {
		await this.store.update((data) => {
			data.sessions = data.sessions.filter(
				(item) => !(item.actor.role === "student" && item.actor.studentId === studentId),
			);
		});
	}
}
