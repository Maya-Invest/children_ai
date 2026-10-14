import { displaySubjectLabel, subjectsMatch } from "./display-subject.ts";
import type {
	CurriculumLesson,
	ExerciseProposal,
	LearnerAcademicSnapshot,
	PracticeFocus,
	PracticeSessionPlan,
	PracticeTrackItem,
	PracticeTrackPlan,
	UpcomingAssessment,
	UpcomingAssessmentKind,
} from "./types.ts";
import { NOTHING_TO_PRACTICE_MESSAGE, PRACTICE_PLAN_VERSION } from "./types.ts";

export type QuestionTarget = {
	total: number;
	mcq: number;
	written: number;
};

export function questionTargetForMinutes(minutes: number): QuestionTarget {
	if (minutes <= 40) return { total: 3, mcq: 2, written: 1 };
	if (minutes <= 60) return { total: 4, mcq: 2, written: 2 };
	if (minutes <= 80) return { total: 5, mcq: 3, written: 2 };
	return { total: 6, mcq: 3, written: 3 };
}

export function exerciseProposalInstruction(proposals: ExerciseProposal[]): string {
	const lines = proposals.map((proposal, index) =>
		`${index + 1}. ${proposal.minutes} min, ${proposal.exerciseType}, difficulté ${proposal.difficulty}, objectif : ${proposal.objective}. ${proposal.promptHint}`,
	);
	const label = proposals.length > 1 ? "questions" : "question";
	return `Produis exactement ${proposals.length} ${label}, une par proposition, dans cet ordre. Deux types seulement : kind=mcq ou kind=written. Les choix d'un QCM sont courts et tous différents ; expectedAnswer recopie exactement l'un d'eux. ${lines.join(" ")}`;
}

export function formatPracticeDuration(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	if (hours <= 0) return `${rest} min`;
	if (rest === 0) return `${hours} h`;
	return `${hours} h ${rest}`;
}

export function emptySessionPlan(): PracticeSessionPlan {
	return {
		summary: NOTHING_TO_PRACTICE_MESSAGE,
		totalMinutes: 0,
		planVersion: PRACTICE_PLAN_VERSION,
		tracks: [emptyHomework("revision"), emptyHomework("homework")],
	};
}

export function composeSessionPlan(input: {
	snapshot: LearnerAcademicSnapshot;
	revision: { focus: PracticeFocus; lesson: CurriculumLesson; minutes: number } | null;
	revisions?: { focus: PracticeFocus; lesson: CurriculumLesson; minutes: number }[];
	homework: {
		focus: PracticeFocus;
		lesson: CurriculumLesson;
		assessment: UpcomingAssessment;
		minutes: number;
	} | null;
}): PracticeSessionPlan {
	const revisions = input.revisions?.length
		? input.revisions
		: input.revision
			? [input.revision]
			: [];
	if (revisions.length === 0 && !input.homework) return emptySessionPlan();
	const revision = revisions.length > 0
		? trackPlan("revision", revisions)
		: emptyHomework("revision");
	const homework = input.homework
		? trackPlan("homework", [input.homework], input.homework.assessment)
		: emptyHomework("homework");
	return {
		summary: sessionSummary(input.snapshot, revision, homework),
		totalMinutes: revision.minutes + homework.minutes,
		planVersion: PRACTICE_PLAN_VERSION,
		tracks: [revision, homework],
	};
}

function trackPlan(
	kind: PracticeTrackPlan["kind"],
	chosen: { focus: PracticeFocus; lesson: CurriculumLesson; minutes: number }[],
	assessment: UpcomingAssessment | null = null,
): PracticeTrackPlan {
	const items: PracticeTrackItem[] = chosen.map((item) => ({
		minutes: item.minutes,
		focus: item.focus,
		lesson: item.lesson,
		assessmentLabel: assessment ? assessmentLabel(assessment) : null,
	}));
	const first = items[0];
	return {
		kind,
		minutes: items.reduce((sum, item) => sum + item.minutes, 0),
		available: true,
		focus: first?.focus ?? null,
		lesson: first?.lesson ?? null,
		assessmentLabel: items.length === 1 ? (first?.assessmentLabel ?? null) : null,
		items,
	};
}

