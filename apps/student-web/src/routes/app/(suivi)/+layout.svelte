<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import FollowHome from '$lib/FollowHome.svelte';
	import HomeGate from '$lib/HomeGate.svelte';
	import HomeView from '$lib/HomeView.svelte';
	import { generateSet } from '$lib/api';
	import type { HomePayload, PracticeTrackKind } from '$lib/types';

	let { data, children: route }: {
		data: { home: Promise<HomePayload> };
		children: import('svelte').Snippet;
	} = $props();

	async function generate(track: PracticeTrackKind, lessonId: string) {
		const result = await generateSet(track, lessonId);
		await goto(`/app/sets/${result.set.id}/question/1`);
	}

	async function generateAll(home: HomePayload) {
		for (const track of home.session.tracks) {
			for (const item of track.items ?? []) {
				if (!item.canGenerate) continue;
				await generateSet(track.kind, item.lessonId);
			}
		}
		await invalidateAll();
	}
</script>

<HomeGate home={data.home}>
	{#snippet children(home)}
		<HomeView {home} onGenerate={generate} onGenerateAll={() => generateAll(home)} />
		<FollowHome {home}>
			{@render route()}
		</FollowHome>
	{/snippet}
</HomeGate>
