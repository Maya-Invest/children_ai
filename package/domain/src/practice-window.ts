import { subjectsMatch } from "./display-subject.ts";
import { calendarDaysUntil, matchOfficialLesson, officialLessonsForSubject } from "./suggest-focus.ts";
import type {
	ClassProgressItem,
	CurriculumLesson,
	GradeId,
	LearnerAcademicSnapshot,
	TimetableDay,
	TimetableSlot,
	UpcomingAssessment,
} from "./types.ts";

export const DAILY_PRACTICE_MINUTES = 120;
export const DAILY_PRACTICE_MIN_MINUTES = 110;
export const DAILY_PRACTICE_MAX_MINUTES = 130;

export function isDailyPracticeDuration(minutes: number): boolean {
	return Number.isInteger(minutes)
		&& minutes >= DAILY_PRACTICE_MIN_MINUTES
		&& minutes <= DAILY_PRACTICE_MAX_MINUTES;
}
export const UPCOMING_EVALUATION_HORIZON_DAYS = 14;
/** A school day keeps at least this many distinct timetable subjects when they exist. */
export const MIN_DAILY_SUBJECTS = 3;

const DAY_ORDER: TimetableDay[] = [
	"sunday",
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
];

export type LessonOnTimetable = {
	lesson: CurriculumLesson;
	slot: TimetableSlot;
};

export type EvaluationOnTimetable = LessonOnTimetable & {
	assessment: UpcomingAssessment;
};

export type PracticeWindow = {
	planningDate: string;
	today: TimetableDay;
	nextDay: TimetableDay;
	todayLessons: TimetableSlot[];
	nextDayLessons: TimetableSlot[];
	evaluations: UpcomingAssessment[];
};

export function planningDateKey(now: Date): string {
	const key = now.toISOString().slice(0, 10);
	return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : "";
}

export function scanPracticeWindow(
	snapshot: LearnerAcademicSnapshot,
	now: Date,
): PracticeWindow {
	const today = weekdayOf(now);
	const nextDay = nextWeekday(today);
	const slots = snapshot.context.timetable ?? [];
	return {
		planningDate: planningDateKey(now),
		today,
		nextDay,
		todayLessons: lessonSlots(slots, today),
		nextDayLessons: lessonSlots(slots, nextDay),
		evaluations: evaluationsWithinHorizon(snapshot, now),
	};
}

export function endOfDayCandidates(
	window: PracticeWindow,
	gradeLessons: CurriculumLesson[],
): LessonOnTimetable[] {
	const seen = new Set<string>();
	const matches: LessonOnTimetable[] = [];
	for (const slot of [...window.todayLessons, ...window.nextDayLessons]) {
		const lesson = matchTimetableLesson(slot.title, gradeLessons);
		if (!lesson || seen.has(lesson.id)) continue;
		seen.add(lesson.id);
		matches.push({ lesson, slot });
	}
	return matches;
}

export function upcomingCandidates(
	window: PracticeWindow,
	timetable: TimetableSlot[],
	gradeLessons: CurriculumLesson[],
): EvaluationOnTimetable[] {
	const lessonSlotsAll = timetable.filter((slot) => slot.kind === "lesson");
	const matches: EvaluationOnTimetable[] = [];
	for (const assessment of window.evaluations) {
		const pool = officialLessonsForSubject(gradeLessons, assessment.subject);
		const lesson = matchOfficialLesson(assessment.title, pool.length > 0 ? pool : gradeLessons);
		if (!lesson) continue;
		const slot = lessonSlotsAll.find(
			(item) => matchTimetableLesson(item.title, [lesson])?.id === lesson.id,
		);
		if (!slot) continue;
		matches.push({ assessment, lesson, slot });
	}
	return matches;
}

