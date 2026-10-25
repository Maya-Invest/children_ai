<script lang="ts">
	import { page } from '$app/state';
	import CorrectionView from '$lib/CorrectionView.svelte';
	import type { ExerciseSet } from '$lib/types';

	let { data }: { data: { set: ExerciseSet } } = $props();
	let childId = $derived(page.params.id ?? '');
</script>

<CorrectionView
	set={data.set}
	filter="all"
	basePath={`/parent/children/${childId}/sets/${data.set.id}`}
	backHref={`/parent/children/${childId}`}
	audience="guardian"
/>
