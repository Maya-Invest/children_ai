import type { ExerciseSet } from './types';

export type PracticeSummary = {
	seriesCount: number;
	submittedCount: number;
	openCount: number;
	pendingCorrectionCount: number;
	questionsWorked: number;
	questionsOpen: number;
	successPercent: number | null;
	lastPracticeAt: string | null;
};

export function summarizePractice(
	history: ExerciseSet[] | undefined,
	current: ExerciseSet | null | undefined,
): PracticeSummary {
	const byId = new Map<string, ExerciseSet>();
	for (const set of history ?? []) byId.set(set.id, set);
	if (current) byId.set(current.id, current);
	const sets = [...byId.values()];
	const submitted = sets.filter((set) => Boolean(set.submittedAt));
	const open = sets.filter((set) => !set.submittedAt);
	const pending = submitted.filter((set) => !set.correctionReleasedAt);
	const scored = submitted.filter((set) => Boolean(set.correctionReleasedAt && set.score));

	let correct = 0;
	let total = 0;
	for (const set of scored) {
		correct += set.score?.correct ?? 0;
		total += set.score?.total ?? 0;
	}

	const lastPracticeAt =
		[...sets]
			.map((set) => set.submittedAt || set.generatedAt)
			.filter(Boolean)
			.sort()
			.at(-1) ?? null;

	return {
		seriesCount: sets.length,
		submittedCount: submitted.length,
		openCount: open.length,
		pendingCorrectionCount: pending.length,
		questionsWorked: submitted.reduce(
			(sum, set) => sum + (set.score?.total ?? set.questions.length),
			0,
		),
		questionsOpen: open.reduce((sum, set) => sum + set.questions.length, 0),
		successPercent: total > 0 ? Math.round((correct / total) * 100) : null,
		lastPracticeAt,
	};
}
