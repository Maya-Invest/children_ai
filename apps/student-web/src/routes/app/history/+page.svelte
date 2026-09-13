<script lang="ts">
	import type { HomePayload } from '$lib/types';

	let { data }: { data: { home: HomePayload } } = $props();
	let home = $derived(data.home);
</script>

<section class="rounded-[2rem] bg-paper p-6 shadow-card sm:p-10">
	<h1 class="text-3xl font-extrabold">Historique</h1>
	<p class="mt-2 text-ink/70">Les ensembles déjà créés. Pas de régénération : on ouvre seulement.</p>

	{#if home.history.length === 0}
		<p class="mt-6 text-ink/60">Pas encore d’exercices.</p>
	{:else}
		<ul class="mt-6 space-y-3">
			{#each home.history as set (set.id)}
				<li>
					<a
						class="flex items-center justify-between rounded-2xl bg-cream px-4 py-4 font-bold hover:bg-white"
						href={`/app/sets/${set.id}`}
					>
						<span>Série du {new Date(set.generatedAt).toLocaleString('fr-CI')}</span>
						<span class="text-forest">{set.questions.length} questions</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>
