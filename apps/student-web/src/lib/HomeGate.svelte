<script lang="ts" generics="T extends HomePayload">
	import type { Snippet } from 'svelte';
	import SessionLoading from '$lib/SessionLoading.svelte';
	import type { HomePayload } from '$lib/types';

	let {
		home,
		title = 'Préparation de ta séance',
		detail = 'Le programme du jour est en cours de lecture.',
		children,
	}: {
		home: Promise<T>;
		title?: string;
		detail?: string;
		children: Snippet<[T]>;
	} = $props();
</script>

{#await home}
	<SessionLoading {title} {detail} />
{:then value}
	{@render children(value)}
{:catch error}
	<p class="font-bold text-clay" role="alert">
		{error instanceof Error ? error.message : 'La séance n’a pas pu être préparée.'}
	</p>
{/await}
