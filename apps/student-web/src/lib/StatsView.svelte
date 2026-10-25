<script lang="ts">
	import { exerciseStatusLabel } from '$lib/exercise-status';
	import {
		breakdownScore,
		summarizePractice,
		type ScoreSlice,
		type SeriesScoreRow,
	} from '$lib/revision-stats';
	import { formatMarkDate } from '$lib/timetable';
	import type { ExerciseSet, GuardianChildView, HomePayload, PracticeTrackKind } from '$lib/types';

	let { home, backHref }: { home: HomePayload & { child?: GuardianChildView }; backHref: string } = $props();

	let student = $derived(home.student);
	let isGuardian = $derived(home.actor?.role === 'guardian');
	let practice = $derived(summarizePractice(home.history, home.currentSet));
	let series = $derived.by(() => {
		const seen: Record<string, ExerciseSet> = {};
		for (const set of home.history ?? []) seen[set.id] = set;
		if (home.currentSet) seen[home.currentSet.id] = home.currentSet;
		return Object.values(seen);
	});
	let lessons = $derived(
		(home.session?.tracks ?? []).flatMap((track) =>
			(track.items ?? []).map((item) => ({
				lessonId: item.lessonId,
				lessonTitle: item.lessonTitle,
				subjectLabel: item.subjectLabel,
			})),
		),
	);
	let breakdown = $derived(breakdownScore(series, lessons));
	let incorrect = $derived(Math.max(0, breakdown.overall.total - breakdown.overall.correct));
	let correctShare = $derived(breakdown.overall.percent ?? 0);
	let scoreLabel = $derived(percentLabel(breakdown.overall));
	let scoredSeries = $derived(breakdown.series.filter((row) => row.scored).length);
	let waitingSentence = 'Le détail apparaît à l’ouverture du corrigé.';
	let reading = $derived.by(() => {
		if (!breakdown.hasScored) return waitingSentence;
		const pct = breakdown.overall.percent ?? 0;
		const answers =
			breakdown.overall.correct === 1
				? '1 bonne réponse'
				: `${breakdown.overall.correct} bonnes réponses`;
		const questions =
			breakdown.overall.total === 1
				? '1 question corrigée'
				: `${breakdown.overall.total} questions corrigées`;
		const base = `${answers} sur ${questions}.`;
		if (pct >= 80) return `${base} Le niveau est solide.`;
		if (pct >= 50) return `${base} Une partie des réponses est encore à revoir.`;
		return `${base} Le découpage par piste et par format montre où reprendre.`;
	});

	function percentLabel(part: ScoreSlice) {
		return part.percent !== null ? `${part.percent} %` : '0 %';
	}

	function countLabel(part: ScoreSlice) {
		return `${part.correct} / ${part.total}`;
	}

	function barClass(percent: number) {
		if (percent >= 75) return 'bg-forest';
		if (percent >= 50) return 'bg-gold';
		return 'bg-clay';
	}

	function trackLabel(track: PracticeTrackKind) {
		return track === 'homework' ? 'Devoir' : 'Révision';
	}

	function statusOf(set: ExerciseSet) {
		return exerciseStatusLabel(set, {
			audience: isGuardian ? 'guardian' : 'student',
			firstName: student.firstName,
		});
	}

	function setOf(id: string) {
		return series.find((set) => set.id === id);
	}
</script>

