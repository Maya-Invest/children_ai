<script lang="ts">
	import { page } from '$app/state';
	import CorrectionView from '$lib/CorrectionView.svelte';
	import type { ResultFilter } from '$lib/result-filter';
	import type { ExerciseSet } from '$lib/types';

	let { data }: { data: { set: ExerciseSet; filter: ResultFilter } } = $props();
	let childId = $derived(page.params.id ?? '');
</script>

<CorrectionView
	set={data.set}
	filter={data.filter}
	basePath={`/parent/children/${childId}/sets/${data.set.id}`}
	backHref={`/parent/children/${childId}`}
	audience="guardian"
/>
