import {
	AlreadyGeneratedError,
	AlreadySubmittedError,
	ChildNotLinkedError,
	CorrectionUnavailableError,
	DomainError,
	EmptySubmissionError,
	ExerciseSetNotFoundError,
	GuardianCannotGenerateError,
	NoSnapshotError,
	SetNotSubmittedError,
	StudentOnlyActionError,
	UnknownAccessCodeError,
	DAILY_PRACTICE_MAX_MINUTES,
	DAILY_PRACTICE_MIN_MINUTES,
	displaySubjectLabel,
	exerciseTrack,
	formatStudentAccessCode,
	generateStudentAccessCode,
	hashStudentAccessCode,
	isCompleteStudentAccessCode,
	normalizeAnswer,
	NothingToPracticeError,
	PRACTICE_PLAN_VERSION,
	planningDateKey,
	presentExerciseSet,
	scoreExerciseSet,
	snapshotFingerprint,
	studentAccessCodeHint,
	type Clock,
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
	type PracticeFocusPort,
	type PracticeIntent,
	type PracticeSessionPlan,
	type PracticeSettings,
	type PracticeTrackKind,
	type PracticeTrackItem,
	type PracticeTrackPlan,
	type PracticePlanRepository,
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
	isPracticeIntent,
	learnerQueryForIssuedCode,
} from "@children-ai/domain";

