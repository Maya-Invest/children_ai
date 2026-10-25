<script lang="ts">
	import StatsView from '$lib/StatsView.svelte';
	import type { GuardianChildView, HomePayload } from '$lib/types';

	let { data }: { data: { home: HomePayload & { child: GuardianChildView } } } = $props();
	let home = $derived(data.home);
</script>

<StatsView {home} backHref={`/parent/children/${home.child.studentId}`} />
