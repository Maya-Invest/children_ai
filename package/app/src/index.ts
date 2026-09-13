import {
	AlreadyGeneratedError,
	ChildNotLinkedError,
	GuardianCannotGenerateError,
	LessonNotInPackError,
	NoSnapshotError,
	UnknownAccessCodeError,
	formatStudentAccessCode,
	generateStudentAccessCode,
	hashStudentAccessCode,
	isCompleteStudentAccessCode,
	snapshotFingerprint,
	studentAccessCodeHint,
	suggestFocus,
	type Clock,
	type CurriculumCatalogPort,
	type EdayaContextPort,
	type ExerciseGeneratorPort,
	type ExerciseSet,
	type ExerciseSetRepository,
	type GuardianActor,
	type GuardianChild,
	type GuardianChildrenPort,
	type GuardianPrincipal,
	type IdGenerator,
	type IssuedStudentAccessCode,
	type LearnerAcademicSnapshot,
	type LearnerContextQuery,
	type PracticeFocus,
	type SessionActor,
	type SnapshotRepository,
	type StudentAccessCode,
	type StudentAccessCodeRepository,
	type StudentActor,
	type StudentSessionPort,
} from "@children-ai/domain";

export type AppPorts = {
	edaya: EdayaContextPort;
	catalog: CurriculumCatalogPort;
	generator: ExerciseGeneratorPort;
	snapshots: SnapshotRepository;
	sets: ExerciseSetRepository;
	children: GuardianChildrenPort;
	codes: StudentAccessCodeRepository;
	studentSessions: StudentSessionPort;
	clock: Clock;
	ids: IdGenerator;
	syncDebounceMs?: number;
};

const DEFAULT_SYNC_DEBOUNCE_MS = 5 * 60 * 1000;

export type GuardianChildView = GuardianChild & {
	accessCode: { hint: string } | null;
};

export class ChildrenAiApp {
	constructor(private readonly ports: AppPorts) {}

	async resolveGuardian(principal: GuardianPrincipal): Promise<GuardianActor> {
		const listing = await this.ports.children.listChildren({
			subjectId: principal.subjectId,
			email: principal.email,
		});
		return {
			role: "guardian",
			subjectId: principal.subjectId,
			schoolId: listing.schoolId,
			displayName:
				principal.displayName
				|| listing.displayName
				|| principal.email
				|| "Parent",
		};
	}

	async listChildren(guardian: GuardianActor): Promise<{
		schoolId: string;
		displayName: string;
		children: GuardianChildView[];
	}> {
		const listing = await this.ports.children.listChildren({
			subjectId: guardian.subjectId,
		});
		const children: GuardianChildView[] = [];
		for (const child of listing.children) {
			const active = await this.ports.codes.getActiveByStudentId(child.studentId);
			children.push({
				...child,
				accessCode: active ? { hint: active.displayHint } : null,
			});
		}
		return {
			schoolId: listing.schoolId,
			displayName: listing.displayName || guardian.displayName,
			children,
		};
	}

	async issueAccessCode(
		guardian: GuardianActor,
		studentId: string,
	): Promise<IssuedStudentAccessCode> {
		const child = await this.requireLinkedChild(guardian, studentId);
		const now = this.ports.clock.nowIso();
		const previous = await this.ports.codes.getActiveByStudentId(studentId);
		if (previous) {
			await this.ports.codes.save({ ...previous, revokedAt: now });
			await this.ports.studentSessions.deleteByStudentId(studentId);
		}

		const code = generateStudentAccessCode();
		const record: StudentAccessCode = {
			id: this.ports.ids.next(),
			schoolId: child.schoolId,
			studentId: child.studentId,
			guardianSubjectId: guardian.subjectId,
			codeHash: await hashStudentAccessCode(code),
			displayHint: studentAccessCodeHint(code),
			createdAt: now,
			revokedAt: null,
		};
		await this.ports.codes.save(record);
		return {
			code: formatStudentAccessCode(code),
			hint: record.displayHint,
			studentId: child.studentId,
		};
	}

	async revokeAccessCode(guardian: GuardianActor, studentId: string): Promise<void> {
		await this.requireLinkedChild(guardian, studentId);
		const active = await this.ports.codes.getActiveByStudentId(studentId);
		if (!active) return;
		await this.ports.codes.save({
			...active,
			revokedAt: this.ports.clock.nowIso(),
		});
		await this.ports.studentSessions.deleteByStudentId(studentId);
	}

	async signInStudent(code: string): Promise<StudentActor> {
		if (!isCompleteStudentAccessCode(code)) throw new UnknownAccessCodeError();
		const record = await this.ports.codes.getByHash(await hashStudentAccessCode(code));
		if (!record || record.revokedAt) throw new UnknownAccessCodeError();

		const listing = await this.ports.children.listChildren({
			subjectId: record.guardianSubjectId,
		});
		const child =
			listing.children.find((item) => item.studentId === record.studentId)
			?? {
				studentId: record.studentId,
				schoolId: record.schoolId,
				firstName: "Élève",
				lastName: "",
			};

		return {
			role: "student",
			studentId: record.studentId,
			schoolId: record.schoolId,
			guardianSubjectId: record.guardianSubjectId,
			codeId: record.id,
			displayName: `${child.firstName} ${child.lastName}`.trim() || "Élève",
			childFirstName: child.firstName || "Élève",
		};
	}

