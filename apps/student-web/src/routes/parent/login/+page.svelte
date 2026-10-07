<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient, type AuthPayload } from '$lib/auth/client';
	import { clearDemoFamily } from '$lib/session';

	let email = $state('m.kone@mail.ci');
	let code = $state('');
	let challenge = $state('');
	let step = $state<'email' | 'otp' | 'totp'>('email');
	let error = $state('');
	let pending = $state(false);

	function challengeFrom(payload: AuthPayload | null): string {
		return payload && 'challenge' in payload && payload.challenge ? payload.challenge : '';
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		pending = true;
		try {
			if (step === 'email') {
				const { data, error: startError } = await authClient.startOtp(email.trim());
				const nextChallenge = challengeFrom(data);
				if (startError || !nextChallenge) {
					error = startError?.message ?? 'Envoi du code impossible';
					return;
				}
				challenge = nextChallenge;
				code = '';
				step = 'otp';
				return;
			}

			const result =
				step === 'otp'
					? await authClient.verifyOtp(challenge, code.trim())
					: await authClient.verifyTotp(challenge, code.trim());
			if (result.error || !result.data) {
				error = result.error?.message ?? 'Code refusé';
				return;
			}
			if (result.data.state === 'totp_required') {
				const nextChallenge = challengeFrom(result.data);
				if (!nextChallenge) {
					error = 'Authentification incomplète';
					return;
				}
				challenge = nextChallenge;
				code = '';
				step = 'totp';
				return;
			}
			if (result.data.state !== 'complete') {
				error = 'Connexion incomplète';
				return;
			}
			clearDemoFamily();
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
			{#if step === 'email'}
				Saisis l’email de ton compte Edaya. Un code à usage unique est envoyé (en local, il apparaît dans les logs de l’API).
			{:else if step === 'otp'}
				Entre le code reçu pour <span class="font-extrabold">{email}</span>.
			{:else}
				Entre le code de ton application d’authentification.
			{/if}
		</p>

		<form class="mt-8 space-y-4" onsubmit={submit}>
			{#if step === 'email'}
				<label class="block">
					<span class="text-sm font-bold text-ink/80">Email</span>
					<input
						class="mt-2 w-full rounded-2xl border border-ink/10 bg-cream px-4 py-3 outline-none ring-forest focus:ring-2"
						bind:value={email}
						type="email"
						autocomplete="username"
						required
					/>
				</label>
			{:else}
				<label class="block">
					<span class="text-sm font-bold text-ink/80">{step === 'totp' ? 'Code authenticator' : 'Code'}</span>
					<input
						class="mt-2 w-full rounded-2xl border border-ink/10 bg-cream px-4 py-3 outline-none ring-forest focus:ring-2"
						bind:value={code}
						type="text"
						inputmode="numeric"
						autocomplete="one-time-code"
						required
					/>
				</label>
			{/if}
			{#if error}
				<p class="text-sm font-bold text-clay">{error}</p>
			{/if}
			<button
				class="w-full rounded-full bg-forest px-6 py-3 text-lg font-extrabold text-white disabled:opacity-60"
				disabled={pending}
				type="submit"
			>
				{pending ? 'Vérification…' : step === 'email' ? 'Recevoir un code' : 'Se connecter'}
			</button>
		</form>
	</div>
</main>
