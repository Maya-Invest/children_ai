<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth/client';
	import { accessTokens } from '$lib/auth/bearer-fetch';

	let { children }: { children: import('svelte').Snippet } = $props();
	let isLogin = $derived(page.url.pathname.startsWith('/parent/login'));

	async function leave() {
		accessTokens.clear();
		await authClient.signOut();
		await goto('/');
	}
</script>

{#if isLogin}
	{@render children()}
{:else}
	<div class="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-8">
		<header class="mb-6 flex items-center justify-between">
			<a href="/parent" class="text-xl font-extrabold text-ink">Children AI · Parents</a>
			<nav class="flex items-center gap-3 text-sm font-bold">
				<a class="rounded-full px-4 py-2 text-forest hover:bg-white" href="/parent">Enfants</a>
				<button class="rounded-full px-4 py-2 text-ink/60" type="button" onclick={leave}>Déconnexion</button>
			</nav>
		</header>
		{@render children()}
	</div>
{/if}
