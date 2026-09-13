import type {
	ExerciseSet,
	ExerciseSetRepository,
	LearnerAcademicSnapshot,
	LearnerContextQuery,
	SnapshotRepository,
	StudentAccessCode,
	StudentAccessCodeRepository,
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
		this.items.push(set);
	}
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
			.map((item) => ({ schoolId: item.schoolId, studentId: item.studentId }));
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
