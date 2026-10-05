import { displaySubjectLabel, subjectsMatch } from "./display-subject.ts";
import {
	DEFAULT_PRACTICE_INTENT,
	isPracticeIntent,
	type CurriculumLesson,
	type LearnerAcademicSnapshot,
	type PracticeFocus,
	type PracticeIntent,
	type TimetableDay,
	type TimetableSlot,
	type UpcomingAssessment,
} from "./types.ts";

const DAY_ORDER: TimetableDay[] = [
	"sunday",
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
];

const DAY_LABELS: Record<TimetableDay, string> = {
	sunday: "dimanche",
	monday: "lundi",
	tuesday: "mardi",
	wednesday: "mercredi",
	thursday: "jeudi",
	friday: "vendredi",
	saturday: "samedi",
};

export type SuggestFocusOptions = {
	intent?: PracticeIntent;
	now?: Date;
};

function normalize(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase();
}

function matchLesson(
	text: string,
	gradeLessons: CurriculumLesson[],
): CurriculumLesson | undefined {
	const haystack = normalize(text);
	const byTitle = gradeLessons.find((lesson) =>
		haystack.includes(normalize(lesson.title)),
	);
	if (byTitle) return byTitle;

	const byContent = gradeLessons.find((lesson) =>
		lesson.contents.some((content) => haystack.includes(normalize(content))),
	);
	if (byContent) return byContent;

	return gradeLessons.find((lesson) => {
		const head = normalize(lesson.theme.title)
			.split(" ")
			.find((word) => word.length >= 5);
		return Boolean(head && haystack.includes(head));
	});
}

function lessonsForSubject(
	gradeLessons: CurriculumLesson[],
	subject: string,
): CurriculumLesson[] {
	if (!subject.trim()) return [];
	return gradeLessons.filter((lesson) => subjectsMatch(lesson.subject, subject));
}

function lessonsForText(
	gradeLessons: CurriculumLesson[],
	text: string,
): CurriculumLesson[] {
	const direct = lessonsForSubject(gradeLessons, text);
	if (direct.length > 0) return direct;
	const haystack = normalize(text);
	const subjects = [...new Set(gradeLessons.map((lesson) => lesson.subject))];
	for (const subject of subjects) {
		const label = normalize(displaySubjectLabel(subject));
		if (label && haystack.includes(label)) return lessonsForSubject(gradeLessons, subject);
	}
	return [];
}

function ratio(score: number, maxScore: number): number {
	if (maxScore <= 0) return 1;
	return score / maxScore;
}

function focusFor(
	lesson: CurriculumLesson,
	intent: PracticeIntent,
	rationale: string,
	brief: string,
): PracticeFocus {
	return {
		lessonId: lesson.id,
		subject: lesson.subject,
		rationale,
		brief,
		intent,
	};
}

function dateKey(value: string | Date): string {
	if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toISOString().slice(0, 10);
}

function formatDue(isoDate: string): string {
	const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
	if (!year || !month || !day) return isoDate;
	return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("fr-CI", {
		day: "numeric",
		month: "long",
		timeZone: "UTC",
	});
}

function assessmentPhrase(kind: UpcomingAssessment["kind"]): string {
	switch (kind) {
		case "homework":
			return "un devoir";
		case "exam":
			return "un examen";
		case "quiz":
			return "une interrogation";
		case "project":
			return "un projet";
		default:
			return "une évaluation";
	}
}

function joinLabels(items: string[]): string {
	const unique = [...new Set(items.map((item) => item.trim()).filter(Boolean))];
	if (unique.length === 0) return "";
	if (unique.length === 1) return unique[0] ?? "";
	return `${unique.slice(0, -1).join(", ")} et ${unique[unique.length - 1]}`;
}

