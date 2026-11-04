<script lang="ts">
	import { goto } from '$app/navigation';
	import { signInDemo } from '$lib/api';
	import BrandLogo from '$lib/BrandLogo.svelte';
	import { clearDemoFamily, isDemoExplore, startDemoGuardian } from '$lib/session';

	let error = $state('');
	let pending = $state(!isDemoExplore());

	async function ensureDemo() {
		if (isDemoExplore()) {
			pending = false;
			return;
		}
		pending = true;
		error = '';
		try {
			const result = await signInDemo();
			startDemoGuardian(result.guardian?.token ?? result.token);
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Démo indisponible';
		} finally {
			pending = false;
		}
	}

	async function leave() {
		clearDemoFamily();
		await goto('/');
	}

	void ensureDemo();
</script>

<svelte:head>
	<title>Edaya Spark — Démo</title>
</svelte:head>

<main class="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-12">
	<div class="rounded-[2rem] bg-paper p-8 shadow-card sm:p-10">
		<BrandLogo width={176} />
		<p class="text-sm font-extrabold uppercase tracking-[0.2em] text-forest">Démo seedée</p>
		<h1 class="mt-3 text-4xl font-extrabold leading-tight text-ink">Même chaîne qu’en vrai</h1>
		<p class="mt-4 text-lg text-ink/70">
			Le parent génère un code, le copie, puis l’élève se connecte avec. Pas de raccourci vers l’espace
			élève.
		</p>

		{#if pending}
			<p class="mt-8 font-bold text-ink/60">Préparation de la démo…</p>
		{:else if error}
			<p class="mt-8 font-bold text-clay">{error}</p>
		{:else}
			<ol class="mt-8 space-y-3">
				<li class="rounded-2xl bg-cream p-4">
					<p class="text-xs font-extrabold uppercase tracking-wide text-forest">1 · Parent</p>
					<p class="mt-1 font-extrabold text-ink">Ouvre l’espace de Sophie Mercier</p>
					<p class="mt-1 text-sm font-bold text-ink/60">
						Génère un code pour Léa ou Thomas, puis copie-le.
					</p>
					<a class="mt-3 inline-block rounded-full bg-forest px-4 py-2 text-sm font-extrabold text-white" href="/parent">
						Espace parent
					</a>
				</li>
				<li class="rounded-2xl bg-cream p-4">
					<p class="text-xs font-extrabold uppercase tracking-wide text-forest">2 · Code</p>
					<p class="mt-1 font-extrabold text-ink">Le code s’affiche une seule fois</p>
					<p class="mt-1 text-sm font-bold text-ink/60">Même bouton « Générer un code » que hors démo.</p>
				</li>
				<li class="rounded-2xl bg-clay p-4 text-white">
					<p class="text-xs font-extrabold uppercase tracking-wide text-white/80">3 · Élève</p>
					<p class="mt-1 font-extrabold">Colle le code pour entrer chez l’enfant choisi</p>
					<p class="mt-1 text-sm font-bold text-white/80">Même écran « J’ai un code » que hors démo.</p>
					<a class="mt-3 inline-block rounded-full bg-white px-4 py-2 text-sm font-extrabold text-clay" href="/student">
						Se connecter comme élève
					</a>
				</li>
			</ol>
		{/if}

		<div class="mt-8 flex flex-wrap gap-3">
			<a class="text-sm font-bold text-forest" href="/">← Accueil</a>
			<button class="text-sm font-bold text-ink/50" type="button" onclick={leave}>Quitter la démo</button>
		</div>
	</div>
</main>
