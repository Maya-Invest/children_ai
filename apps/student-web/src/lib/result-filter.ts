export type ResultFilter = "all" | "correct" | "incorrect" | "unanswered";

export function filterByResult<T extends { answered?: boolean; correct?: boolean }>(
	items: T[],
	filter: ResultFilter,
): T[] {
	if (filter === "correct") return items.filter((item) => item.correct === true);
	if (filter === "incorrect") return items.filter((item) => item.correct === false);
	if (filter === "unanswered") return items.filter((item) => item.answered === false);
	return items;
}

export function resultCounts(items: Array<{ answered?: boolean; correct?: boolean }>): {
	correct: number;
	incorrect: number;
	unanswered: number;
	total: number;
} {
	let correct = 0;
	let incorrect = 0;
	let unanswered = 0;
	for (const item of items) {
		if (item.correct === true) correct += 1;
		else if (item.correct === false) incorrect += 1;
		else if (item.answered === false) unanswered += 1;
	}
	return { correct, incorrect, unanswered, total: items.length };
}
