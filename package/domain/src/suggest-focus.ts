import { displaySubjectLabel, subjectsMatch } from "./display-subject.ts";
import type {
	CurriculumLesson,
	LearnerAcademicSnapshot,
	PracticeFocus,
} from "./types.ts";

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
	return byContent;
}

function lessonsForSubject(
	gradeLessons: CurriculumLesson[],
	subject: string,
): CurriculumLesson[] {
	if (!subject.trim()) return [];
	return gradeLessons.filter((lesson) => subjectsMatch(lesson.subject, subject));
}

function ratio(score: number, maxScore: number): number {
	if (maxScore <= 0) return 1;
	return score / maxScore;
}

function focusFor(
	lesson: CurriculumLesson,
	rationale: string,
): PracticeFocus {
	return {
		lessonId: lesson.id,
		subject: lesson.subject,
		rationale,
	};
}

export function suggestFocus(
	snapshot: LearnerAcademicSnapshot,
	lessons: CurriculumLesson[],
): PracticeFocus {
	const gradeLessons = lessons
		.filter((lesson) => lesson.grade === snapshot.context.student.grade)
		.sort((a, b) => a.sequence - b.sequence);

	const marks = [...snapshot.context.marks].sort(
		(a, b) => ratio(a.score, a.maxScore) - ratio(b.score, b.maxScore),
	);

	for (const mark of marks) {
		const pool = lessonsForSubject(gradeLessons, mark.subject);
		if (pool.length === 0) continue;
		const lesson = matchLesson(mark.title, pool);
		if (!lesson) continue;
		const subject = displaySubjectLabel(mark.subject) || displaySubjectLabel(lesson.subject);
		return focusFor(
			lesson,
			`Évaluation ${subject} « ${mark.title} » : ${mark.score}/${mark.maxScore}. Entraînement sur la leçon officielle « ${lesson.title} ».`,
		);
	}

	const inProgress = [...snapshot.context.classProgress].sort(
		(a, b) => a.completedPercentage - b.completedPercentage,
	).filter((item) => item.completedPercentage < 100);

	for (const item of inProgress) {
		const pool = item.subject
			? lessonsForSubject(gradeLessons, item.subject)
			: gradeLessons;
		if (pool.length === 0) continue;
		const lesson = matchLesson(item.subjectMatter, pool);
		if (!lesson) continue;
		return focusFor(
			lesson,
			`La classe avance sur « ${item.subjectMatter} » (${item.completedPercentage} %) — leçon officielle « ${lesson.title} ».`,
		);
	}

	const fallback = gradeLessons[0];
	if (!fallback) {
		throw new Error("Aucune leçon officielle n'est disponible pour ce niveau.");
	}

	return focusFor(
		fallback,
		`Première leçon du programme officiel de ${snapshot.context.student.grade} (${displaySubjectLabel(fallback.subject)}).`,
	);
}
