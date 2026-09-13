<script lang="ts">
	import HomeView from '$lib/HomeView.svelte';
	import type { GuardianChildView, HomePayload } from '$lib/types';

	let { data }: { data: { home: HomePayload & { child: GuardianChildView } } } = $props();
	let home = $derived(data.home);
</script>

<p class="mb-4">
	<a class="text-sm font-bold text-forest" href="/parent">← Mes enfants</a>
</p>
<HomeView {home} />
