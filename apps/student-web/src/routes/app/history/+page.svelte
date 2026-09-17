<script lang="ts">
	import type { HomePayload } from '$lib/types';

	let { data }: { data: { home: HomePayload } } = $props();
	const home = $derived(data.home);
</script>

<section class="rounded-[2rem] bg-paper p-6 shadow-card sm:p-10">
	<h1 class="text-3xl font-extrabold">Historique</h1>
	<p class="mt-2 text-ink/70">Consulte l’historique des évaluations passées.</p>

	{#if home.history.length === 0}
		<p class="mt-6 text-ink/60">Aucune évaluation passée pour le moment.</p>
	{:else}
		<ul class="mt-6 space-y-3">
			{#each home.history as set (set.id)}
				<li>
					<a
						class="flex items-center justify-between rounded-2xl bg-cream px-4 py-4 font-bold hover:bg-white"
						href={`/app/sets/${set.id}`}
					>
						<span>Série du {new Date(set.generatedAt).toLocaleString('fr-CI')}</span>
						<span class="text-forest">
							{#if set.correctionReleasedAt && set.score}
								{set.score.correct}/{set.score.total}
							{:else if set.submittedAt}
								En attente du corrigé
							{:else}
								{set.questions.length} questions
							{/if}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>
