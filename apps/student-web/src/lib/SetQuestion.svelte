<script lang="ts">
	import { goto, pushState, refreshAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { saveSetProgress, submitSet } from '$lib/api';
	import { getSetDraft } from '$lib/set-draft.svelte';
	import type { ExerciseSet, Question } from '$lib/types';

	let { set, questionNumber }: { set: ExerciseSet; questionNumber: number } = $props();

	const draft = getSetDraft();
	let localSet = $state<ExerciseSet | null>(null);
	let pending = $state<'idle' | 'save' | 'finish'>('idle');
	let saved = $state(false);
	let error = $state('');
	let savedTimer = 0;

	const current = $derived(localSet?.id === set.id ? localSet : set);
	const index = $derived(Math.max(0, questionNumber - 1));
	const question = $derived(current.questions[index] ?? null);
	const isLast = $derived(index >= current.questions.length - 1);
	const locked = $derived(pending !== 'idle');

	function answerValue(questionId: string): string {
		const drafted = draft.answer(questionId);
		if (drafted !== undefined) return drafted;
		return current.answers?.find((answer) => answer.questionId === questionId)?.value ?? '';
	}

	function choiceList(item: Question): string[] {
		const seen: Record<string, true> = {};
		const choices: string[] = [];
		for (const choice of item.choices ?? []) {
			const trimmed = choice.trim();
			if (!trimmed || seen[trimmed]) continue;
			seen[trimmed] = true;
			choices.push(trimmed);
		}
		return choices;
	}

	function isMcq(item: Question): boolean {
		return item.kind === 'mcq' && choiceList(item).length >= 2;
	}

	function collectedAnswers() {
		return current.questions.map((item) => ({
			questionId: item.id,
			value: answerValue(item.id),
		}));
	}

	function questionHref(number: number) {
		return `/app/sets/${current.id}/question/${number}`;
	}

	function openQuestion(event: MouseEvent, number: number) {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		if (locked) return;
		const next: App.PageState = { questionNumber: number };
		if (page.state.followTab) {
			next.followTab = page.state.followTab;
			if (page.state.subjectSlug) next.subjectSlug = page.state.subjectSlug;
		}
		if (page.state.setId) {
			next.setId = page.state.setId;
			next.filter = page.state.filter;
		}
		pushState(questionHref(number), next);
	}

	function markSaved() {
		saved = true;
		if (savedTimer) clearTimeout(savedTimer);
		savedTimer = window.setTimeout(() => {
			saved = false;
		}, 2500);
	}

	async function saveProgress() {
		if (pending !== 'idle' || current.submittedAt) return;
		pending = 'save';
		error = '';
		try {
			const payload = await saveSetProgress(current.id, collectedAnswers());
			localSet = payload.set;
			markSaved();
			await refreshAll();
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Impossible d’enregistrer ta progression.';
		} finally {
			pending = 'idle';
		}
	}

	async function finish() {
		if (pending !== 'idle' || current.submittedAt) return;
		const answers = collectedAnswers();
		if (answers.every((answer) => answer.value.trim().length === 0)) {
			error = 'Réponds à au moins une question avant de terminer la série.';
			return;
		}
		pending = 'finish';
		error = '';
		try {
			await submitSet(current.id, answers);
			await goto(resolve('/app/sets/[id]', { id: current.id }), { invalidateAll: true });
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

	{#if current.questions.length === 0}
		<p class="mt-6 font-bold text-ink/60">Cette série ne contient pas de question.</p>
	{:else if question}
		<p class="mt-2 text-ink/70">
			Tu peux enregistrer ta progression et revenir plus tard. À la dernière question, appuie sur
			Terminer pour rendre la série.
		</p>
		<p class="mt-6 text-sm font-extrabold uppercase tracking-wide text-ink/50">
			Question {questionNumber} / {current.questions.length}
		</p>
		<p class="mt-3 text-xl leading-relaxed">{question.prompt}</p>

		{#if isMcq(question)}
			<fieldset class="mt-6 space-y-3">
				<legend class="sr-only">Choisis une réponse</legend>
				{#each choiceList(question) as choice (choice)}
					<label class="flex cursor-pointer items-start gap-3 rounded-2xl bg-cream px-4 py-3 font-bold">
						<input
							class="mt-1"
							type="radio"
							name={question.id}
							value={choice}
							checked={answerValue(question.id) === choice}
							onchange={() => draft.setAnswer(question.id, choice)}
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
					oninput={(event) => draft.setAnswer(question.id, event.currentTarget.value)}
				></textarea>
			</label>
		{/if}

		{#if error}
			<p class="mt-4 font-bold text-clay">{error}</p>
		{/if}

		<div class="mt-8 flex flex-wrap gap-3">
			{#if questionNumber > 1}
				<a
					class={['rounded-full bg-white px-5 py-3 font-extrabold', locked && 'pointer-events-none opacity-60']}
					href={questionHref(questionNumber - 1)}
					aria-disabled={locked}
					onclick={(event) => openQuestion(event, questionNumber - 1)}
				>
					Précédent
				</a>
			{:else}
				<span class="rounded-full bg-white px-5 py-3 font-extrabold opacity-40">Précédent</span>
			{/if}
			{#if !isLast}
				<a
					class={[
						'rounded-full bg-clay px-5 py-3 font-extrabold text-white',
						locked && 'pointer-events-none opacity-60',
					]}
					href={questionHref(questionNumber + 1)}
					aria-disabled={locked}
					onclick={(event) => openQuestion(event, questionNumber + 1)}
				>
					Suivant
				</a>
			{:else}
				<button
					class="rounded-full bg-forest px-5 py-3 font-extrabold text-white disabled:opacity-60"
					type="button"
					disabled={locked}
					onclick={finish}
				>
					{pending === 'finish' ? 'Enregistrement…' : 'Terminer'}
				</button>
			{/if}
			<button
				class="rounded-full bg-white px-5 py-3 font-extrabold text-ink ring-1 ring-ink/10 disabled:opacity-60"
				type="button"
				disabled={locked}
				onclick={saveProgress}
			>
				{pending === 'save' ? 'Enregistrement…' : saved ? 'Enregistré' : 'Enregistrer'}
			</button>
		</div>
	{/if}
</section>
