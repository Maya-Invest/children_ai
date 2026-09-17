<script lang="ts">
	import type { ResultFilter } from "$lib/result-filter";

	let {
		value,
		correctCount,
		incorrectCount,
		unansweredCount,
		total,
		onSelect,
		compact = false,
	}: {
		value: ResultFilter;
		correctCount: number;
		incorrectCount: number;
		unansweredCount: number;
		total: number;
		onSelect: (next: ResultFilter) => void;
		compact?: boolean;
	} = $props();

	const options = $derived([
		{ id: "all" as const, label: "Toutes", count: total },
		{ id: "correct" as const, label: "Justes", count: correctCount },
		{ id: "incorrect" as const, label: "Fausses", count: incorrectCount },
		{ id: "unanswered" as const, label: "Non répondu", count: unansweredCount },
	]);
</script>

<div
	class={['flex flex-wrap gap-2', compact ? 'mt-2' : 'mt-6']}
	role="group"
	aria-label="Filtrer les questions"
>
	{#each options as option (option.id)}
		<button
			class={[
				'rounded-full font-extrabold',
				compact ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm',
				value === option.id ? 'text-white' : 'bg-white text-ink',
				value === option.id && option.id === 'incorrect' && 'bg-clay',
				value === option.id && option.id === 'correct' && 'bg-forest',
				value === option.id && option.id === 'unanswered' && 'bg-ink/60',
				value === option.id && option.id === 'all' && 'bg-ink',
			]}
			type="button"
			aria-pressed={value === option.id}
			onclick={() => onSelect(option.id)}
		>
			{option.label} ({option.count})
		</button>
	{/each}
</div>
