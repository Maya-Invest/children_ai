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

function ratio(score: number, maxScore: number): number {
	if (maxScore <= 0) return 1;
	return score / maxScore;
}

export function suggestFocus(
	snapshot: LearnerAcademicSnapshot,
	lessons: CurriculumLesson[],
): PracticeFocus {
	const gradeLessons = lessons
		.filter((lesson) => lesson.grade === snapshot.context.student.grade)
		.sort((a, b) => a.sequence - b.sequence);

	const weakest = [...snapshot.context.marks].sort(
		(a, b) => ratio(a.score, a.maxScore) - ratio(b.score, b.maxScore),
	)[0];

	if (weakest) {
		const lesson = matchLesson(weakest.title, gradeLessons);
		if (lesson) {
			return {
				lessonId: lesson.id,
				rationale: `Évaluation MATH « ${weakest.title} » : ${weakest.score}/${weakest.maxScore}. Entraînement sur la leçon officielle « ${lesson.title} ».`,
			};
		}
	}

	const inProgress = [...snapshot.context.classProgress].sort(
		(a, b) => a.completedPercentage - b.completedPercentage,
	).find((item) => item.completedPercentage < 100);

	if (inProgress) {
		const lesson = matchLesson(inProgress.subjectMatter, gradeLessons);
		if (lesson) {
			return {
				lessonId: lesson.id,
				rationale: `La classe avance sur « ${inProgress.subjectMatter} » (${inProgress.completedPercentage} %) — leçon officielle « ${lesson.title} ».`,
			};
		}
	}

	const fallback = gradeLessons[0];
	if (!fallback) {
		throw new Error("Aucune leçon officielle n'est disponible pour ce niveau.");
	}

	return {
		lessonId: fallback.id,
		rationale: `Première leçon du programme officiel de ${snapshot.context.student.grade} (MATH).`,
	};
}
