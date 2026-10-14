<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import HomeView from '$lib/HomeView.svelte';
	import { releaseChildCorrection, updateChildPracticeSettings } from '$lib/parent-api';
	import type { GuardianChildView, HomePayload } from '$lib/types';

	let { data }: { data: { home: HomePayload & { child: GuardianChildView } } } = $props();
	const home = $derived(data.home);
	let error = $state('');

	async function toggleAutoRelease(checked: boolean) {
		await updateChildPracticeSettings(home.child.studentId, { autoReleaseCorrection: checked });
		await invalidateAll();
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

{#if error}
	<p class="mb-4 font-bold text-clay">{error}</p>
{/if}

<HomeView
	{home}
	onReleaseCorrection={releaseSet}
	onToggleAutoRelease={toggleAutoRelease}
/>
