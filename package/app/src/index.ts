import {
	AlreadyGeneratedError,
	AlreadySubmittedError,
	ChildNotLinkedError,
	CorrectionUnavailableError,
	EmptySubmissionError,
	ExerciseSetNotFoundError,
	GuardianCannotGenerateError,
	LessonNotInPackError,
	NoSnapshotError,
	SetNotSubmittedError,
	StudentOnlyActionError,
	UnknownAccessCodeError,
	formatStudentAccessCode,
	generateStudentAccessCode,
	hashStudentAccessCode,
	isCompleteStudentAccessCode,
	normalizeAnswer,
	presentExerciseSet,
	scoreExerciseSet,
	snapshotFingerprint,
	studentAccessCodeHint,
	suggestFocus,
	type Clock,
	type CurriculumCatalogPort,
	type EdayaContextPort,
	type ExerciseAudience,
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
	type PracticeSettings,
	type PracticeSettingsRepository,
	type SessionActor,
	type SnapshotRepository,
	type StudentAccessCode,
	type StudentAccessCodeRepository,
	type StudentActor,
	type StudentAnswer,
	type StudentSessionPort,
	demoFamilyListing,
	demoGuardianActor,
	demoStudentActor,
	isDemoGuardian,
	isDemoIssuedAccess,
	learnerQueryForIssuedCode,
} from "@children-ai/domain";

