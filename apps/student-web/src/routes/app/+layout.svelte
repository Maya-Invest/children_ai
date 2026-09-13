<script lang="ts">
	import { goto } from '$app/navigation';
	import { clearToken } from '$lib/session';

	let { children }: { children: import('svelte').Snippet } = $props();

	function leave() {
		clearToken();
		void goto('/');
	}
</script>

<div class="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-8">
	<header class="mb-6 flex items-center justify-between">
		<a href="/app" class="text-xl font-extrabold text-ink">Children AI</a>
		<nav class="flex items-center gap-3 text-sm font-bold">
			<a class="rounded-full px-4 py-2 text-forest hover:bg-white" href="/app">Accueil</a>
			<a class="rounded-full px-4 py-2 text-forest hover:bg-white" href="/app/history">Historique</a>
			<button class="rounded-full px-4 py-2 text-ink/60" type="button" onclick={leave}>Quitter</button>
		</nav>
	</header>
	{@render children()}
</div>
