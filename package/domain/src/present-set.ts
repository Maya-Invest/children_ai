import { isAnswerCorrect, normalizeAnswer, questionKind } from "./score-set.ts";
import type { ExerciseQuestion, ExerciseSet } from "./types.ts";

export type ExerciseAudience = "student" | "guardian";

export function presentExerciseSet(
	set: ExerciseSet,
	audience: ExerciseAudience,
): ExerciseSet {
	const reveal =
		audience === "guardian"
		|| Boolean(set.submittedAt && set.correctionReleasedAt);
	const answers = new Map(
		(set.answers ?? []).map((answer) => [answer.questionId, answer.value]),
	);
	const hasCorrection = set.questions.every((question) =>
		Boolean(normalizeAnswer(question.expectedAnswer ?? ""))
	);
	const hasAnyAnswer = Boolean(
		set.submittedAt
		&& set.questions.some((question) =>
			Boolean(normalizeAnswer(answers.get(question.id) ?? ""))
		),
	);
	return {
		...set,
		questions: set.questions.map((question) =>
			presentQuestion(question, reveal, set.submittedAt ? answers.get(question.id) ?? "" : undefined),
		),
		score: reveal && hasCorrection && hasAnyAnswer ? set.score : undefined,
		correctionReleasedAt: set.correctionReleasedAt ?? null,
	};
}

function presentQuestion(
	question: ExerciseQuestion,
	reveal: boolean,
	givenAnswer: string | undefined,
): ExerciseQuestion {
	const presented: ExerciseQuestion = {
		id: question.id,
		prompt: question.prompt,
		kind: questionKind(question.kind),
	};
	if (question.choices?.length) {
		presented.choices = question.choices;
	}
	if (reveal && question.expectedAnswer) {
		presented.expectedAnswer = question.expectedAnswer;
	}
	if (givenAnswer !== undefined) {
		presented.answered = Boolean(normalizeAnswer(givenAnswer));
	}
	if (reveal && presented.answered && question.expectedAnswer && givenAnswer !== undefined) {
		presented.correct = isAnswerCorrect(question, givenAnswer);
	}
	return presented;
}
