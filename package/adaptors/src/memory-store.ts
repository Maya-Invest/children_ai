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

export class InMemorySnapshotRepository implements SnapshotRepository {
	private readonly items: LearnerAcademicSnapshot[] = [];

	async getCurrent(query: LearnerContextQuery): Promise<LearnerAcademicSnapshot | null> {
		return (
			this.items
				.filter(
					(item) =>
						item.studentId === query.studentId
						&& item.schoolId === query.schoolId,
				)
				.at(-1) ?? null
		);
	}

	async save(snapshot: LearnerAcademicSnapshot): Promise<void> {
		this.items.push(snapshot);
	}
}

export class InMemoryExerciseSetRepository implements ExerciseSetRepository {
	private readonly items: ExerciseSet[] = [];

	async findBySnapshotId(snapshotId: string): Promise<ExerciseSet | null> {
		return this.items.find((item) => item.snapshotId === snapshotId) ?? null;
	}

	async listByStudentId(query: LearnerContextQuery): Promise<ExerciseSet[]> {
		return this.items.filter(
			(item) =>
				item.studentId === query.studentId && item.schoolId === query.schoolId,
		);
	}

	async getById(id: string): Promise<ExerciseSet | null> {
		return this.items.find((item) => item.id === id) ?? null;
	}

	async save(set: ExerciseSet): Promise<void> {
		const index = this.items.findIndex((item) => item.id === set.id);
		if (index >= 0) {
			this.items[index] = set;
			return;
		}
		this.items.push(set);
	}
}

export class InMemoryPracticeSettingsRepository implements PracticeSettingsRepository {
	private readonly items = new Map<string, PracticeSettings>();

	async get(query: LearnerContextQuery): Promise<PracticeSettings | null> {
		return this.items.get(practiceKey(query)) ?? null;
	}

	async save(settings: PracticeSettings): Promise<void> {
		this.items.set(practiceKey(settings), settings);
	}
}

function practiceKey(query: { schoolId: string; studentId: string }): string {
	return `${query.schoolId}:${query.studentId}`;
}

export class InMemoryStudentAccessCodeRepository implements StudentAccessCodeRepository {
	private readonly items: StudentAccessCode[] = [];

	async getById(id: string): Promise<StudentAccessCode | null> {
		return this.items.find((item) => item.id === id) ?? null;
	}

	async getByHash(codeHash: string): Promise<StudentAccessCode | null> {
		return this.items.find((item) => item.codeHash === codeHash) ?? null;
	}

	async getActiveByStudentId(studentId: string): Promise<StudentAccessCode | null> {
		return (
			this.items.find((item) => item.studentId === studentId && item.revokedAt === null) ?? null
		);
	}

	async listByStudentId(studentId: string): Promise<StudentAccessCode[]> {
		return this.items.filter((item) => item.studentId === studentId);
	}

	async listActiveLearners(): Promise<LearnerContextQuery[]> {
		return this.items
			.filter((item) => item.revokedAt === null)
			.map((item) => learnerQueryForIssuedCode(item));
	}

	async save(code: StudentAccessCode): Promise<void> {
		const index = this.items.findIndex((item) => item.id === code.id);
		if (index >= 0) {
			this.items[index] = code;
			return;
		}
		this.items.push(code);
	}
}
