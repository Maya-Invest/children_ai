<script lang="ts">
	import { resolve } from '$app/paths';
	import CorrectionView from '$lib/CorrectionView.svelte';
	import type { ResultFilter } from '$lib/result-filter';
	import type { ExerciseSet } from '$lib/types';

	let { data }: { data: { set: ExerciseSet; filter: ResultFilter } } = $props();
</script>

<CorrectionView
	set={data.set}
	filter={data.filter}
	basePath={`/app/sets/${data.set.id}`}
	backHref={resolve('/app')}
	audience="student"
/>
