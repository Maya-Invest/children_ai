<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { generateSet } from '$lib/api';
	import HomeView from '$lib/HomeView.svelte';
	import type { HomePayload, PracticeTrackKind } from '$lib/types';

	let { data }: { data: { home: HomePayload } } = $props();
	let home = $derived(data.home);

	async function generate(track: PracticeTrackKind, lessonId: string) {
		const result = await generateSet(track, lessonId);
		await goto(`/app/sets/${result.set.id}`);
	}

	async function generateAll() {
		for (const track of home.session.tracks) {
			for (const item of track.items ?? []) {
				if (!item.canGenerate) continue;
				await generateSet(track.kind, item.lessonId);
			}
		}
		await invalidateAll();
	}
</script>

<HomeView {home} onGenerate={generate} onGenerateAll={generateAll} />
