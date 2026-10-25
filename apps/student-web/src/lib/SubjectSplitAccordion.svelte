<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	let {
		groups,
		navLabel,
		idPrefix,
		item,
		selectedSubject = '',
		hrefFor,
		collapseHref,
		onNavigate,
	}: {
		groups: { subject: string; headerLabel: string; items: T[] }[];
		navLabel: string;
		idPrefix: string;
		item: Snippet<[T]>;
		selectedSubject?: string;
		hrefFor: (subject: string) => string;
		collapseHref: string;
		onNavigate?: (event: MouseEvent, href: string) => void;
	} = $props();

	let desktopSubject = $derived(
		groups.find((group) => group.subject === selectedSubject)?.subject ?? groups[0]?.subject ?? '',
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
</script>

<div
	class="mt-4 flex flex-col gap-3 rounded-[1.75rem] bg-cream/80 p-3 ring-1 ring-ink/10 md:flex-row md:items-stretch"
>
	<nav class="hidden shrink-0 md:block md:w-56" aria-label={navLabel}>
		<ul class="flex flex-col gap-2">
			{#each groups as group (group.subject)}
				<li>
					<a
						class={[
							'flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-extrabold',
							'rounded-xl',
							desktopSubject === group.subject ? 'bg-forest text-white' : 'bg-white text-ink',
						]}
						href={hrefFor(group.subject)}
						aria-current={desktopSubject === group.subject ? 'true' : undefined}
						onclick={(event) => onNavigate?.(event, hrefFor(group.subject))}
					>
						<span class="min-w-0 flex-1 truncate" title={group.subject}>{group.subject}</span>
						<span
							class={[
								'shrink-0 text-sm font-extrabold',
								desktopSubject === group.subject ? 'text-white/80' : 'text-forest',
							]}>{group.headerLabel}</span
						>
					</a>
				</li>
			{/each}
		</ul>
	</nav>
	<div
		class="hidden min-w-0 flex-1 flex-col rounded-[1.5rem] bg-white/90 p-3 ring-1 ring-ink/10 md:flex"
	>
		{#if desktopSubject}
			{@const currentGroup = groups.find((group) => group.subject === desktopSubject)}
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
		{/if}
	</div>
	<div class="flex min-w-0 flex-1 flex-col gap-2 md:hidden">
		{#each groups as group (group.subject)}
			{@const open = selectedSubject !== '' && selectedSubject === group.subject}
			{@const mattersId = mobileSubjectDomId(group.subject)}
			<div>
				<a
					class={[
						'flex w-full items-center justify-between gap-3 text-left',
						open ? 'mb-2 px-3 py-2' : 'rounded-2xl bg-cream px-4 py-2.5 ring-1 ring-ink/10',
					]}
					href={open ? collapseHref : hrefFor(group.subject)}
					aria-expanded={open}
					aria-controls={mattersId}
					onclick={(event) => onNavigate?.(event, open ? collapseHref : hrefFor(group.subject))}
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
				</a>
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
