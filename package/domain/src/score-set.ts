import type {
	ExerciseQuestion,
	ExerciseScore,
	ExerciseSet,
	QuestionKind,
	StudentAnswer,
} from "./types.ts";

export function questionKind(kind: string | undefined): QuestionKind {
	return kind === "mcq" ? "mcq" : "written";
}

export function normalizeAnswer(value: string): string {
	return value
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim()
		.replace(/\s+/g, " ");
}

export function isAnswerCorrect(question: ExerciseQuestion, value: string): boolean {
	const expected = normalizeAnswer(question.expectedAnswer ?? "");
	const given = normalizeAnswer(value);
	if (!expected || !given) return false;
	if (questionKind(question.kind) === "mcq") return given === expected;
	if (given === expected) return true;
	if (expected.length >= 3 && (given.includes(expected) || expected.includes(given))) {
		return true;
	}
	return false;
}

export function scoreExerciseSet(
	set: ExerciseSet,
	answers: StudentAnswer[],
): ExerciseScore {
	const byId = new Map(answers.map((answer) => [answer.questionId, answer.value]));
	let correct = 0;
	for (const question of set.questions) {
		if (isAnswerCorrect(question, byId.get(question.id) ?? "")) {
			correct += 1;
		}
	}
	return { correct, total: set.questions.length };
}