function emptyHomework(kind: PracticeTrackPlan["kind"]): PracticeTrackPlan {
	return {
		kind,
		minutes: 0,
		available: false,
		focus: null,
		lesson: null,
		assessmentLabel: null,
		items: [],
	};
}

function sessionSummary(
	snapshot: LearnerAcademicSnapshot,
	revision: PracticeTrackPlan,
	homework: PracticeTrackPlan,
): string {
	const budget = `Fin de journée : ${formatPracticeDuration(revision.minutes + homework.minutes)}.`;
	if (revision.available && revision.items.length > 1 && homework.available && homework.assessmentLabel) {
		return `${budget} ${formatPracticeDuration(revision.minutes)} pour ${subjectList(revision)}, d'après l'emploi du temps du jour, puis ${formatPracticeDuration(homework.minutes)} pour préparer ${homeworkPhrase(homework)}.`;
	}
	if (revision.available && revision.lesson && homework.available && homework.assessmentLabel) {
		const mark = markNote(snapshot, revision.lesson);
		return `${budget} ${formatPracticeDuration(revision.minutes)} pour préparer « ${revision.lesson.title} » (aujourd'hui et demain)${mark}, puis ${formatPracticeDuration(homework.minutes)} pour préparer ${homeworkPhrase(homework)}.`;
	}
	if (revision.available && revision.items.length > 1) {
		return `${budget} Les ${formatPracticeDuration(revision.minutes)} préparent ${subjectList(revision)}, d'après l'emploi du temps du jour.`;
	}
	if (revision.available && revision.lesson) {
		return `${budget} Les ${formatPracticeDuration(revision.minutes)} préparent « ${revision.lesson.title} », d'après les matières prévues aujourd'hui et demain.`;
	}
	if (homework.available && homework.assessmentLabel) {
		return `${budget} Les ${formatPracticeDuration(homework.minutes)} préparent ${homeworkPhrase(homework)}. Aucune leçon du programme n'est prévue aujourd'hui ni demain.`;
	}
	return NOTHING_TO_PRACTICE_MESSAGE;
}

function subjectList(track: PracticeTrackPlan): string {
	return track.items
		.map((item) => displaySubjectLabel(item.lesson.subject) || item.lesson.subject)
		.join(", ");
}

function homeworkPhrase(homework: PracticeTrackPlan): string {
	return homework.assessmentLabel ?? "le devoir à venir";
}

function assessmentLabel(assessment: UpcomingAssessment): string {
	const when = formatDue(assessment.dueAt);
	return `${assessmentArticle(assessment.kind)} « ${assessment.title} » du ${when}`;
}

function assessmentArticle(kind: UpcomingAssessmentKind): string {
	switch (kind) {
		case "homework":
			return "le devoir";
		case "exam":
			return "l'examen";
		case "quiz":
			return "l'interrogation";
		case "project":
			return "le projet";
		default:
			return "l'évaluation";
	}
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

function markNote(snapshot: LearnerAcademicSnapshot, lesson: CurriculumLesson): string {
	const lessonTitle = fold(lesson.title);
	const marks = [...snapshot.context.marks].sort(
		(left, right) => ratio(left.score, left.maxScore) - ratio(right.score, right.maxScore),
	);
	for (const mark of marks) {
		if (!subjectsMatch(mark.subject, lesson.subject)) continue;
		const title = fold(mark.title);
		if (!title.includes(lessonTitle) && !lessonTitle.includes(title)) continue;
		const subject = displaySubjectLabel(mark.subject) || displaySubjectLabel(lesson.subject);
		return ` (${mark.score}/${mark.maxScore} en ${subject})`;
	}
	return "";
}

function ratio(score: number, maxScore: number): number {
	if (maxScore <= 0) return 1;
	return score / maxScore;
}

function fold(text: string): string {
	return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}
