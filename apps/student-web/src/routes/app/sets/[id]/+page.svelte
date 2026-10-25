<script lang="ts">
	import { resolve } from '$app/paths';
	import CorrectionView from '$lib/CorrectionView.svelte';
	import type { ExerciseSet } from '$lib/types';

	let { data }: { data: { set: ExerciseSet } } = $props();
</script>

<CorrectionView
	set={data.set}
	filter="all"
	basePath={`/app/sets/${data.set.id}`}
	backHref={resolve('/app')}
	audience="student"
/>
