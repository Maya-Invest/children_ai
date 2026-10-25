<script lang="ts">
	import { page } from '$app/state';
	import ResultFilterBar from '$lib/ResultFilterBar.svelte';
	import { filterByResult, resultCounts, type ResultFilter } from '$lib/result-filter';
	import type { ExerciseSet, Question } from '$lib/types';

	let {
		set,
		filter,
		basePath,
		backHref,
		audience,
	}: {
		set: ExerciseSet;
		filter: ResultFilter;
		basePath: string;
		backHref: string;
		audience: 'student' | 'guardian';
	} = $props();

	let submitted = $derived(Boolean(set.submittedAt));
	let correctionReleased = $derived(Boolean(set.correctionReleasedAt));
	let hasCompleteCorrection = $derived(
		set.questions.length > 0 && set.questions.every((item) => Boolean(item.expectedAnswer?.trim())),
	);
	let correctionVisible = $derived(
		audience === 'guardian' ? hasCompleteCorrection : correctionReleased && hasCompleteCorrection,
	);
	let showFilter = $derived(submitted && correctionVisible);
	let shownFilter = $derived(page.state.filter ?? filter);
	let counts = $derived(resultCounts(set.questions));
	let allQuestionsUnanswered = $derived(counts.total > 0 && counts.unanswered === counts.total);
	let visibleQuestions = $derived(filterByResult(set.questions, showFilter ? shownFilter : 'all'));
	let answerLabel = $derived(audience === 'guardian' ? 'Réponse de l’élève' : 'Ta réponse');

	function answerFor(questionId: string): string {
		const value = set.answers?.find((answer) => answer.questionId === questionId)?.value;
		return value?.trim() ? value : '—';
	}

	function questionTone(item: Question): string {
		if (!correctionVisible) return 'bg-cream';
		if (item.answered === false) return 'bg-cream ring-2 ring-ink/20';
		if (item.correct === true) return 'bg-forest/10 ring-2 ring-forest/40';
		if (item.correct === false) return 'bg-clay/15 ring-2 ring-clay';
		return 'bg-cream';
	}
</script>

<section class="rounded-[2rem] bg-paper p-6 shadow-card sm:p-10">
	<a class="text-sm font-bold text-forest" href={backHref}>← Retour</a>
	<h1 class="mt-3 text-3xl font-extrabold">
		{audience === 'guardian' && hasCompleteCorrection ? 'Corrigé' : 'Série d’exercices'}
	</h1>

	{#if submitted}
		<p class="mt-2 text-ink/70">
			{#if correctionVisible}
				{audience === 'guardian'
					? 'Série terminée. Voici le score et le détail du corrigé.'
					: 'Série terminée. Voici ton score et le détail du corrigé.'}
			{:else if correctionReleased && !hasCompleteCorrection}
				Cette ancienne série ne contient pas de corrigé exploitable.
			{:else if audience === 'guardian'}
				Série terminée. Le corrigé n’est pas encore complet.
			{:else}
				Série terminée. Tes réponses sont enregistrées, en attente du corrigé.
			{/if}
		</p>
		{#if correctionVisible}
			{#if set.score}
				<p class="mt-6 text-4xl font-extrabold text-forest">
					Score : {set.score.correct} / {set.score.total}
				</p>
			{:else}
				<p class="mt-6 text-2xl font-extrabold text-ink/70">
					{allQuestionsUnanswered ? 'Aucune réponse enregistrée' : 'Résultat indisponible'}
				</p>
			{/if}
			<p class="mt-3 text-sm font-bold text-ink/60">
				<span class="text-forest">Vert</span> = juste ·
				<span class="text-clay">Orange</span> = faux
			</p>
			{#if audience === 'student'}
				<p class="mt-4 font-bold text-ink/70">Ton parent a rendu le corrigé disponible.</p>
			{/if}
			<ResultFilterBar
				value={shownFilter}
				correctCount={counts.correct}
				incorrectCount={counts.incorrect}
				unansweredCount={counts.unanswered}
				total={counts.total}
				{basePath}
				shallow
			/>
		{:else if audience === 'student' && !correctionReleased}
			<p class="mt-4 font-bold text-ink/70">
				Le détail juste ou faux n’est pas encore disponible. Ton parent peut l’ouvrir depuis son espace.
			</p>
		{/if}
	{:else}
		<p class="mt-2 text-ink/70">Cette série n’est pas encore terminée.</p>
	{/if}

	{#if visibleQuestions.length === 0}
		<p class="mt-6 font-bold text-ink/60">Aucune question dans ce filtre.</p>
	{:else}
		<ul class="mt-8 space-y-4">
			{#each visibleQuestions as item (item.id)}
				<li class={['rounded-2xl px-4 py-4', questionTone(item)]}>
					<p class="font-extrabold">{item.prompt}</p>
					{#if correctionVisible && item.answered === false}
						<span class="mt-2 inline-flex rounded-full bg-ink/60 px-3 py-1 text-xs font-extrabold text-white">
							Non répondu
						</span>
					{:else if correctionVisible && item.correct === true}
						<span class="mt-2 inline-flex rounded-full bg-forest px-3 py-1 text-xs font-extrabold text-white">Juste</span>
					{:else if correctionVisible && item.correct === false}
						<span class="mt-2 inline-flex rounded-full bg-clay px-3 py-1 text-xs font-extrabold text-white">Faux</span>
					{:else if correctionReleased && !hasCompleteCorrection}
						<span class="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-extrabold text-ink/60">
							Corrigé indisponible
						</span>
					{:else if submitted}
						<span class="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-extrabold text-ink/60">
							En attente du corrigé
						</span>
					{/if}
					<p class="mt-2 text-sm font-bold text-ink/50">{answerLabel}</p>
					<p class="mt-1 whitespace-pre-wrap text-ink/80">{answerFor(item.id)}</p>
					{#if correctionVisible && item.expectedAnswer}
						<p class="mt-3 text-sm font-bold text-forest">Corrigé</p>
						<p class="mt-1 whitespace-pre-wrap font-bold text-ink">{item.expectedAnswer}</p>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
