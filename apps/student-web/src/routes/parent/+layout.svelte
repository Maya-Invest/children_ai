<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth/client';
	import BrandLogo from '$lib/BrandLogo.svelte';
	import { accessTokens } from '$lib/auth/bearer-fetch';
	import DemoSwitcher from '$lib/DemoSwitcher.svelte';
	import { clearDemoFamily, isDemoExplore } from '$lib/session';

	let { children }: { children: import('svelte').Snippet } = $props();
	let isLogin = $derived(page.url.pathname.startsWith('/parent/login'));

	async function leave() {
		if (isDemoExplore()) {
			clearDemoFamily();
			await goto('/');
			return;
		}
		accessTokens.clear();
		await authClient.signOut();
		await goto('/');
	}
</script>

{#if isLogin}
	{@render children()}
{:else}
	<div class="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-8">
		<header class="mb-6 flex flex-wrap items-center justify-between gap-3">
			<a href="/parent" class="inline-flex items-center gap-1 text-sm font-extrabold uppercase tracking-[0.2em] text-forest">
				<BrandLogo width={144} />
				<span>Parents</span>
			</a>
			<nav class="flex items-center gap-3 text-sm font-bold">
				<DemoSwitcher />
				<button class="rounded-full px-4 py-2 text-ink/60" type="button" onclick={leave}>Déconnexion</button>
			</nav>
		</header>
		{@render children()}
	</div>
{/if}
