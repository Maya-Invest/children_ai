<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	let {
		groups,
		navLabel,
		idPrefix,
		item,
	}: {
		groups: { subject: string; headerLabel: string; items: T[] }[];
		navLabel: string;
		idPrefix: string;
		item: Snippet<[T]>;
	} = $props();

	let selectedSubject = $state('');
	let expanded = $state(true);

	let currentGroup = $derived(
		groups.find((group) => group.subject === selectedSubject) ?? groups[0] ?? null,
	);

	function mobileSubjectDomId(subject: string) {
		return `${idPrefix}-mobile-${subject.replace(/\s+/g, '-')}`;
	}

	function itemKey(entry: T, subject: string, index: number) {
		if (typeof entry === 'object' && entry !== null && 'id' in entry) {
			const id = (entry as { id: unknown }).id;
			if (typeof id === 'string' || typeof id === 'number') {
				return String(id);
			}
		}
		return `${subject}-${index}`;
	}

	function selectSubject(subject: string) {
		selectedSubject = subject;
		expanded = true;
	}

	function toggleSubject(subject: string) {
		if (expanded && currentGroup?.subject === subject) {
			expanded = false;
			selectedSubject = subject;
			return;
		}
		selectSubject(subject);
	}
</script>

<div
	class="mt-4 flex flex-col gap-3 rounded-[1.75rem] bg-cream/80 p-3 ring-1 ring-ink/10 md:flex-row md:items-stretch"
>
	<nav class="hidden shrink-0 md:block md:w-56" aria-label={navLabel}>
		<ul class="flex flex-col gap-2">
			{#each groups as group (group.subject)}
				<li>
					<button
						class={[
							'flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-extrabold',
							'rounded-xl',
							currentGroup?.subject === group.subject
								? 'bg-forest text-white'
								: 'bg-white text-ink',
						]}
						type="button"
						aria-current={currentGroup?.subject === group.subject ? 'true' : undefined}
						onclick={() => selectSubject(group.subject)}
					>
						<span class="min-w-0 flex-1 truncate" title={group.subject}>{group.subject}</span>
						<span
							class={[
								'shrink-0 text-sm font-extrabold',
								currentGroup?.subject === group.subject ? 'text-white/80' : 'text-forest',
							]}>{group.headerLabel}</span
						>
					</button>
				</li>
			{/each}
		</ul>
	</nav>
	<div
		class="hidden min-w-0 flex-1 flex-col rounded-[1.5rem] bg-white/90 p-3 ring-1 ring-ink/10 md:flex"
	>
		{#if currentGroup}
			<div>
				<div class="border-b border-ink/10 px-3 pb-3 pt-2">
					<span class="font-extrabold text-ink">Chapitres de {currentGroup.subject}</span>
				</div>
				<div class="px-3 py-4">
					<ul class="space-y-3">
						{#each currentGroup.items as entry, index (itemKey(entry, currentGroup.subject, index))}
							<li>
								{@render item(entry)}
							</li>
						{/each}
					</ul>
				</div>
			</div>
		{/if}
	</div>
	<div
		class="flex min-w-0 flex-1 flex-col gap-2 md:hidden"
	>
		{#each groups as group (group.subject)}
			{@const open = expanded && currentGroup?.subject === group.subject}
			{@const mattersId = mobileSubjectDomId(group.subject)}
			<div>
				<button
					class={[
						'flex w-full items-center justify-between gap-3 text-left',
						open
							? 'mb-2 px-3 py-2'
							: 'rounded-2xl bg-cream px-4 py-2.5 ring-1 ring-ink/10',
					]}
					type="button"
					aria-expanded={open}
					aria-controls={mattersId}
					onclick={() => toggleSubject(group.subject)}
				>
					<span class="font-extrabold text-ink">{group.subject}</span>
					<span class="flex items-center gap-2">
						<span class="text-sm font-extrabold text-forest">{group.headerLabel}</span>
						<svg
							class={['h-4 w-4 text-ink/50 transition-transform', open && 'rotate-180']}
							viewBox="0 0 20 20"
							fill="currentColor"
							aria-hidden="true"
						>
							<path
								fill-rule="evenodd"
								d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
								clip-rule="evenodd"
							/>
						</svg>
					</span>
				</button>
				{#if open}
					<div id={mattersId} class="rounded-[1.1rem] bg-white px-4 py-4">
						<ul class="space-y-3">
							{#each group.items as entry, index (itemKey(entry, group.subject, index))}
								<li>
									{@render item(entry)}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>
