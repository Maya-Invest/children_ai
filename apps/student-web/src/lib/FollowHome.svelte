<script lang="ts">
	import type { Snippet } from 'svelte';
	import { setFollowHome } from '$lib/follow-home.svelte';
	import type { HomePayload } from '$lib/types';

	let { home, children }: { home: HomePayload; children: Snippet } = $props();

	setFollowHome({
		get home() {
			return home;
		},
	});
</script>

{@render children()}
