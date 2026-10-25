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

/** Keeps the first occurrence of each choice. Returns undefined when the result is not a usable QCM. */
export function distinctMcqChoices(
	rawChoices: readonly unknown[],
	expectedAnswer: string,
): { choices: string[]; expectedAnswer: string } | undefined {
	const choices: string[] = [];
	const seen = new Set<string>();
	for (const choice of rawChoices) {
		if (typeof choice !== "string") continue;
		const trimmed = choice.trim();
		const key = normalizeAnswer(trimmed);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		choices.push(trimmed);
	}
	const expectedKey = normalizeAnswer(expectedAnswer);
	const match = choices.find((choice) => normalizeAnswer(choice) === expectedKey);
	if (!match || choices.length < 2) return undefined;
	return { choices, expectedAnswer: match };
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
