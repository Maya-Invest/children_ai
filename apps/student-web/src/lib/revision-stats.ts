import type { ExerciseSet, PracticeTrackKind } from './types';

export type ScoreSlice = {
	correct: number;
	total: number;
	percent: number | null;
};

export type SeriesScoreRow = {
	id: string;
	track: PracticeTrackKind;
	at: string;
	lessonTitle: string | null;
	subjectLabel: string | null;
	scored: boolean;
	correct: number;
	total: number;
	percent: number | null;
};

export type ScoreBreakdown = {
	hasScored: boolean;
	overall: ScoreSlice;
	byTrack: Record<PracticeTrackKind, ScoreSlice>;
	byKind: { mcq: ScoreSlice; written: ScoreSlice };
	series: SeriesScoreRow[];
};

export type LessonScoreLabel = {
	lessonId: string;
	lessonTitle: string;
	subjectLabel: string | null;
};

const emptySlice = (): ScoreSlice => ({ correct: 0, total: 0, percent: null });

function slice(correct: number, total: number): ScoreSlice {
	return {
		correct,
		total,
		percent: total > 0 ? Math.round((correct / total) * 100) : null,
	};
}

function isScored(set: ExerciseSet): boolean {
	return Boolean(set.correctionReleasedAt && set.score);
}

function trackOf(set: ExerciseSet): PracticeTrackKind {
	return set.track === 'homework' ? 'homework' : 'revision';
}

function questionKind(kind: string | undefined): 'mcq' | 'written' {
	return kind === 'mcq' ? 'mcq' : 'written';
}

export type PracticeSummary = {
	seriesCount: number;
	submittedCount: number;
	openCount: number;
	pendingCorrectionCount: number;
	questionsWorked: number;
	questionsOpen: number;
	scoredCorrect: number;
	scoredTotal: number;
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
		scoredCorrect: correct,
		scoredTotal: total,
		successPercent: total > 0 ? Math.round((correct / total) * 100) : null,
		lastPracticeAt,
	};
}

export function breakdownScore(
	sets: ExerciseSet[],
	lessons: LessonScoreLabel[] = [],
): ScoreBreakdown {
	const labels = new Map(lessons.map((lesson) => [lesson.lessonId, lesson]));
	const tracks = { revision: emptySlice(), homework: emptySlice() };
	const kinds = { mcq: emptySlice(), written: emptySlice() };
	const trackTotals = {
		revision: { correct: 0, total: 0 },
		homework: { correct: 0, total: 0 },
	};
	const kindTotals = {
		mcq: { correct: 0, total: 0 },
		written: { correct: 0, total: 0 },
	};
	let correct = 0;
	let total = 0;

	for (const set of sets) {
		if (!isScored(set) || !set.score) continue;
		const track = trackOf(set);
		trackTotals[track].correct += set.score.correct;
		trackTotals[track].total += set.score.total;
		correct += set.score.correct;
		total += set.score.total;
		for (const question of set.questions) {
			const kind = questionKind(question.kind);
			kindTotals[kind].total += 1;
			if (question.correct) kindTotals[kind].correct += 1;
		}
	}

	tracks.revision = slice(trackTotals.revision.correct, trackTotals.revision.total);
	tracks.homework = slice(trackTotals.homework.correct, trackTotals.homework.total);
	kinds.mcq = slice(kindTotals.mcq.correct, kindTotals.mcq.total);
	kinds.written = slice(kindTotals.written.correct, kindTotals.written.total);

	const series = [...sets]
		.sort((left, right) => seriesDate(right).localeCompare(seriesDate(left)))
		.map((set) => {
			const label = labels.get(set.lessonId);
			const scored = isScored(set);
			const rowTotal = scored ? (set.score?.total ?? 0) : 0;
			const rowCorrect = scored ? (set.score?.correct ?? 0) : 0;
			return {
				id: set.id,
				track: trackOf(set),
				at: seriesDate(set),
				lessonTitle: label?.lessonTitle ?? null,
				subjectLabel: label?.subjectLabel ?? null,
				scored,
				correct: rowCorrect,
				total: rowTotal,
				percent: scored ? slice(rowCorrect, rowTotal).percent : null,
			};
		});

	return {
		hasScored: total > 0,
		overall: slice(correct, total),
		byTrack: tracks,
		byKind: kinds,
		series,
	};
}

function seriesDate(set: ExerciseSet): string {
	return set.submittedAt || set.generatedAt;
}
