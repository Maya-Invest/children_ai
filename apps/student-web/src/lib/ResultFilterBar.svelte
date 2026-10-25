<script lang="ts">
	import { openInPlace } from "$lib/corrige-nav";
	import { filterPath, type ResultFilter } from "$lib/result-filter";

	let {
		value,
		correctCount,
		incorrectCount,
		unansweredCount,
		total,
		basePath,
		compact = false,
		shallow = false,
	}: {
		value: ResultFilter;
		correctCount: number;
		incorrectCount: number;
		unansweredCount: number;
		total: number;
		basePath: string;
		compact?: boolean;
		shallow?: boolean;
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
	role="navigation"
	aria-label="Filtrer les questions"
>
	{#each options as option (option.id)}
		<a
			class={[
				'rounded-full font-extrabold',
				compact ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm',
				value === option.id ? 'text-white' : 'bg-white text-ink',
				value === option.id && option.id === 'incorrect' && 'bg-clay',
				value === option.id && option.id === 'correct' && 'bg-forest',
				value === option.id && option.id === 'unanswered' && 'bg-ink/60',
				value === option.id && option.id === 'all' && 'bg-ink',
			]}
			href={filterPath(basePath, option.id)}
			aria-current={value === option.id ? 'page' : undefined}
			onclick={(event) => {
				if (shallow) openInPlace(event, filterPath(basePath, option.id), true);
			}}
		>
			{option.label} ({option.count})
		</a>
	{/each}
</div>
