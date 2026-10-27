import { displaySubjectLabel } from "./display-subject.ts";
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

/** About one question per 3 to 4 minutes, as a single exact count. */
export function questionCountForMinutes(minutes: number): number {
	if (!Number.isFinite(minutes) || minutes <= 0) return 1;
	return Math.max(1, Math.round(minutes / 3.5));
}

export function plannedQuestionCount(proposals: readonly ExerciseProposal[]): number {
	return proposals.reduce((total, proposal) => total + questionCountForMinutes(proposal.minutes), 0);
}

export function exerciseLengthInstruction(proposal: ExerciseProposal): string {
	const count = questionCountForMinutes(proposal.minutes);
	const label = count > 1 ? "questions" : "question";
	return `Produis exactement ${count} ${label} pour cette proposition de ${proposal.minutes} minutes.`;
}

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
	homeworks?: {
		focus: PracticeFocus;
		lesson: CurriculumLesson;
		assessment: UpcomingAssessment;
		minutes: number;
	}[];
}): PracticeSessionPlan {
	const revisions = input.revisions?.length
		? input.revisions
		: input.revision
			? [input.revision]
			: [];
	const homeworks = input.homeworks?.length
		? input.homeworks
		: input.homework
			? [input.homework]
			: [];
	if (revisions.length === 0 && homeworks.length === 0) return emptySessionPlan();
	const revision = revisions.length > 0
		? trackPlan("revision", revisions)
		: emptyHomework("revision");
	const homework = homeworks.length > 0
		? trackPlan("homework", homeworks, homeworks.length === 1 ? homeworks[0]?.assessment ?? null : null)
		: emptyHomework("homework");
	return withSessionSummary({
		summary: "",
		totalMinutes: revision.minutes + homework.minutes,
		planVersion: PRACTICE_PLAN_VERSION,
		tracks: [revision, homework],
	});
}

/** Rebuilds the parent sentence from the lessons already on the plan. */
export function withSessionSummary(plan: PracticeSessionPlan): PracticeSessionPlan {
	const revision = plan.tracks.find((track) => track.kind === "revision");
	const homework = plan.tracks.find((track) => track.kind === "homework");
	if (!revision && !homework) return plan;
	return {
		...plan,
		summary: sessionSummary(
			revision ?? emptyHomework("revision"),
			homework ?? emptyHomework("homework"),
		),
	};
}

function trackPlan(
	kind: PracticeTrackPlan["kind"],
	chosen: {
		focus: PracticeFocus;
		lesson: CurriculumLesson;
		minutes: number;
		assessment?: UpcomingAssessment;
	}[],
	assessment: UpcomingAssessment | null = null,
): PracticeTrackPlan {
	const items: PracticeTrackItem[] = chosen.map((item) => ({
		minutes: item.minutes,
		focus: item.focus,
		lesson: item.lesson,
		assessmentLabel: item.assessment
			? assessmentLabel(item.assessment)
			: assessment
				? assessmentLabel(assessment)
				: null,
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

function sessionSummary(revision: PracticeTrackPlan, homework: PracticeTrackPlan): string {
	const revisionText = revision.available ? revisionSentence(revision) : "";
	const homeworkText = homework.available && homework.assessmentLabel
		? preparationSentence(homework.assessmentLabel, revisionText !== "")
		: "";
	if (revisionText && homeworkText) return `${revisionText} ${homeworkText}`;
	if (revisionText) return revisionText;
	if (homeworkText) return `Aucun cours n'est prévu aujourd'hui. ${homeworkText}`;
	return NOTHING_TO_PRACTICE_MESSAGE;
}

function revisionSentence(revision: PracticeTrackPlan): string {
	const lessons = revisionLessons(revision);
	const first = lessons[0];
	if (!first) return "";
	const head = `la leçon ${deTitle(first.title)} en ${subjectAfterEn(first.subject)}`;
	const rest = lessons.slice(1).map((lesson) => `${deTitle(lesson.title)} en ${subjectAfterEn(lesson.subject)}`);
	if (rest.length === 0) return `La révision du jour reprend ${head}.`;
	return `La révision du jour reprend ${head}, ${joinFrench(rest)}.`;
}

function revisionLessons(revision: PracticeTrackPlan): { title: string; subject: string }[] {
	if (revision.items.length > 0) {
		return revision.items.map((item) => ({
			title: item.lesson.title,
			subject: item.lesson.subject,
		}));
	}
	if (!revision.lesson) return [];
	return [{ title: revision.lesson.title, subject: revision.lesson.subject }];
}

function deTitle(title: string): string {
	const prose = lowerFirst(title.trim());
	if (prose.startsWith("le ")) return `du ${prose.slice(3)}`;
	if (prose.startsWith("les ")) return `des ${prose.slice(4)}`;
	if (/^(la |l')/i.test(prose)) return `de ${prose}`;
	if (/^[aeiouàâäéèêëîïôöùûüy]/i.test(prose)) return `d'${prose}`;
	return `de ${prose}`;
}

function subjectAfterEn(subject: string): string {
	const label = displaySubjectLabel(subject) || subject;
	if (/^[A-Z0-9]{2,6}$/.test(label)) return label;
	return label.toLocaleLowerCase("fr");
}

function joinFrench(parts: string[]): string {
	if (parts.length <= 1) return parts[0] ?? "";
	if (parts.length === 2) return `${parts[0]} et ${parts[1]}`;
	return `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}`;
}

function preparationSentence(label: string, also: boolean): string {
	const read = readAssessment(label);
	const verb = also ? "est aussi à préparer" : "est à préparer";
	if (!read) {
		const plain = label.replace(/[«»]/g, "").replace(/\s+/g, " ").trim();
		return `${capitalize(plain)} ${verb}.`;
	}
	const named = `${read.kind} intitulé${assessmentTitleGender(read.kind)} ${read.title}`;
	return `${capitalize(named)} ${verb} pour le ${read.when}.`;
}

function readAssessment(label: string): { kind: string; title: string; when: string } | null {
	const matched = label.match(/^(.*?) « (.+) » du (.+)$/);
	if (!matched?.[1] || !matched[2] || !matched[3]) return null;
	return {
		kind: matched[1].trim(),
		title: lowerFirst(matched[2].trim()),
		when: matched[3].trim(),
	};
}

function assessmentTitleGender(kind: string): string {
	if (kind.startsWith("l'interrogation") || kind.startsWith("l'évaluation")) return "e";
	return "";
}

function lowerFirst(text: string): string {
	return text.charAt(0).toLocaleLowerCase("fr") + text.slice(1);
}

function capitalize(text: string): string {
	return text.charAt(0).toLocaleUpperCase("fr") + text.slice(1);
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