export function matchTimetableLesson(
	slotTitle: string,
	lessons: CurriculumLesson[],
): CurriculumLesson | undefined {
	const haystack = fold(slotTitle);
	const byTitle = lessons.filter((lesson) => haystack.includes(fold(lesson.title)));
	if (byTitle.length === 1) return byTitle[0];
	if (byTitle.length > 1) {
		return [...byTitle].sort((left, right) => fold(right.title).length - fold(left.title).length)[0];
	}

	const scored = lessons.flatMap((lesson) => {
		const words = fold(lesson.title)
			.split(/[^a-z0-9]+/)
			.filter((word) => word.length >= 6);
		const hits = words.filter((word) => haystack.includes(word));
		if (hits.length === 0) return [];
		const longest = hits.reduce((best, word) => (word.length > best.length ? word : best), "");
		return [{ lesson, longest }];
	}).sort((left, right) => right.longest.length - left.longest.length);
	const best = scored[0];
	if (!best) return undefined;
	const tied = scored.filter((item) => item.longest === best.longest);
	return tied.length === 1 ? best.lesson : undefined;
}

function lessonSlots(slots: TimetableSlot[], day: TimetableDay): TimetableSlot[] {
	return slots
		.filter((slot) => slot.dayOfWeek === day && slot.kind === "lesson")
		.slice()
		.sort((left, right) => left.startTime.localeCompare(right.startTime));
}

function evaluationsWithinHorizon(
	snapshot: LearnerAcademicSnapshot,
	now: Date,
): UpcomingAssessment[] {
	const today = planningDateKey(now);
	return [...(snapshot.context.upcomingAssessments ?? [])]
		.filter((item) => {
			const due = item.dueAt.slice(0, 10);
			if (!today || due < today) return false;
			const days = calendarDaysUntil(item.dueAt, now);
			return days !== null && days >= 0 && days <= UPCOMING_EVALUATION_HORIZON_DAYS;
		})
		.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
}

function weekdayOf(now: Date): TimetableDay {
	return DAY_ORDER[now.getUTCDay()] ?? "monday";
}

function nextWeekday(day: TimetableDay): TimetableDay {
	const index = DAY_ORDER.indexOf(day);
	return DAY_ORDER[(index + 1) % DAY_ORDER.length] ?? "monday";
}

export const SNAPSHOT_PACK_VERSION = "snapshot";

export function resolveSnapshotLesson(
	slot: TimetableSlot,
	progress: readonly ClassProgressItem[],
	grade: GradeId,
): CurriculumLesson {
	const subject = subjectNamedIn(slot.title, progress) ?? slot.title;
	const named = soleChapter(slot.title, progress);
	const anchored = progress.filter((item) => item.slotId === slot.id);
	const chapter = openChapter(subject, progress) ?? named ?? (anchored.length === 1 ? anchored[0] : undefined);
	const title = chapter?.subjectMatter ?? slot.title;
	const lessonSubject = chapter?.subject ?? subject;
	return {
		id: slot.id,
		packVersion: SNAPSHOT_PACK_VERSION,
		country: "CI",
		cycle: "college",
		grade,
		subject: lessonSubject,
		competence: { id: slot.id, title },
		theme: { id: slot.id, title: chapter?.subject ?? lessonSubject },
		title,
		sequence: 1,
		exampleSituation: "",
		skills: [title],
		contents: chapter ? [chapter.subjectMatter] : [],
		sourcePdf: "",
	};
}

export function endOfDaySnapshotLessons(
	window: PracticeWindow,
	progress: readonly ClassProgressItem[],
	grade: GradeId,
): LessonOnTimetable[] {
	const seen = new Set<string>();
	const matches: LessonOnTimetable[] = [];
	for (const slot of [...window.todayLessons, ...window.nextDayLessons]) {
		const lesson = resolveSnapshotLesson(slot, progress, grade);
		if (seen.has(lesson.id)) continue;
		seen.add(lesson.id);
		matches.push({ lesson, slot });
	}
	return matches;
}