	async syncSnapshot(
		query: LearnerContextQuery,
		options: { force?: boolean } = {},
	): Promise<LearnerAcademicSnapshot> {
		const current = await this.ports.snapshots.getCurrent(query);
		if (
			current
			&& !options.force
			&& this.isWithinDebounce(current.createdAt)
		) {
			return current;
		}

		const context = await this.ports.edaya.pullLearnerContext(query);
		const packVersion = this.ports.catalog.packVersion();
		const fingerprint = snapshotFingerprint(context, packVersion);
		if (current?.fingerprint === fingerprint) return current;

		const snapshot: LearnerAcademicSnapshot = {
			id: this.ports.ids.next(),
			schoolId: query.schoolId,
			studentId: query.studentId,
			fingerprint,
			packVersion,
			createdAt: this.ports.clock.nowIso(),
			context,
		};
		await this.ports.snapshots.save(snapshot);
		return snapshot;
	}

	async getHome(query: LearnerContextQuery): Promise<{
		snapshot: LearnerAcademicSnapshot;
		focus: PracticeFocus;
		lessonTitle: string;
		currentSet: ExerciseSet | null;
		history: ExerciseSet[];
	}> {
		const snapshot = await this.syncSnapshot(query);
		const lessons = this.ports.catalog.listLessons(snapshot.context.student.grade);
		const focus = suggestFocus(snapshot, lessons);
		const lesson = this.ports.catalog.getLesson(focus.lessonId);
		if (!lesson) throw new LessonNotInPackError(focus.lessonId);
		const currentSet = await this.ports.sets.findBySnapshotId(snapshot.id);
		const history = await this.ports.sets.listByStudentId(query);
		return {
			snapshot,
			focus,
			lessonTitle: lesson.title,
			currentSet,
			history,
		};
	}

	async generate(actor: SessionActor): Promise<ExerciseSet> {
		if (actor.role !== "student") throw new GuardianCannotGenerateError();
		const query = learnerRef(actor);
		const snapshot = await this.ensureSnapshot(query);
		const existing = await this.ports.sets.findBySnapshotId(snapshot.id);
		if (existing) throw new AlreadyGeneratedError(existing.id);

		const lessons = this.ports.catalog.listLessons(snapshot.context.student.grade);
		const focus = suggestFocus(snapshot, lessons);
		const lesson = this.ports.catalog.getLesson(focus.lessonId);
		if (!lesson) throw new LessonNotInPackError(focus.lessonId);

		const set = await this.ports.generator.generate({ snapshot, lesson, focus });
		await this.ports.sets.save(set);
		return set;
	}

	async listSets(query: LearnerContextQuery): Promise<ExerciseSet[]> {
		return this.ports.sets.listByStudentId(query);
	}

	async getSet(query: LearnerContextQuery, setId: string): Promise<ExerciseSet | null> {
		const set = await this.ports.sets.getById(setId);
		if (
			!set
			|| set.studentId !== query.studentId
			|| set.schoolId !== query.schoolId
		) {
			return null;
		}
		return set;
	}

	async syncLinkedSnapshots(): Promise<{ studentId: string; snapshotId: string }[]> {
		const learners = await this.ports.codes.listActiveLearners();
		const results: { studentId: string; snapshotId: string }[] = [];
		for (const learner of learners) {
			const snapshot = await this.syncSnapshot(learner, { force: true });
			results.push({ studentId: learner.studentId, snapshotId: snapshot.id });
		}
		return results;
	}

	private async requireLinkedChild(
		guardian: GuardianActor,
		studentId: string,
	): Promise<GuardianChild> {
		const listing = await this.ports.children.listChildren({
			subjectId: guardian.subjectId,
		});
		const child = listing.children.find((item) => item.studentId === studentId);
		if (!child) throw new ChildNotLinkedError();
		return child;
	}

	private async ensureSnapshot(
		query: LearnerContextQuery,
	): Promise<LearnerAcademicSnapshot> {
		const current = await this.ports.snapshots.getCurrent(query);
		if (current) return current;
		const synced = await this.syncSnapshot(query, { force: true });
		if (!synced) throw new NoSnapshotError();
		return synced;
	}

	private isWithinDebounce(createdAt: string): boolean {
		const debounceMs = this.ports.syncDebounceMs ?? DEFAULT_SYNC_DEBOUNCE_MS;
		if (debounceMs <= 0) return false;
		const created = Date.parse(createdAt);
		const now = Date.parse(this.ports.clock.nowIso());
		if (Number.isNaN(created) || Number.isNaN(now)) return false;
		return now - created < debounceMs;
	}
}

export function learnerRef(actor: StudentActor): LearnerContextQuery {
	return { schoolId: actor.schoolId, studentId: actor.studentId };
}