export type AppPorts = {
	edaya: EdayaContextPort;
	focus: PracticeFocusPort;
	generator: ExerciseGeneratorPort;
	snapshots: SnapshotRepository;
	sets: ExerciseSetRepository;
	plans: PracticePlanRepository;
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
		const packVersion = this.ports.focus.packVersion();
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
		focus: PracticeFocus | null;
		lessonTitle: string;
		currentSet: ExerciseSet | null;
		history: ExerciseSet[];
		autoReleaseCorrection: boolean;
		focusIntent: PracticeIntent | null;
		planningDate: string;
		exerciseUpgradeAvailable: boolean;
		session: HomeSession;
	}> {
		const now = this.now();
		const snapshot = await this.syncSnapshot(query);
		const plan = await this.resolveDailyPlan(query, snapshot, now);
		const settings = await this.ports.practiceSettings.get(query);
		const history = await this.ports.sets.listByStudentId(query);
		const primary = primaryTrack(plan);
		const tracks = await Promise.all(
			plan.tracks.map((track) => this.presentTrack(snapshot.id, track, audience, history)),
		);
		const revisionSet = tracks.find((track) => track.kind === "revision")?.currentSet ?? null;
		return {
			snapshot,
			focus: primary?.focus ?? null,
			lessonTitle: primary?.lesson.title ?? "",
			currentSet: revisionSet,
			history: history.map((set) => presentExerciseSet(set, audience)),
			autoReleaseCorrection: settings?.autoReleaseCorrection ?? false,
			focusIntent: primary?.focus.intent ?? null,
			planningDate: planningDateKey(now),
			exerciseUpgradeAvailable: isUpgradableSet(revisionSet),
			session: {
				summary: plan.summary,
				totalMinutes: plan.totalMinutes,
				tracks,
			},
		};
	}

	async generate(
		actor: SessionActor,
		track: PracticeTrackKind = "revision",
		lessonId?: string,
	): Promise<ExerciseSet> {
		if (actor.role !== "student") throw new GuardianCannotGenerateError();
		const query = learnerRef(actor);
		const snapshot = await this.ensureSnapshot(query);
		const plan = await this.resolveDailyPlan(query, snapshot, this.now());
		const chosen = plan.tracks.find((item) => item.kind === track);
		const item = trackItem(chosen, lessonId);
		if (!chosen?.available || !item) {
			if (plan.tracks.every((entry) => !entry.available)) throw new NothingToPracticeError();
			throw new DomainError("TRACK_UNAVAILABLE", "Cette piste n'a pas de série à préparer.");
		}
		const plannedIds = new Set(trackItems(chosen).map((entry) => entry.lesson.id));
		const onTrack = (await this.ports.sets.listByStudentId(query)).filter((set) =>
			set.snapshotId === snapshot.id && exerciseTrack(set) === track
		);
		const existing = onTrack.find((set) => set.lessonId === item.lesson.id)
			?? onTrack.find((set) =>
				!plannedIds.has(set.lessonId)
				&& !set.submittedAt
				&& !hasStarted(set)
			)
			?? null;
		const replace = existing !== null && !blocksRegeneration(existing, item.lesson.id);
		if (existing && !replace) {
			throw new AlreadyGeneratedError(existing.id);
		}

		const generated = await this.ports.generator.generate({
			snapshot,
			lesson: item.lesson,
			focus: item.focus,
			plannedMinutes: item.minutes,
		});
		const set: ExerciseSet = {
			...(replace && existing ? { ...generated, id: existing.id } : generated),
			track,
			plannedMinutes: item.minutes,
		};
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
		patch: {
			autoReleaseCorrection?: boolean;
			focusIntent?: PracticeIntent;
		},
	): Promise<PracticeSettings> {
		if (patch.focusIntent !== undefined && !isPracticeIntent(patch.focusIntent)) {
			throw new DomainError("INVALID_PRACTICE_INTENT", "Ce choix de focus n'est pas reconnu.");
		}
		const child = await this.requireLinkedChild(guardian, studentId);
		const query = { schoolId: child.schoolId, studentId: child.studentId };
		const current = await this.ports.practiceSettings.get(query);
		const autoReleaseCorrection = patch.autoReleaseCorrection ?? current?.autoReleaseCorrection ?? false;
		const settings: PracticeSettings = {
			schoolId: child.schoolId,
			studentId: child.studentId,
			autoReleaseCorrection,
			focusIntent: patch.focusIntent ?? current?.focusIntent,
		};
		await this.ports.practiceSettings.save(settings);
		if (patch.autoReleaseCorrection === true) {
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

	private async resolveDailyPlan(
		query: LearnerContextQuery,
		snapshot: LearnerAcademicSnapshot,
		now: Date,
	): Promise<PracticeSessionPlan> {
		const planningDate = planningDateKey(now);
		const stored = await this.ports.plans.get(query, planningDate);
		const promptVersion = this.ports.focus.promptVersion();
		const samePrompt = promptVersion === "" || stored?.promptVersion === promptVersion;
		if (stored?.planVersion === PRACTICE_PLAN_VERSION && samePrompt) return stored;
		const plan = await this.ports.focus.plan({
			snapshot,
			now,
			sessionMinutes: {
				min: DAILY_PRACTICE_MIN_MINUTES,
				max: DAILY_PRACTICE_MAX_MINUTES,
			},
		});
		await this.ports.plans.save(query, planningDate, plan);
		return plan;
	}

	private now(): Date {
		const now = new Date(this.ports.clock.nowIso());
		return Number.isNaN(now.getTime()) ? new Date() : now;
	}

	private async presentTrack(
		snapshotId: string,
		track: PracticeTrackPlan,
		audience: ExerciseAudience,
		sets: ExerciseSet[],
	): Promise<HomeTrack> {
		const items = trackItems(track).map((item) => {
			const stored = sets.find((set) =>
				set.snapshotId === snapshotId
				&& exerciseTrack(set) === track.kind
				&& set.lessonId === item.lesson.id
			) ?? null;
			const current = shownSet(stored, item.lesson.id);
			return {
				lessonId: item.lesson.id,
				lessonTitle: item.lesson.title,
				subjectLabel: displaySubjectLabel(item.lesson.subject) || item.lesson.subject,
				minutes: item.minutes,
				assessmentLabel: item.assessmentLabel,
				questionTarget: item.focus.proposals.length,
				canGenerate: track.available && (stored === null || !blocksRegeneration(stored, item.lesson.id)),
				currentSet: current ? presentExerciseSet(current, audience) : null,
			};
		});
		const first = items[0];
		return {
			kind: track.kind,
			minutes: track.minutes,
			available: track.available,
			lessonTitle: first?.lessonTitle ?? null,
			subjectLabel: first?.subjectLabel ?? null,
			assessmentLabel: track.assessmentLabel ?? first?.assessmentLabel ?? null,
			currentSet: first?.currentSet ?? null,
			questionTarget: first?.questionTarget ?? 0,
			canGenerate: items.some((item) => item.canGenerate),
			items,
		};
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

export type HomeTrackItem = {
	lessonId: string;
	lessonTitle: string;
	subjectLabel: string | null;
	minutes: number;
	assessmentLabel: string | null;
	questionTarget: number;
	canGenerate: boolean;
	currentSet: ExerciseSet | null;
};

export type HomeTrack = {
	kind: PracticeTrackKind;
	minutes: number;
	available: boolean;
	lessonTitle: string | null;
	subjectLabel: string | null;
	assessmentLabel: string | null;
	currentSet: ExerciseSet | null;
	questionTarget: number;
	canGenerate: boolean;
	items: HomeTrackItem[];
};

export type HomeSession = {
	summary: string;
	totalMinutes: number;
	tracks: HomeTrack[];
};

function trackItems(track: PracticeTrackPlan): PracticeTrackItem[] {
	if (track.items.length > 0) return track.items;
	if (!track.focus || !track.lesson) return [];
	return [{
		minutes: track.minutes,
		focus: track.focus,
		lesson: track.lesson,
		assessmentLabel: track.assessmentLabel,
	}];
}

function trackItem(
	track: PracticeTrackPlan | undefined,
	lessonId: string | undefined,
): PracticeTrackItem | undefined {
	const items = track ? trackItems(track) : [];
	if (!lessonId) return items[0];
	return items.find((item) => item.lesson.id === lessonId);
}

function primaryTrack(plan: PracticeSessionPlan): (PracticeTrackPlan & {
	focus: PracticeFocus;
	lesson: NonNullable<PracticeTrackPlan["lesson"]>;
}) | null {
	const chosen = plan.tracks.find((track) => track.available && track.focus && track.lesson);
	if (!chosen?.focus || !chosen.lesson) return null;
	return { ...chosen, focus: chosen.focus, lesson: chosen.lesson };
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

function hasStarted(set: ExerciseSet): boolean {
	return (set.answers ?? []).some((answer) => answer.value.trim() !== "");
}

function blocksRegeneration(existing: ExerciseSet, lessonId: string): boolean {
	if (isUpgradableSet(existing)) return false;
	if (!existing.submittedAt && existing.lessonId !== lessonId && !hasStarted(existing)) return false;
	return true;
}

function shownSet(stored: ExerciseSet | null, lessonId: string): ExerciseSet | null {
	if (!stored || !lessonId) return stored;
	if (stored.submittedAt || stored.lessonId === lessonId || hasStarted(stored)) return stored;
	return null;
}
