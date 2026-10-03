<script lang="ts">
	import { resolve } from '$app/paths';
	import { saveSetProgress, submitSet } from '$lib/api';
	import ResultFilterBar from '$lib/ResultFilterBar.svelte';
	import { filterByResult, resultCounts, type ResultFilter } from '$lib/result-filter';
	import type { ExerciseSet, Question } from '$lib/types';

	let { data }: { data: { set: ExerciseSet } } = $props();
	let localSet = $state<ExerciseSet | null>(null);
	const set = $derived(localSet?.id === data.set.id ? localSet : data.set);
	let index = $state(0);
	let pending = $state<'idle' | 'save' | 'finish'>('idle');
	let saved = $state(false);
	let error = $state('');
	let draft = $state<Record<string, string>>({});
	let resultFilter = $state<ResultFilter>('all');
	let savedTimer = 0;

	const question = $derived(set.questions[index] ?? null);
	const isLast = $derived(index >= set.questions.length - 1);
	const submitted = $derived(Boolean(set.submittedAt));
	const correctionReleased = $derived(Boolean(set.correctionReleasedAt));
	const hasCompleteCorrection = $derived(
		set.questions.length > 0
			&& set.questions.every((item) => Boolean(item.expectedAnswer?.trim())),
	);
	const correctionVisible = $derived(correctionReleased && hasCompleteCorrection);
	const counts = $derived(resultCounts(set.questions));
	const allQuestionsUnanswered = $derived(
		counts.total > 0 && counts.unanswered === counts.total,
	);
	const visibleQuestions = $derived(
		filterByResult(set.questions, correctionVisible ? resultFilter : 'all'),
	);

	function answerValue(questionId: string): string {
		const fromDraft = draft[questionId];
		if (fromDraft !== undefined) return fromDraft;
		return set.answers?.find((answer) => answer.questionId === questionId)?.value ?? '';
	}

	function setAnswer(questionId: string, value: string) {
		draft = { ...draft, [questionId]: value };
	}

	function isMcq(item: Question): boolean {
		return item.kind === 'mcq' && (item.choices?.length ?? 0) >= 2;
	}

	function studentAnswer(questionId: string): string {
		const value = answerValue(questionId);
		return value.trim() ? value : '—';
	}

	function questionTone(item: Question): string {
		if (!correctionVisible) return 'bg-cream';
		if (item.answered === false) return 'bg-cream ring-2 ring-ink/20';
		if (item.correct === true) return 'bg-forest/10 ring-2 ring-forest/40';
		if (item.correct === false) return 'bg-clay/15 ring-2 ring-clay';
		return 'bg-cream';
	}

	function collectedAnswers() {
		return set.questions.map((item) => ({
			questionId: item.id,
			value: answerValue(item.id),
		}));
	}

	function markSaved() {
		saved = true;
		if (savedTimer) clearTimeout(savedTimer);
		savedTimer = window.setTimeout(() => {
			saved = false;
		}, 2500);
	}

	async function saveProgress() {
		if (pending !== 'idle' || submitted) return;
		pending = 'save';
		error = '';
		try {
			const payload = await saveSetProgress(set.id, collectedAnswers());
			localSet = payload.set;
			markSaved();
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Impossible d’enregistrer ta progression.';
		} finally {
			pending = 'idle';
		}
	}

	async function finish() {
		if (pending !== 'idle' || submitted) return;
		const answers = collectedAnswers();
		if (answers.every((answer) => answer.value.trim().length === 0)) {
			error = 'Réponds à au moins une question avant de terminer la série.';
			return;
		}
		pending = 'finish';
		error = '';
		try {
			const payload = await submitSet(set.id, answers);
			localSet = payload.set;
			resultFilter = 'all';
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Impossible d’enregistrer tes réponses.';
		} finally {
			pending = 'idle';
		}
	}
</script>

