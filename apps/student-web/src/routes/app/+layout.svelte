<script lang="ts">
	import { goto } from '$app/navigation';
	import ConnectedGrade from '$lib/ConnectedGrade.svelte';
	import DemoSwitcher from '$lib/DemoSwitcher.svelte';
	import { clearToken, isDemoExplore } from '$lib/session';
	import type { HomePayload } from '$lib/types';

	let { data, children }: { data: { home: Promise<HomePayload> }; children: import('svelte').Snippet } = $props();

	function leave() {
		clearToken();
		void goto(isDemoExplore() ? '/parent' : '/');
	}
</script>

<ConnectedGrade home={data.home} />
<div class="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-8">
	<header class="mb-6 flex flex-wrap items-center justify-between gap-3">
		<a href="/app" class="text-xl font-extrabold text-ink">Edaya Spark</a>
		<nav class="flex items-center gap-3 text-sm font-bold">
			<DemoSwitcher />
			<a class="rounded-full px-4 py-2 text-forest hover:bg-white" href="/app">Accueil</a>
			<a class="rounded-full px-4 py-2 text-forest hover:bg-white" href="/app/stats">Statistiques</a>
			<a class="rounded-full px-4 py-2 text-forest hover:bg-white" href="/app/history">Historique</a>
			<button class="rounded-full px-4 py-2 text-ink/60" type="button" onclick={leave}>Quitter</button>
		</nav>
	</header>
	{@render children()}
</div>
