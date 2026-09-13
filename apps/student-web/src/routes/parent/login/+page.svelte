<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth/client';
	import { accessTokens } from '$lib/auth/bearer-fetch';

	let email = $state('m.kone@mail.ci');
	let password = $state('');
	let error = $state('');
	let pending = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		pending = true;
		try {
			const { error: signInError } = await authClient.signIn.email({
				email: email.trim(),
				password,
			});
			if (signInError) {
				error = signInError.message ?? 'Connexion impossible';
				return;
			}
			accessTokens.clear();
			await goto('/parent');
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Connexion impossible';
		} finally {
			pending = false;
		}
	}
</script>

<main class="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
	<div class="rounded-[2rem] bg-paper p-8 shadow-card sm:p-10">
		<a class="text-sm font-bold text-forest" href="/">← Accueil</a>
		<h1 class="mt-4 text-3xl font-extrabold text-ink">Espace parent</h1>
		<p class="mt-3 text-ink/70">
			Connecte-toi avec ton compte Edaya. En local seedé : <span class="font-extrabold">m.kone@mail.ci</span> /
			<span class="font-extrabold">DevPassword1!</span>
		</p>

		<form class="mt-8 space-y-4" onsubmit={submit}>
			<label class="block">
				<span class="text-sm font-bold text-ink/80">Email</span>
				<input
					class="mt-2 w-full rounded-2xl border border-ink/10 bg-cream px-4 py-3 outline-none ring-forest focus:ring-2"
					bind:value={email}
					type="email"
					autocomplete="username"
				/>
			</label>
			<label class="block">
				<span class="text-sm font-bold text-ink/80">Mot de passe</span>
				<input
					class="mt-2 w-full rounded-2xl border border-ink/10 bg-cream px-4 py-3 outline-none ring-forest focus:ring-2"
					bind:value={password}
					type="password"
					autocomplete="current-password"
				/>
			</label>
			{#if error}
				<p class="text-sm font-bold text-clay">{error}</p>
			{/if}
			<button
				class="w-full rounded-full bg-forest px-6 py-3 text-lg font-extrabold text-white disabled:opacity-60"
				disabled={pending}
				type="submit"
			>
				{pending ? 'Connexion…' : 'Se connecter'}
			</button>
		</form>
	</div>
</main>
