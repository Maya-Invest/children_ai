<script lang="ts">
	import type { HomePayload } from '$lib/types';

	let {
		home,
		generateLabel = 'Créer mes exercices',
		onGenerate,
	}: {
		home: HomePayload;
		generateLabel?: string;
		onGenerate?: () => Promise<void> | void;
	} = $props();

	let student = $derived(home.student);
	let pending = $state(false);
	let error = $state('');
	let isGuardian = $derived(home.actor.role === 'guardian');

	async function generate() {
		if (!home.canGenerate || !onGenerate) return;
		pending = true;
		error = '';
		try {
			await onGenerate();
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Génération impossible';
		} finally {
			pending = false;
		}
	}
</script>

<section class="rounded-[2rem] bg-paper p-6 shadow-card sm:p-10">
	<p class="text-sm font-extrabold uppercase tracking-[0.18em] text-forest">
		{isGuardian ? `Espace parent · ${student.firstName}` : 'Espace élève'}
	</p>
	<h1 class="mt-2 text-4xl font-extrabold text-ink">
		{isGuardian ? `Le suivi de ${student.firstName}` : `Bonjour ${student.firstName}`}
	</h1>
	<p class="mt-3 max-w-2xl text-lg text-ink/70">
		{student.classLabel} · Mathématiques · Programme officiel DPFC
	</p>

	<div class="mt-8 grid gap-4 sm:grid-cols-3">
		<div class="rounded-2xl bg-cream p-4">
			<p class="text-sm font-bold text-ink/50">Focus suggéré</p>
			<p class="mt-1 text-xl font-extrabold">{home.lessonTitle}</p>
		</div>
		<div class="rounded-2xl bg-cream p-4">
			<p class="text-sm font-bold text-ink/50">Rang</p>
			<p class="mt-1 text-xl font-extrabold">
				{home.rank ? `${home.rank.rank}e / ${home.rank.classSize}` : '—'}
			</p>
		</div>
		<div class="rounded-2xl bg-cream p-4">
			<p class="text-sm font-bold text-ink/50">Snapshot</p>
			<p class="mt-1 text-xl font-extrabold">{new Date(home.snapshot.createdAt).toLocaleDateString('fr-CI')}</p>
		</div>
	</div>

	<p class="mt-6 text-ink/80">{home.focus.rationale}</p>

	<div class="mt-8 flex flex-wrap gap-3">
		{#if home.canGenerate && onGenerate}
			<button
				class="rounded-full bg-clay px-6 py-3 text-lg font-extrabold text-white disabled:opacity-60"
				onclick={generate}
				disabled={pending}
				type="button"
			>
				{pending ? 'Préparation…' : generateLabel}
			</button>
		{:else if home.currentSet && !isGuardian}
			<a
				class="rounded-full bg-forest px-6 py-3 text-lg font-extrabold text-white"
				href={`/app/sets/${home.currentSet.id}`}
			>
				Ouvrir mes exercices
			</a>
		{/if}
		{#if !isGuardian}
			<a class="rounded-full bg-white px-6 py-3 text-lg font-extrabold text-ink" href="/app/history">
				Voir l’historique
			</a>
		{/if}
	</div>
	{#if isGuardian && !home.currentSet}
		<p class="mt-4 text-sm font-bold text-ink/60">
			Aucun ensemble pour le moment. Seul {student.firstName} peut en demander un.
		</p>
	{/if}
	{#if error}
		<p class="mt-4 font-bold text-clay">{error}</p>
	{/if}
</section>

<section class="mt-6 rounded-[2rem] bg-paper p-6 shadow-card">
	<h2 class="text-xl font-extrabold">Dernières notes</h2>
	<ul class="mt-4 space-y-2">
		{#each home.marks as mark (mark.id)}
			<li class="flex items-center justify-between rounded-2xl bg-cream px-4 py-3">
				<span class="font-bold">{mark.title}</span>
				<span class="font-extrabold text-forest">{mark.score}/{mark.maxScore}</span>
			</li>
		{/each}
	</ul>
</section>
