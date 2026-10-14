import {
	DAILY_PRACTICE_MINUTES,
	NothingToPracticeError,
	calendarDaysUntil,
	composeSessionPlan,
	displaySubjectLabel,
	SNAPSHOT_PACK_VERSION,
	endOfDaySnapshotLessons,
	revisionLessonsForDay,
	scanPracticeWindow,
	splitMinutes,
	upcomingSnapshotLessons,
	type CurriculumLesson,
	type ExerciseProposal,
	type PracticeFocus,
	type PracticeFocusPort,
	type PracticeFocusRequest,
	type PracticeIntent,
	type PracticeRecommendation,
	type PracticeSessionPlan,
	type UpcomingAssessment,
} from "@children-ai/domain";
export class StubPracticeFocus implements PracticeFocusPort {
	packVersion(): string {
		return SNAPSHOT_PACK_VERSION;
	}

	async recommend(input: PracticeFocusRequest): Promise<PracticeRecommendation> {
		const plan = await this.plan(input);
		const chosen = plan.tracks.find((track) => track.available && track.focus && track.lesson);
		if (!chosen?.focus || !chosen.lesson) throw new NothingToPracticeError();
		return { focus: chosen.focus, lesson: chosen.lesson };
	}

	async plan(input: PracticeFocusRequest): Promise<PracticeSessionPlan> {
		const now = input.now ?? new Date();
		const context = input.snapshot.context;
		const progress = context.classProgress ?? [];
		const grade = context.student.grade;
		const window = scanPracticeWindow(input.snapshot, now);
		const revisionMatches = revisionLessonsForDay(
			endOfDaySnapshotLessons(window, progress, grade),
			window.today,
		);
		const homeworkMatch = upcomingSnapshotLessons(
			window,
			context.timetable ?? [],
			progress,
			grade,
		)[0];
		if (revisionMatches.length === 0 && !homeworkMatch) return composeSessionPlan({
			snapshot: input.snapshot,
			revision: null,
			homework: null,
		});

		const days = homeworkMatch ? calendarDaysUntil(homeworkMatch.assessment.dueAt, now) : null;
		const share = shareDailyMinutes(revisionMatches.length > 0, Boolean(homeworkMatch), days);
		const slices = splitMinutes(share.revisionMinutes, revisionMatches.length);
		const revisions = revisionMatches.flatMap((match, index) => {
			const minutes = slices[index] ?? 0;
			if (minutes <= 0) return [];
			return [{
				focus: focusFor(match.lesson, "prepare_next_day", match.slot.title, minutes),
				lesson: match.lesson,
				minutes,
			}];
		});
		const homework = homeworkMatch
			? {
				focus: focusFor(
					homeworkMatch.lesson,
					"upcoming_work",
					homeworkMatch.slot.title,
					share.homeworkMinutes,
					homeworkMatch.assessment,
				),
				lesson: homeworkMatch.lesson,
				assessment: homeworkMatch.assessment,
				minutes: share.homeworkMinutes,
			}
			: null;
		return composeSessionPlan({
			snapshot: input.snapshot,
			revision: revisions[0] ?? null,
			revisions,
			homework,
		});
	}
}

function shareDailyMinutes(
	hasRevision: boolean,
	hasHomework: boolean,
	daysUntilDue: number | null,
): { revisionMinutes: number; homeworkMinutes: number } {
	if (hasRevision && hasHomework) {
		if (daysUntilDue !== null && daysUntilDue <= 3) {
			return { revisionMinutes: 40, homeworkMinutes: 80 };
		}
		if (daysUntilDue !== null && daysUntilDue <= 7) {
			return { revisionMinutes: 60, homeworkMinutes: 60 };
		}
		return { revisionMinutes: 80, homeworkMinutes: 40 };
	}
	if (hasRevision) return { revisionMinutes: DAILY_PRACTICE_MINUTES, homeworkMinutes: 0 };
	return { revisionMinutes: 0, homeworkMinutes: DAILY_PRACTICE_MINUTES };
}

function focusFor(
	lesson: CurriculumLesson,
	intent: PracticeIntent,
	slotTitle: string,
	minutes: number,
	assessment?: UpcomingAssessment,
): PracticeFocus {
	const subject = displaySubjectLabel(lesson.subject) || lesson.subject;
	const rationale = assessment
		? `Évaluation « ${assessment.title} » prévue le ${assessment.dueAt.slice(0, 10)}, sur la matière « ${slotTitle} ». Entraînement sur « ${lesson.title} ».`
		: `Emploi du temps : « ${slotTitle} ». Entraînement de fin de journée sur « ${lesson.title} ».`;
	const brief = assessment
		? `Compte tenu de l'évaluation « ${assessment.title} », voici la série d'exercices suggérée pour « ${lesson.title} ».`
		: `En fin de journée, voici la série d'exercices suggérée pour « ${lesson.title} » (${subject}), d'après les matières prévues aujourd'hui et demain.`;
	return {
		lessonId: lesson.id,
		subject: lesson.subject,
		rationale,
		brief,
		intent,
		proposals: proposalsFor(lesson, minutes),
	};
}

function proposalsFor(lesson: CurriculumLesson, minutes: number): ExerciseProposal[] {
	const count = minutes <= 40 ? 3 : minutes <= 80 ? 4 : 5;
	const slice = Math.floor(minutes / count);
	const skills = lesson.skills.slice(0, count);
	while (skills.length < count) skills.push(lesson.title);
	return skills.map((skill, index) => ({
		objective: skill,
		theme: lesson.theme.title,
		exerciseType: index % 2 === 0 ? "comprehension" : "problem_solving",
		difficulty: index === 0 ? "easy" : "medium",
		minutes: index === count - 1 ? minutes - slice * (count - 1) : slice,
		promptHint: skill,
	}));
}
