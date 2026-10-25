<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import FollowHome from '$lib/FollowHome.svelte';
	import HomeGate from '$lib/HomeGate.svelte';
	import HomeView from '$lib/HomeView.svelte';
	import { releaseChildCorrection, updateChildPracticeSettings } from '$lib/parent-api';
	import type { GuardianChildView, HomePayload } from '$lib/types';

	let { data, children: route }: {
		data: { home: Promise<HomePayload & { child: GuardianChildView }> };
		children: import('svelte').Snippet;
	} = $props();
	let error = $state('');

	async function toggleAutoRelease(home: HomePayload & { child: GuardianChildView }, checked: boolean) {
		await updateChildPracticeSettings(home.child.studentId, { autoReleaseCorrection: checked });
		await invalidateAll();
	}

	async function releaseSet(home: HomePayload & { child: GuardianChildView }, setId: string) {
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

<HomeGate
	home={data.home}
	title="Préparation de la séance"
	detail="Le programme du jour est en cours de lecture."
>
	{#snippet children(home)}
		<HomeView
			{home}
			resultsLink={`/parent/children/${home.child.studentId}/stats`}
			setHref={(setId) => `/parent/children/${home.child.studentId}/corriges/${setId}`}
			onReleaseCorrection={(setId) => releaseSet(home, setId)}
			onToggleAutoRelease={(checked) => toggleAutoRelease(home, checked)}
		/>
		<FollowHome {home}>
			{@render route()}
		</FollowHome>
	{/snippet}
</HomeGate>