<section class="rounded-[2rem] bg-paper p-6 shadow-card sm:p-10">
	<a class="text-sm font-bold text-forest" href={resolve('/app')}>← Retour</a>
	<h1 class="mt-3 text-3xl font-extrabold">Série d’exercices</h1>

	{#if submitted}
		<p class="mt-2 text-ink/70">
			{#if correctionVisible}
				Série terminée. Voici ton score et le détail du corrigé.
			{:else if correctionReleased && !hasCompleteCorrection}
				Cette ancienne série ne contient pas de corrigé exploitable.
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
			<p class="mt-4 font-bold text-ink/70">Ton parent a rendu le corrigé disponible.</p>
			<ResultFilterBar
				value={resultFilter}
				correctCount={counts.correct}
				incorrectCount={counts.incorrect}
				unansweredCount={counts.unanswered}
				total={counts.total}
				onSelect={(next) => (resultFilter = next)}
			/>
		{:else if !correctionReleased}
			<p class="mt-4 font-bold text-ink/70">
				Le détail juste ou faux n’est pas encore disponible. Ton parent peut l’ouvrir depuis son
				espace.
			</p>
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
						{:else}
							<span class="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-extrabold text-ink/60">
								En attente du corrigé
							</span>
						{/if}
						<p class="mt-2 text-sm font-bold text-ink/50">Ta réponse</p>
						<p class="mt-1 whitespace-pre-wrap text-ink/80">{studentAnswer(item.id)}</p>
						{#if correctionVisible && item.expectedAnswer}
							<p class="mt-3 text-sm font-bold text-forest">Corrigé</p>
							<p class="mt-1 whitespace-pre-wrap font-bold text-ink">{item.expectedAnswer}</p>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{:else if question}
		<p class="mt-2 text-ink/70">
			Tu peux enregistrer ta progression et revenir plus tard. À la dernière question, appuie sur
			Terminer pour rendre la série.
		</p>
		<p class="mt-6 text-sm font-extrabold uppercase tracking-wide text-ink/50">
			Question {index + 1} / {set.questions.length}
		</p>
		<p class="mt-3 text-xl leading-relaxed">{question.prompt}</p>

		{#if isMcq(question)}
			<fieldset class="mt-6 space-y-3">
				<legend class="sr-only">Choisis une réponse</legend>
				{#each question.choices ?? [] as choice (choice)}
					<label
						class="flex cursor-pointer items-start gap-3 rounded-2xl bg-cream px-4 py-3 font-bold"
					>
						<input
							class="mt-1"
							type="radio"
							name={question.id}
							value={choice}
							checked={answerValue(question.id) === choice}
							onchange={() => setAnswer(question.id, choice)}
						/>
						<span>{choice}</span>
					</label>
				{/each}
			</fieldset>
		{:else}
			<label class="mt-6 block">
				<span class="text-sm font-extrabold text-ink/50">Ta réponse</span>
				<textarea
					class="mt-2 min-h-48 w-full rounded-2xl border-0 bg-cream px-4 py-3 text-lg leading-relaxed text-ink"
					rows="10"
					placeholder="Écris ta démarche et ta réponse ici."
					value={answerValue(question.id)}
					oninput={(event) => setAnswer(question.id, event.currentTarget.value)}
				></textarea>
			</label>
		{/if}

		{#if error}
			<p class="mt-4 font-bold text-clay">{error}</p>
		{/if}

		<div class="mt-8 flex flex-wrap gap-3">
			<button
				class="rounded-full bg-white px-5 py-3 font-extrabold disabled:opacity-40"
				type="button"
				disabled={index === 0 || pending !== 'idle'}
				onclick={() => (index -= 1)}
			>
				Précédent
			</button>
			{#if !isLast}
				<button
					class="rounded-full bg-clay px-5 py-3 font-extrabold text-white disabled:opacity-60"
					type="button"
					disabled={pending !== 'idle'}
					onclick={() => (index += 1)}
				>
					Suivant
				</button>
			{:else}
				<button
					class="rounded-full bg-forest px-5 py-3 font-extrabold text-white disabled:opacity-60"
					type="button"
					disabled={pending !== 'idle'}
					onclick={finish}
				>
					{pending === 'finish' ? 'Enregistrement…' : 'Terminer'}
				</button>
			{/if}
			<button
				class="rounded-full bg-white px-5 py-3 font-extrabold text-ink ring-1 ring-ink/10 disabled:opacity-60"
				type="button"
				disabled={pending !== 'idle'}
				onclick={saveProgress}
			>
				{pending === 'save' ? 'Enregistrement…' : saved ? 'Enregistré' : 'Enregistrer'}
			</button>
		</div>
	{/if}
</section>