export function revisionLessonsForDay(
	matches: readonly LessonOnTimetable[],
	today: TimetableDay,
): LessonOnTimetable[] {
	const todayMatches = uniqueBySubject(matches.filter((match) => match.slot.dayOfWeek === today));
	if (todayMatches.length >= MIN_DAILY_SUBJECTS) return todayMatches;
	return uniqueBySubject([...todayMatches, ...matches]).slice(0, MIN_DAILY_SUBJECTS);
}

export function splitMinutes(total: number, count: number): number[] {
	if (count <= 0 || total <= 0) return [];
	const base = Math.floor(total / count);
	let extra = total % count;
	return Array.from({ length: count }, () => {
		const minutes = base + (extra > 0 ? 1 : 0);
		if (extra > 0) extra -= 1;
		return minutes;
	});
}

function uniqueBySubject(matches: readonly LessonOnTimetable[]): LessonOnTimetable[] {
	const chosen: LessonOnTimetable[] = [];
	for (const match of matches) {
		const subject = match.lesson.subject || match.slot.title;
		if (chosen.some((item) => subjectsMatch(item.lesson.subject || item.slot.title, subject))) continue;
		chosen.push(match);
	}
	return chosen;
}

export function upcomingSnapshotLessons(
	window: PracticeWindow,
	timetable: readonly TimetableSlot[],
	progress: readonly ClassProgressItem[],
	grade: GradeId,
): EvaluationOnTimetable[] {
	const lessons = timetable
		.filter((slot) => slot.kind === "lesson")
		.map((slot) => ({ slot, lesson: resolveSnapshotLesson(slot, progress, grade) }));
	const matches: EvaluationOnTimetable[] = [];
	for (const assessment of window.evaluations) {
		const chosen = lessonForAssessment(assessment, lessons, progress);
		if (!chosen) continue;
		matches.push({ assessment, lesson: chosen.lesson, slot: chosen.slot });
	}
	return matches;
}

function lessonForAssessment(
	assessment: UpcomingAssessment,
	lessons: LessonOnTimetable[],
	progress: readonly ClassProgressItem[],
): LessonOnTimetable | undefined {
	const named = soleChapter(assessment.title, progress);
	if (named) {
		const byChapter = lessons.find((item) => item.lesson.title === named.subjectMatter);
		if (byChapter) return byChapter;
	}
	const haystack = fold(assessment.title);
	const byTitle = lessons.filter((item) => {
		const title = fold(item.lesson.title);
		return title.length >= 4 && haystack.includes(title);
	});
	if (byTitle.length === 1) return byTitle[0];
	const bySubject = lessons.filter((item) => subjectsMatch(item.lesson.subject, assessment.subject));
	return bySubject.length === 1 ? bySubject[0] : undefined;
}

function openChapter(
	subject: string,
	progress: readonly ClassProgressItem[],
): ClassProgressItem | undefined {
	return progress.find((item) =>
		Boolean(item.subject)
		&& subjectsMatch(item.subject ?? "", subject)
		&& item.completedPercentage > 0
		&& item.completedPercentage < 100
	);
}

function soleChapter(
	title: string,
	progress: readonly ClassProgressItem[],
): ClassProgressItem | undefined {
	const haystack = fold(title);
	const hits = progress.filter((item) => {
		const name = fold(item.subjectMatter);
		return name.length >= 4 && haystack.includes(name);
	});
	const specific = hits.filter((item) => {
		const name = fold(item.subjectMatter);
		return !hits.some((other) => {
			const longer = fold(other.subjectMatter);
			return longer.length > name.length && longer.includes(name);
		});
	});
	return specific.length === 1 ? specific[0] : undefined;
}

function subjectNamedIn(
	title: string,
	progress: readonly ClassProgressItem[],
): string | undefined {
	const haystack = fold(title);
	const names = [...new Set(progress.map((item) => item.subject).filter((subject): subject is string => Boolean(subject)))];
	const hits = names.filter((subject) => {
		const name = fold(subject);
		return name.length >= 3 && haystack.includes(name);
	});
	return hits.length === 1 ? hits[0] : undefined;
}

function fold(text: string): string {
	return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