{#snippet meter(percent: number)}
	<div class="h-3 overflow-hidden rounded-full bg-ink/10">
		<div class="stat-grow h-full rounded-full {barClass(percent)}" style:width="{percent}%"></div>
	</div>
{/snippet}

{#snippet sliceRow(label: string, part: ScoreSlice)}
	<li>
		<div class="flex items-baseline justify-between gap-3">
			<p class="font-extrabold text-ink">{label}</p>
			<p class="text-sm font-extrabold text-forest">{percentLabel(part)}</p>
		</div>
		<div class="mt-2">{@render meter(part.percent ?? 0)}</div>
		<p class="mt-2 text-sm font-bold text-ink/60">{countLabel(part)}</p>
	</li>
{/snippet}

<p class="mb-4">
	<a class="text-sm font-bold text-forest" href={backHref}>← Retour</a>
</p>

<section class="rounded-[2rem] bg-paper p-6 shadow-card sm:p-10">
	<p class="text-sm font-extrabold uppercase tracking-[0.18em] text-forest">Statistiques</p>
	<h1 class="mt-2 text-4xl font-extrabold text-ink">
		{isGuardian ? `Les résultats de ${student.firstName}` : 'Tes résultats'}
	</h1>
	<p class="mt-3 max-w-2xl text-lg text-ink/70">
		{isGuardian
			? `Le découpage du score des séries de ${student.firstName}.`
			: 'Le découpage du score de tes séries.'}
	</p>

	<div class="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
		<div class="rounded-2xl bg-cream p-4">
			<p class="text-sm font-bold text-ink/50">Score</p>
			<p class="mt-1 text-xl font-extrabold">{breakdown.hasScored ? scoreLabel : '—'}</p>
			<p class="mt-1 text-sm font-bold text-ink/60">sur les corrigés</p>
		</div>
		<div class="rounded-2xl bg-cream p-4">
			<p class="text-sm font-bold text-ink/50">Bonnes réponses</p>
			<p class="mt-1 text-xl font-extrabold">
				{breakdown.hasScored ? countLabel(breakdown.overall) : '—'}
			</p>
			<p class="mt-1 text-sm font-bold text-ink/60">
				{incorrect > 0 ? `${incorrect} à revoir` : 'questions corrigées'}
			</p>
		</div>
		<div class="rounded-2xl bg-cream p-4">
			<p class="text-sm font-bold text-ink/50">Séries</p>
			<p class="mt-1 text-xl font-extrabold">{scoredSeries}</p>
			<p class="mt-1 text-sm font-bold text-ink/60">
				{practice.pendingCorrectionCount > 0
					? `${practice.pendingCorrectionCount} en attente`
					: 'corrigées'}
			</p>
		</div>
		<div class="rounded-2xl bg-cream p-4">
			<p class="text-sm font-bold text-ink/50">Questions</p>
			<p class="mt-1 text-xl font-extrabold">{practice.questionsWorked}</p>
			<p class="mt-1 text-sm font-bold text-ink/60">
				{practice.questionsOpen > 0 ? `${practice.questionsOpen} en cours` : 'travaillées'}
			</p>
		</div>
	</div>

	<div class="mt-6 grid gap-4 lg:grid-cols-[16rem_1fr]">
		<div class="flex flex-col items-center justify-center rounded-2xl bg-cream p-6">
			{#if breakdown.hasScored}
				<div class="relative h-40 w-40">
					<div
						class="h-full w-full rounded-full"
						style:background="conic-gradient(#1F6F62 0% {correctShare}%, #E06C3A {correctShare}% 100%)"
					></div>
					<div class="absolute inset-[1.15rem] flex items-center justify-center rounded-full bg-cream">
						<p class="text-center text-3xl font-extrabold text-ink">{scoreLabel}</p>
					</div>
				</div>
				<p class="mt-4 text-sm font-extrabold text-ink/50">Répartition du score</p>
			{:else}
				<p class="text-center text-sm font-bold text-ink/60">{waitingSentence}</p>
			{/if}
		</div>
		<div class="rounded-2xl bg-cream p-6">
			<p class="text-xs font-extrabold uppercase tracking-[0.16em] text-forest">Lecture</p>
			<p class="mt-3 text-lg font-bold text-ink/80">{reading}</p>
			{#if breakdown.hasScored}
				<ul class="mt-5 space-y-3">
					<li class="flex items-center justify-between gap-3 text-sm font-extrabold">
						<span class="flex items-center gap-2 text-ink">
							<span class="h-3 w-3 rounded-full bg-forest"></span>
							Bonnes réponses
						</span>
						<span>{breakdown.overall.correct}</span>
					</li>
					<li class="flex items-center justify-between gap-3 text-sm font-extrabold">
						<span class="flex items-center gap-2 text-ink">
							<span class="h-3 w-3 rounded-full bg-clay"></span>
							À revoir
						</span>
						<span>{incorrect}</span>
					</li>
				</ul>
			{/if}
		</div>
	</div>

	<div class="mt-6 rounded-2xl bg-forest/[0.06] p-4 ring-1 ring-forest/10 sm:p-5">
		<p class="text-xs font-extrabold uppercase tracking-[0.16em] text-forest">Par piste</p>
		{#if breakdown.hasScored}
			<ul class="mt-4 space-y-4">
				{@render sliceRow('Révision', breakdown.byTrack.revision)}
				{@render sliceRow('Devoir', breakdown.byTrack.homework)}
			</ul>
		{:else}
			<p class="mt-4 text-sm font-bold text-ink/60">{waitingSentence}</p>
		{/if}
	</div>

	<div class="mt-6 rounded-2xl bg-forest/[0.06] p-4 ring-1 ring-forest/10 sm:p-5">
		<p class="text-xs font-extrabold uppercase tracking-[0.16em] text-forest">Par format</p>
		{#if breakdown.hasScored}
			<ul class="mt-4 space-y-4">
				{@render sliceRow('QCM', breakdown.byKind.mcq)}
				{@render sliceRow('Réponse rédigée', breakdown.byKind.written)}
			</ul>
		{:else}
			<p class="mt-4 text-sm font-bold text-ink/60">{waitingSentence}</p>
		{/if}
	</div>

	<div class="mt-6 rounded-2xl bg-forest/[0.06] p-4 ring-1 ring-forest/10 sm:p-5">
		<p class="text-xs font-extrabold uppercase tracking-[0.16em] text-forest">Par série</p>
		{#if breakdown.series.length === 0}
			<p class="mt-4 text-sm font-bold text-ink/60">Aucune série pour le moment.</p>
		{:else}
			<ul class="mt-4 space-y-2">
				{#each breakdown.series as row (row.id)}
					{@const set = setOf(row.id)}
					<li>
						{#if set && !isGuardian}
							<a class="block rounded-2xl bg-paper px-4 py-4 hover:bg-white" href={`/app/sets/${row.id}`}>
								{@render seriesBody(row, set)}
							</a>
						{:else if set}
							<div class="rounded-2xl bg-paper px-4 py-4">
								{@render seriesBody(row, set)}
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</section>

{#snippet seriesBody(row: SeriesScoreRow, set: ExerciseSet)}
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<p class="font-extrabold text-ink">
			{trackLabel(row.track)}
			{#if row.subjectLabel}
				<span class="font-bold text-ink/70">· {row.subjectLabel}</span>
			{/if}
			<span class="font-bold text-ink/45">· {formatMarkDate(row.at)}</span>
		</p>
		<p class="text-sm font-extrabold text-forest">{statusOf(set)}</p>
	</div>
	{#if row.lessonTitle}
		<p class="mt-1 text-sm font-bold text-ink/60">{row.lessonTitle}</p>
	{/if}
	{#if row.scored}
		<div class="mt-2">{@render meter(row.percent ?? 0)}</div>
		<p class="mt-2 text-sm font-bold text-ink/60">
			{row.correct} / {row.total}
			<span class="text-ink/40">· {percentLabel({ correct: row.correct, total: row.total, percent: row.percent })}</span>
		</p>
	{/if}
{/snippet}
