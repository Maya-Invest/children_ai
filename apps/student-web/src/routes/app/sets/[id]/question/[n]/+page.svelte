<script lang="ts">
	import { page } from '$app/state';
	import SetQuestion from '$lib/SetQuestion.svelte';
	import type { ExerciseSet } from '$lib/types';

	let { data }: { data: { set: ExerciseSet } } = $props();
	let questionNumber = $derived(page.state.questionNumber ?? Number(page.params.n));
</script>

<SetQuestion set={data.set} {questionNumber} />
