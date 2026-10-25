<script lang="ts">
	import { goto } from '$app/navigation';
	import { signInDemo } from '$lib/api';
	import { startDemoGuardian } from '$lib/session';

	let demoError = $state('');
	let demoPending = $state(false);

	async function tryDemo() {
		demoError = '';
		demoPending = true;
		try {
			const result = await signInDemo();
			startDemoGuardian(result.guardian?.token ?? result.token);
			await goto('/parent');
		} catch (caught) {
			demoError = caught instanceof Error ? caught.message : 'Démo indisponible';
		} finally {
			demoPending = false;
		}
	}
</script>

<svelte:head>
	<title>Edaya Spark — Accueil</title>
</svelte:head>

<main class="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
	<div class="rounded-[2rem] bg-paper p-8 shadow-card sm:p-10">
		<p class="text-sm font-extrabold uppercase tracking-[0.2em] text-forest">Edaya Spark</p>
		<h1 class="mt-3 text-4xl font-extrabold leading-tight text-ink">
			Des exercices de révision, alignés sur le programme.
		</h1>
		<p class="mt-4 text-lg text-ink/70">
			Pas un chatbot. Un entraînement préparé à partir du programme officiel de Côte d’Ivoire et de tes notes à
			l’école, dans toutes les matières.
		</p>

		<div class="mt-8 grid gap-4 sm:grid-cols-2">
			<a
				class="rounded-[1.5rem] bg-cream p-5 font-extrabold text-ink shadow-card hover:bg-white"
				href="/parent/login"
			>
				<p class="text-sm uppercase tracking-wide text-forest">Parent</p>
				<p class="mt-2 text-xl">Me connecter</p>
				<p class="mt-2 text-sm font-bold text-ink/60">Compte Edaya</p>
			</a>
			<a class="rounded-[1.5rem] bg-clay p-5 font-extrabold text-white shadow-card" href="/student">
				<p class="text-sm uppercase tracking-wide text-white/80">Élève</p>
				<p class="mt-2 text-xl">J’ai un code</p>
				<p class="mt-2 text-sm font-bold text-white/80">Code donné par un parent</p>
			</a>
		</div>
	</div>

	<p class="mt-5 text-center text-xs text-ink/50">
		Vous explorez Edaya Spark ?
		<button
			class="font-medium text-forest hover:underline disabled:opacity-60"
			disabled={demoPending}
			onclick={tryDemo}
			type="button"
		>
			{demoPending ? 'Ouverture…' : 'Essayer la démo'}
		</button>
	</p>
	{#if demoError}
		<p class="mt-2 text-center text-sm font-bold text-clay">{demoError}</p>
	{/if}
</main>
