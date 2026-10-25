<script lang="ts">
	import StatsView from '$lib/StatsView.svelte';
	import type { HomePayload } from '$lib/types';

	let { data }: { data: { home: HomePayload } } = $props();
</script>

<StatsView home={data.home} backHref="/app" />
