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
	type SnapshotRepository,
	type StudentAccessCode,
	type StudentAccessCodeRepository,
} from "@children-ai/domain";

type StoreFile = {
	snapshots: LearnerAcademicSnapshot[];
	sets: ExerciseSet[];
	accessCodes: StudentAccessCode[];
	practiceSettings: PracticeSettings[];
};

const empty = (): StoreFile => ({
	snapshots: [],
	sets: [],
	accessCodes: [],
	practiceSettings: [],
});

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
				practiceSettings: parsed.practiceSettings ?? [],
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
		const index = data.sets.findIndex((item) => item.id === set.id);
		if (index >= 0) data.sets[index] = set;
		else data.sets.push(set);
		await this.store.write(data);
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
		const data = await this.store.read();
		const index = data.practiceSettings.findIndex(
			(item) =>
				item.schoolId === settings.schoolId && item.studentId === settings.studentId,
		);
		if (index >= 0) data.practiceSettings[index] = settings;
		else data.practiceSettings.push(settings);
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
			.map((item) => learnerQueryForIssuedCode(item));
	}

	async save(code: StudentAccessCode): Promise<void> {
		const data = await this.store.read();
		const index = data.accessCodes.findIndex((item) => item.id === code.id);
		if (index >= 0) data.accessCodes[index] = code;
		else data.accessCodes.push(code);
		await this.store.write(data);
	}
}
