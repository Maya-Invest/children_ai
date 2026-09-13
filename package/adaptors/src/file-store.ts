import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
	ExerciseSet,
	ExerciseSetRepository,
	LearnerAcademicSnapshot,
	LearnerContextQuery,
	SnapshotRepository,
	StudentAccessCode,
	StudentAccessCodeRepository,
} from "@children-ai/domain";

type StoreFile = {
	snapshots: LearnerAcademicSnapshot[];
	sets: ExerciseSet[];
	accessCodes: StudentAccessCode[];
};

const empty = (): StoreFile => ({ snapshots: [], sets: [], accessCodes: [] });

export class JsonFileStore {
	constructor(private readonly filePath: string) {}

	async read(): Promise<StoreFile> {
		try {
			const raw = await readFile(this.filePath, "utf8");
			const parsed = JSON.parse(raw) as Partial<StoreFile>;
			return {
				snapshots: parsed.snapshots ?? [],
				sets: parsed.sets ?? [],
				accessCodes: parsed.accessCodes ?? [],
			};
		} catch {
			return empty();
		}
	}

	async write(store: StoreFile): Promise<void> {
		await mkdir(dirname(this.filePath), { recursive: true });
		await writeFile(this.filePath, JSON.stringify(store, null, 2), "utf8");
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
		const data = await this.store.read();
		data.snapshots.push(snapshot);
		await this.store.write(data);
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
		const data = await this.store.read();
		data.sets.push(set);
		await this.store.write(data);
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
			.map((item) => ({ schoolId: item.schoolId, studentId: item.studentId }));
	}

	async save(code: StudentAccessCode): Promise<void> {
		const data = await this.store.read();
		const index = data.accessCodes.findIndex((item) => item.id === code.id);
		if (index >= 0) data.accessCodes[index] = code;
		else data.accessCodes.push(code);
		await this.store.write(data);
	}
}
