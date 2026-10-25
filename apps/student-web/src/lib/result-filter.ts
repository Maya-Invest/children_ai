export type ResultFilter = "all" | "correct" | "incorrect" | "unanswered";

const FILTER_SLUGS = {
	correct: "justes",
	incorrect: "fausses",
	unanswered: "non-repondu",
} as const;

export function filterFromSlug(slug: string | undefined): ResultFilter | null {
	if (slug === FILTER_SLUGS.correct) return "correct";
	if (slug === FILTER_SLUGS.incorrect) return "incorrect";
	if (slug === FILTER_SLUGS.unanswered) return "unanswered";
	return null;
}

export function filterPath(base: string, filter: ResultFilter): string {
	if (filter === "all") return base;
	return `${base}/filtre/${FILTER_SLUGS[filter]}`;
}

const STUDENT_SET = /^\/app\/sets\/[^/]+(?:\/filtre\/([^/]+))?\/?$/;
const PARENT_SET = /^\/parent\/children\/[^/]+\/sets\/[^/]+(?:\/filtre\/([^/]+))?\/?$/;

export function setFilterFromPath(path: string): ResultFilter | null {
	const match = path.match(STUDENT_SET) ?? path.match(PARENT_SET);
	if (!match) return null;
	if (!match[1]) return "all";
	return filterFromSlug(match[1]);
}

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
