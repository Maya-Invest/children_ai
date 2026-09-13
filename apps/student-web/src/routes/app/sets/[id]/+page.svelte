<script lang="ts">
	import type { ExerciseSet } from '$lib/types';

	let { data }: { data: { set: ExerciseSet } } = $props();
	let set = $derived(data.set);
	let index = $state(0);
	const question = $derived(set.questions[index] ?? null);
</script>

<section class="rounded-[2rem] bg-paper p-6 shadow-card sm:p-10">
	<a class="text-sm font-bold text-forest" href="/app">← Retour</a>
	<h1 class="mt-3 text-3xl font-extrabold">Série d’exercices</h1>
	<p class="mt-2 text-ink/70">Pas de corrigé pour l’instant. Écris ta démarche sur papier ou dans un cahier.</p>

	{#if question}
		<p class="mt-6 text-sm font-extrabold uppercase tracking-wide text-ink/50">
			Question {index + 1} / {set.questions.length}
		</p>
		<p class="mt-3 text-xl leading-relaxed">{question.prompt}</p>

		<div class="mt-8 flex flex-wrap gap-3">
			<button
				class="rounded-full bg-white px-5 py-3 font-extrabold disabled:opacity-40"
				type="button"
				disabled={index === 0}
				onclick={() => (index -= 1)}
			>
				Précédent
			</button>
			<button
				class="rounded-full bg-clay px-5 py-3 font-extrabold text-white disabled:opacity-40"
				type="button"
				disabled={index >= set.questions.length - 1}
				onclick={() => (index += 1)}
			>
				Suivant
			</button>
		</div>
	{/if}
</section>
