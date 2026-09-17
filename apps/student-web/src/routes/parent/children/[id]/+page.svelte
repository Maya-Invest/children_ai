<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import HomeView from '$lib/HomeView.svelte';
	import { releaseChildCorrection, updateChildPracticeSettings } from '$lib/parent-api';
	import type { GuardianChildView, HomePayload } from '$lib/types';

	let { data }: { data: { home: HomePayload & { child: GuardianChildView } } } = $props();
	const home = $derived(data.home);
	let pending = $state('');
	let error = $state('');

	async function toggleAutoRelease(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const checked = input.checked;
		pending = 'settings';
		error = '';
		try {
			await updateChildPracticeSettings(home.child.studentId, checked);
			await invalidateAll();
		} catch (caught) {
			input.checked = home.autoReleaseCorrection;
			error = caught instanceof Error ? caught.message : 'Impossible d’enregistrer ce réglage.';
		} finally {
			pending = '';
		}
	}

	async function releaseSet(setId: string) {
		error = '';
		try {
			await releaseChildCorrection(home.child.studentId, setId);
			await invalidateAll();
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Impossible d’ouvrir le corrigé.';
		}
	}
</script>

<p class="mb-4">
	<a class="text-sm font-bold text-forest" href="/parent">← Mes enfants</a>
</p>

<section class="mb-6 rounded-[2rem] bg-paper p-6 shadow-card sm:p-10">
	<h2 class="text-2xl font-extrabold">Corrigé</h2>
	<p class="mt-2 text-ink/70">
		Génère et consulte chaque corrigé depuis la section « Exercices de révision ». L’élève ne voit le score et le détail
		juste / faux que lorsque tu rends la correction disponible.
	</p>

	<label class="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-cream px-4 py-4">
		<input
			class="mt-1"
			type="checkbox"
			checked={home.autoReleaseCorrection}
			disabled={pending === 'settings'}
			onchange={toggleAutoRelease}
		/>
		<span>
			<span class="font-extrabold">Afficher la correction automatiquement</span>
			<span class="mt-1 block text-sm font-bold text-ink/60">
				À l’écran de l’élève, dès qu’il a terminé les exercices.
			</span>
		</span>
	</label>

	{#if error}
		<p class="mt-4 font-bold text-clay">{error}</p>
	{/if}
</section>

<HomeView {home} onReleaseCorrection={releaseSet} />
