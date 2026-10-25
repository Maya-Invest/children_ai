<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setSetDraft } from '$lib/set-draft.svelte';

	let { children }: { children: Snippet } = $props();
	let answers = $state<Record<string, string>>({});

	setSetDraft({
		answer(questionId) {
			return answers[questionId];
		},
		setAnswer(questionId, value) {
			answers = { ...answers, [questionId]: value };
		},
	});
</script>

{@render children()}
