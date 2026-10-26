<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Castor from '$lib/Castor.svelte';
	import { guideFor, readSeen, remember, rememberAll } from '$lib/castor-guide';

	const bubbleId = $props.id();

	let seen = $state<string[]>([]);
	let foldedFor = $state<string | null>(null);

	let guide = $derived(guideFor(page.url.pathname));
	let touring = $derived(guide ? !seen.includes(guide.id) : false);
	let folded = $derived(guide ? foldedFor === guide.id : true);
	let text = $derived(guide ? (touring ? guide.tour : guide.hint) : '');

	onMount(() => {
		seen = readSeen(localStorage);
	});

	function toggle() {
		if (!guide) return;
		foldedFor = folded ? null : guide.id;
	}

	function next() {
		if (!guide) return;
		seen = remember(localStorage, guide.id);
	}

	function skip() {
		seen = rememberAll(localStorage);
	}
</script>

{#if guide}
	<div class="pointer-events-none fixed bottom-4 right-4 z-40 flex items-end">
		<div class="flex w-[min(9.5rem,calc(100vw-2rem))] flex-col items-end gap-2">
			{#if !folded}
				<div
					id={bubbleId}
					class="pointer-events-auto w-full rounded-[1.5rem] bg-paper px-3 py-3 text-sm font-bold leading-snug text-ink shadow-card"
					role="region"
					aria-label="Guide"
				>
					<p>{text}</p>
					{#if touring}
						<div class="mt-3 flex flex-col gap-2">
							<button
								class="rounded-full bg-clay px-3 py-1.5 text-white"
								type="button"
								onclick={next}
							>
								Suivant
							</button>
							<button
								class="rounded-full px-3 py-1.5 text-ink/60"
								type="button"
								onclick={skip}
							>
								Passer
							</button>
						</div>
					{/if}
				</div>
			{/if}
			<button
				class="castor-float pointer-events-auto h-[4.75rem] w-[4.75rem] shrink-0"
				type="button"
				aria-expanded={!folded}
				aria-controls={folded ? undefined : bubbleId}
				aria-label={folded ? 'Ouvrir le guide' : 'Replier le guide'}
				onclick={toggle}
			>
				<Castor talking={!folded} />
			</button>
		</div>
	</div>
{/if}