export type AppPorts = {
	edaya: EdayaContextPort;
	catalog: CurriculumCatalogPort;
	generator: ExerciseGeneratorPort;
	snapshots: SnapshotRepository;
	sets: ExerciseSetRepository;
	practiceSettings: PracticeSettingsRepository;
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
		const listing = isDemoGuardian(guardian)
			? demoFamilyListing(guardian)
			: await this.ports.children.listChildren({
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

		const listing = isDemoIssuedAccess(record.guardianSubjectId)
			? demoFamilyListing(demoGuardianActor())
			: await this.ports.children.listChildren({
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
			sessionKind: "code",
		};
	}

	async signInDemo(): Promise<StudentActor> {
		return demoStudentActor();
	}

	async signInDemoGuardian(): Promise<GuardianActor> {
		return demoGuardianActor();
	}

	async syncSnapshot(
		query: LearnerContextQuery,
		options: { force?: boolean } = {},
	): Promise<LearnerAcademicSnapshot> {
		const current = await this.ports.snapshots.getCurrent(query);
		if (
			current
			&& !options.force
			&& (current.context.timetable?.length ?? 0) > 0
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

	async getHome(
		query: LearnerContextQuery,
		audience: ExerciseAudience = "student",
	): Promise<{
		snapshot: LearnerAcademicSnapshot;
		focus: PracticeFocus;
		lessonTitle: string;
		currentSet: ExerciseSet | null;
		history: ExerciseSet[];
		autoReleaseCorrection: boolean;
		exerciseUpgradeAvailable: boolean;
	}> {
		const snapshot = await this.syncSnapshot(query);
		const lessons = this.ports.catalog.listLessons(snapshot.context.student.grade);
		const focus = suggestFocus(snapshot, lessons);
		const lesson = this.ports.catalog.getLesson(focus.lessonId);
		if (!lesson) throw new LessonNotInPackError(focus.lessonId);
		const currentSet = await this.ports.sets.findBySnapshotId(snapshot.id);
		const history = await this.ports.sets.listByStudentId(query);
		const settings = await this.ports.practiceSettings.get(query);
		return {
			snapshot,
			focus,
			lessonTitle: lesson.title,
			currentSet: currentSet ? presentExerciseSet(currentSet, audience) : null,
			history: history.map((set) => presentExerciseSet(set, audience)),
			autoReleaseCorrection: settings?.autoReleaseCorrection ?? false,
			exerciseUpgradeAvailable: isUpgradableSet(currentSet),
		};
	}

	async generate(actor: SessionActor): Promise<ExerciseSet> {
		if (actor.role !== "student") throw new GuardianCannotGenerateError();
		const query = learnerRef(actor);
		const snapshot = await this.ensureSnapshot(query);
		const existing = await this.ports.sets.findBySnapshotId(snapshot.id);
		if (existing && !isUpgradableSet(existing)) {
			throw new AlreadyGeneratedError(existing.id);
		}

		const lessons = this.ports.catalog.listLessons(snapshot.context.student.grade);
		const focus = suggestFocus(snapshot, lessons);
		const lesson = this.ports.catalog.getLesson(focus.lessonId);
		if (!lesson) throw new LessonNotInPackError(focus.lessonId);

		const generated = await this.ports.generator.generate({ snapshot, lesson, focus });
		const set = existing ? { ...generated, id: existing.id } : generated;
		await this.ports.sets.save(set);
		return presentExerciseSet(set, "student");
	}

	async listSets(
		query: LearnerContextQuery,
		audience: ExerciseAudience = "student",
	): Promise<ExerciseSet[]> {
		const sets = await this.ports.sets.listByStudentId(query);
		return sets.map((set) => presentExerciseSet(set, audience));
	}

	async getSet(
		query: LearnerContextQuery,
		setId: string,
		audience: ExerciseAudience = "student",
	): Promise<ExerciseSet | null> {
		const set = await this.requireOwnedSet(query, setId);
		return set ? presentExerciseSet(set, audience) : null;
	}

	async submitSet(
		actor: SessionActor,
		setId: string,
		answers: StudentAnswer[],
	): Promise<ExerciseSet> {
		if (actor.role !== "student") throw new StudentOnlyActionError();
		const query = learnerRef(actor);
		const set = await this.requireOwnedSet(query, setId);
		if (!set) throw new ExerciseSetNotFoundError();
		if (set.submittedAt) throw new AlreadySubmittedError();

		const submittedAnswers = set.questions.map((question) => ({
			questionId: question.id,
			value: answers.find((answer) => answer.questionId === question.id)?.value ?? "",
		}));
		if (!submittedAnswers.some((answer) => Boolean(normalizeAnswer(answer.value)))) {
			throw new EmptySubmissionError();
		}
		if (
			!set.questions.every((question) =>
				Boolean(normalizeAnswer(question.expectedAnswer ?? ""))
			)
		) {
			throw new CorrectionUnavailableError();
		}

		const now = this.ports.clock.nowIso();
		const settings = await this.ports.practiceSettings.get(query);
		const submitted: ExerciseSet = {
			...set,
			answers: submittedAnswers,
			submittedAt: now,
			score: scoreExerciseSet(set, submittedAnswers),
			correctionReleasedAt: settings?.autoReleaseCorrection
				? now
				: set.correctionReleasedAt ?? null,
		};
		await this.ports.sets.save(submitted);
		return presentExerciseSet(submitted, "student");
	}

	async saveSetProgress(
		actor: SessionActor,
		setId: string,
		answers: StudentAnswer[],
	): Promise<ExerciseSet> {
		if (actor.role !== "student") throw new StudentOnlyActionError();
		const query = learnerRef(actor);
		const set = await this.requireOwnedSet(query, setId);
		if (!set) throw new ExerciseSetNotFoundError();
		if (set.submittedAt) throw new AlreadySubmittedError();

		const incoming = new Map(answers.map((answer) => [answer.questionId, answer.value]));
		const existing = new Map((set.answers ?? []).map((answer) => [answer.questionId, answer.value]));
		const saved: ExerciseSet = {
			...set,
			answers: set.questions.map((question) => ({
				questionId: question.id,
				value: incoming.has(question.id)
					? (incoming.get(question.id) ?? "")
					: (existing.get(question.id) ?? ""),
			})),
		};
		await this.ports.sets.save(saved);
		return presentExerciseSet(saved, "student");
	}

	async releaseCorrection(
		guardian: GuardianActor,
		studentId: string,
		setId?: string,
	): Promise<ExerciseSet> {
		const child = await this.requireLinkedChild(guardian, studentId);
		const query = { schoolId: child.schoolId, studentId: child.studentId };
		const set = setId
			? await this.requireOwnedSet(query, setId)
			: await this.currentSetFor(query);
		if (!set) throw new ExerciseSetNotFoundError();
		if (!set.submittedAt) throw new SetNotSubmittedError();
		if (!(set.answers ?? []).some((answer) => Boolean(normalizeAnswer(answer.value)))) {
			throw new EmptySubmissionError();
		}
		if (
			!set.questions.every((question) =>
				Boolean(normalizeAnswer(question.expectedAnswer ?? ""))
			)
		) {
			throw new CorrectionUnavailableError();
		}
		if (set.correctionReleasedAt) {
			return presentExerciseSet(set, "guardian");
		}
		const released: ExerciseSet = {
			...set,
			correctionReleasedAt: this.ports.clock.nowIso(),
		};
		await this.ports.sets.save(released);
		return presentExerciseSet(released, "guardian");
	}

	async updatePracticeSettings(
		guardian: GuardianActor,
		studentId: string,
		autoReleaseCorrection: boolean,
	): Promise<PracticeSettings> {
		const child = await this.requireLinkedChild(guardian, studentId);
		const query = { schoolId: child.schoolId, studentId: child.studentId };
		const settings: PracticeSettings = {
			schoolId: child.schoolId,
			studentId: child.studentId,
			autoReleaseCorrection,
		};
		await this.ports.practiceSettings.save(settings);
		if (autoReleaseCorrection) {
			const current = await this.currentSetFor(query);
			const hasAnswer = (current?.answers ?? []).some((answer) =>
				Boolean(normalizeAnswer(answer.value))
			);
			const hasCorrection = Boolean(
				current?.questions.every((question) =>
					Boolean(normalizeAnswer(question.expectedAnswer ?? ""))
				),
			);
			if (
				current?.submittedAt
				&& hasAnswer
				&& hasCorrection
				&& !current.correctionReleasedAt
			) {
				await this.ports.sets.save({
					...current,
					correctionReleasedAt: this.ports.clock.nowIso(),
				});
			}
		}
		return settings;
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

	private async requireOwnedSet(
		query: LearnerContextQuery,
		setId: string,
	): Promise<ExerciseSet | null> {
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

	private async currentSetFor(query: LearnerContextQuery): Promise<ExerciseSet | null> {
		const snapshot = await this.ports.snapshots.getCurrent(query);
		if (!snapshot) return null;
		return this.ports.sets.findBySnapshotId(snapshot.id);
	}

	private async requireLinkedChild(
		guardian: GuardianActor,
		studentId: string,
	): Promise<GuardianChild> {
		const listing = isDemoGuardian(guardian)
			? demoFamilyListing(guardian)
			: await this.ports.children.listChildren({
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
	return learnerQueryForIssuedCode(actor);
}

function isUpgradableSet(set: ExerciseSet | null): boolean {
	return Boolean(
		set
		&& !set.submittedAt
		&& set.questions.every((question) => !question.expectedAnswer),
	);
}
