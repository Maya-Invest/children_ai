<script lang="ts">
	import { page } from '$app/state';
	import { getToken, isDemoExplore } from '$lib/session';

	let demo = $derived(isDemoExplore());
	let path = $derived(page.url.pathname);
	let studentHref = $derived(getToken() ? '/app' : '/student');

	function linkClass(active: boolean) {
		return [
			'rounded-full px-4 py-2',
			active ? 'bg-forest text-white' : 'text-forest hover:bg-white',
		];
	}
</script>

{#if demo}
	<nav class="flex items-center gap-2 text-sm font-bold">
		<a class={linkClass(path === '/demo')} href="/demo">Démo</a>
		<a class={linkClass(path.startsWith('/parent'))} href="/parent">Parent</a>
		<a
			class={linkClass(path.startsWith('/app') || path.startsWith('/student'))}
			href={studentHref}
		>
			Élève
		</a>
	</nav>
{/if}
