<script lang="ts">
	import { page } from '$app/state';
	import BrandLogo from '$lib/BrandLogo.svelte';
</script>

<section class="mx-auto max-w-xl px-6 py-16">
	<a href="/" class="inline-flex"><BrandLogo width={128} /></a>
	<h1 class="mt-2 text-3xl font-extrabold">Oups</h1>
	<p class="mt-3 text-ink/70">{page.error?.message ?? 'Une erreur est arrivée.'}</p>
	<a class="mt-6 inline-block rounded-full bg-clay px-5 py-3 font-extrabold text-white" href="/">
		Retour 
	</a>
</section>