function capitalize(text: string): string {
	return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function subjectLabel(subject: string, lesson: CurriculumLesson): string {
	return displaySubjectLabel(subject) || displaySubjectLabel(lesson.subject);
}

export function suggestFocus(
	snapshot: LearnerAcademicSnapshot,
	lessons: CurriculumLesson[],
	options: SuggestFocusOptions = {},
): PracticeFocus {
	const intent = isPracticeIntent(options.intent) ? options.intent : DEFAULT_PRACTICE_INTENT;
	const now = options.now ?? new Date();
	const gradeLessons = lessons
		.filter((lesson) => lesson.grade === snapshot.context.student.grade)
		.sort((a, b) => a.sequence - b.sequence);

	if (intent === "upcoming_work") {
		const upcoming = pickUpcoming(snapshot, gradeLessons, now);
		if (upcoming) return upcoming;
	}

	if (intent === "prepare_next_day") {
		const nextCourse = pickNextCourse(snapshot, gradeLessons, now);
		if (nextCourse) return nextCourse;
	}

	if (intent === "improve_results") {
		const fromMarks = pickWeakestMark(snapshot, gradeLessons, intent);
		if (fromMarks) return fromMarks;
	}

	const fromProgress = pickClassProgress(snapshot, gradeLessons, intent);
	if (fromProgress) return fromProgress;

	const fallback = gradeLessons[0];
	if (!fallback) {
		throw new Error("Aucune leçon officielle n'est disponible pour ce niveau.");
	}

	const subject = displaySubjectLabel(fallback.subject);
	return focusFor(
		fallback,
		intent,
		`Première leçon du programme officiel de ${snapshot.context.student.grade} (${subject}).`,
		`Voici la série d'exercices suggérée pour commencer le programme officiel de ${subject}.`,
	);
}

function pickWeakestMark(
	snapshot: LearnerAcademicSnapshot,
	gradeLessons: CurriculumLesson[],
	intent: PracticeIntent,
): PracticeFocus | undefined {
	const marks = [...snapshot.context.marks].sort(
		(a, b) => ratio(a.score, a.maxScore) - ratio(b.score, b.maxScore),
	);

	for (const mark of marks) {
		const pool = lessonsForSubject(gradeLessons, mark.subject);
		if (pool.length === 0) continue;
		const lesson = matchLesson(mark.title, pool);
		if (!lesson) continue;
		const subject = subjectLabel(mark.subject, lesson);
		return focusFor(
			lesson,
			intent,
			`Évaluation ${subject} « ${mark.title} » : ${mark.score}/${mark.maxScore}. Entraînement sur la leçon officielle « ${lesson.title} ».`,
			`Compte tenu de tes résultats en ${subject} (${mark.title} : ${mark.score}/${mark.maxScore}), voici la série d'exercices suggérée pour renforcer « ${lesson.title} ».`,
		);
	}

	return undefined;
}

function pickClassProgress(
	snapshot: LearnerAcademicSnapshot,
	gradeLessons: CurriculumLesson[],
	intent: PracticeIntent,
): PracticeFocus | undefined {
	const inProgress = [...snapshot.context.classProgress]
		.sort((a, b) => a.completedPercentage - b.completedPercentage)
		.filter((item) => item.completedPercentage < 100);

	for (const item of inProgress) {
		const pool = item.subject
			? lessonsForSubject(gradeLessons, item.subject)
			: gradeLessons;
		if (pool.length === 0) continue;
		const lesson = matchLesson(item.subjectMatter, pool);
		if (!lesson) continue;
		const brief =
			intent === "upcoming_work"
				? `Compte tenu du travail encore en cours sur « ${item.subjectMatter} » (${item.completedPercentage} %), voici la série d'exercices suggérée.`
				: intent === "prepare_next_day"
					? `L'emploi du temps ne précise pas encore le prochain cours. En attendant, voici la série d'exercices suggérée pour réviser « ${lesson.title} ».`
					: `La classe avance sur « ${item.subjectMatter} » (${item.completedPercentage} %). Voici la série d'exercices suggérée.`;
		return focusFor(
			lesson,
			intent,
			`La classe avance sur « ${item.subjectMatter} » (${item.completedPercentage} %) — leçon officielle « ${lesson.title} ».`,
			brief,
		);
	}

	return undefined;
}

function pickUpcoming(
	snapshot: LearnerAcademicSnapshot,
	gradeLessons: CurriculumLesson[],
	now: Date,
): PracticeFocus | undefined {
	const today = dateKey(now);
	const upcoming = [...(snapshot.context.upcomingAssessments ?? [])]
		.filter((item) => dateKey(item.dueAt) >= today)
		.sort((a, b) => dateKey(a.dueAt).localeCompare(dateKey(b.dueAt)));

	for (const item of upcoming) {
		const pool = lessonsForSubject(gradeLessons, item.subject);
		if (pool.length === 0) continue;
		const lesson = matchLesson(item.title, pool) ?? matchLesson(item.subject, pool);
		if (!lesson) continue;
		const subject = subjectLabel(item.subject, lesson);
		const when = formatDue(item.dueAt);
		return focusFor(
			lesson,
			"upcoming_work",
			`${assessmentPhrase(item.kind)} ${subject} « ${item.title} » prévu le ${when}. Entraînement sur « ${lesson.title} ».`,
			`Compte tenu que tu as bientôt ${assessmentPhrase(item.kind)} de ${subject} (« ${item.title} », le ${when}), voici la série d'exercices suggérée.`,
		);
	}

	return undefined;
}

function pickNextCourse(
	snapshot: LearnerAcademicSnapshot,
	gradeLessons: CurriculumLesson[],
	now: Date,
): PracticeFocus | undefined {
	const timetable = snapshot.context.timetable ?? [];
	if (timetable.length === 0) return undefined;

	for (let offset = 1; offset <= 7; offset += 1) {
		const day = addUtcDays(now, offset);
		const dayId = DAY_ORDER[day.getUTCDay()];
		if (!dayId) continue;
		const slots = timetable
			.filter((slot) => slot.dayOfWeek === dayId && slot.kind === "lesson")
			.sort((a, b) => a.startTime.localeCompare(b.startTime));
		if (slots.length === 0) continue;

		const matched = slots.flatMap((slot) => {
			const pool = lessonsForText(gradeLessons, slot.title);
			const lesson = matchLesson(slot.title, pool);
			return lesson ? [{ slot, lesson }] : [];
		});
		if (matched.length === 0) continue;

		const chosen = chooseCourseLesson(snapshot, matched);
		const when =
			offset === 1
				? "Demain"
				: capitalize(DAY_LABELS[dayId]);
		const courses = joinLabels(slots.map((slot) => slot.title));
		return focusFor(
			chosen.lesson,
			"prepare_next_day",
			`Cours du ${DAY_LABELS[dayId]} : ${chosen.slot.title}. Révision de « ${chosen.lesson.title} ».`,
			`${when}, tu as ${courses}. Voici la série d'exercices suggérée pour réviser « ${chosen.lesson.title} ».`,
		);
	}

	return undefined;
}

function chooseCourseLesson(
	snapshot: LearnerAcademicSnapshot,
	matched: { slot: TimetableSlot; lesson: CurriculumLesson }[],
): { slot: TimetableSlot; lesson: CurriculumLesson } {
	const first = matched[0];
	if (!first || matched.length === 1) return first!;

	const weakness = new Map<string, number>();
	for (const mark of snapshot.context.marks) {
		const key = normalize(displaySubjectLabel(mark.subject));
		const value = ratio(mark.score, mark.maxScore);
		const current = weakness.get(key);
		if (current === undefined || value < current) weakness.set(key, value);
	}

	return [...matched].sort((left, right) => {
		const leftScore = weakness.get(normalize(displaySubjectLabel(left.lesson.subject))) ?? 1;
		const rightScore = weakness.get(normalize(displaySubjectLabel(right.lesson.subject))) ?? 1;
		if (leftScore !== rightScore) return leftScore - rightScore;
		return left.slot.startTime.localeCompare(right.slot.startTime);
	})[0] ?? first;
}

function addUtcDays(date: Date, days: number): Date {
	const next = new Date(date.getTime());
	if (Number.isNaN(next.getTime())) return next;
	next.setUTCDate(next.getUTCDate() + days);
	return next;
}
