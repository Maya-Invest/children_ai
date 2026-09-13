<script lang="ts">
	import { goto } from '$app/navigation';
	import { generateSet } from '$lib/api';
	import HomeView from '$lib/HomeView.svelte';
	import type { HomePayload } from '$lib/types';

	let { data }: { data: { home: HomePayload } } = $props();
	let home = $derived(data.home);

	async function generate() {
		const result = await generateSet();
		await goto(`/app/sets/${result.set.id}`);
	}
</script>

<HomeView {home} onGenerate={generate} />
