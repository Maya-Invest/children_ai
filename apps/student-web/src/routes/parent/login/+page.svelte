<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { authClient, type AuthPayload, type ParentTerms } from '$lib/auth/client';
	import { clearDemoFamily } from '$lib/session';
	import TermsAcceptance from '$lib/TermsAcceptance.svelte';

	let { data }: { data: { otpFlag: boolean } } = $props();

	let email = $state('m.kone@mail.ci');
	let code = $state('');
	let challenge = $state('');
	let step = $state<'email' | 'otp' | 'totp'>('email');
	let error = $state('');
	let pending = $state(false);
	let revealedOtp = $state('');
	let acceptedTerms = $state(false);
	let terms = $state<ParentTerms | null>(null);
	let termsFailed = $state(false);

	async function loadTerms() {
		acceptedTerms = false;
		terms = null;
		termsFailed = false;
		try {
			terms = await authClient.getParentTerms();
		} catch {
			termsFailed = true;
		}
	}
	onMount(() => { void loadTerms(); });

	function challengeFrom(payload: AuthPayload | null): string {
		return payload && 'challenge' in payload && payload.challenge ? payload.challenge : '';
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		if (pending) return;
		pending = true;
		try {
			if (step === 'email') {
				if (!terms || !acceptedTerms) {
					error = 'Accepte les conditions d’utilisation pour continuer.';
					return;
				}
				const { data, error: startError } = await authClient.startOtp(email.trim(), terms.enforced
					? { version: terms.version, locale: 'fr', accepted: true }
					: undefined);
				const nextChallenge = challengeFrom(data);
				if (startError || !nextChallenge) {
					if (startError?.code === 'terms_version_changed' || startError?.code === 'terms_acceptance_required') {
						await loadTerms();
						error = 'Les conditions ont changé. Lis et accepte leur nouvelle version pour continuer.';
					} else {
						error = startError?.message ?? 'Envoi du code impossible';
					}
					return;
				}
				challenge = nextChallenge;
				code = '';
				revealedOtp = '';
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

	async function showOtp() {
		error = '';
		revealedOtp = '';
		pending = true;
		try {
			const { data: payload, error: revealError } = await authClient.revealOtp(challenge);
			if (revealError || !payload?.otp) {
				error = 'Code indisponible. Demande-en un nouveau : il ne reste lisible que quelques minutes.';
				return;
			}
			revealedOtp = payload.otp;
			code = payload.otp;
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
				Saisis l’email de ton compte Edaya. Un code à usage unique est envoyé.
			{:else if step === 'otp'}
				Entre le code reçu pour <span class="font-extrabold">{email}</span>.
				{#if data.otpFlag}
					En local, tu peux l’afficher ci-dessous.
				{/if}
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
						oninput={() => { acceptedTerms = false; }}
						disabled={pending}
						type="email"
						autocomplete="username"
						required
					/>
				</label>
				{#if terms}
					<TermsAcceptance bind:accepted={acceptedTerms} html={terms.enforced ? terms.html : undefined} disabled={pending} />
				{:else if termsFailed}
					<p role="alert" class="text-sm font-bold text-clay">Impossible de charger les conditions d’utilisation.</p>
					<button class="underline" type="button" onclick={loadTerms}>Réessayer</button>
				{:else}
					<p role="status">Chargement des conditions d’utilisation…</p>
				{/if}
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
			{#if step === 'otp' && data.otpFlag}
				<div class="rounded-2xl border border-dashed border-ink/20 p-4">
					<p class="text-xs font-bold uppercase tracking-wide text-ink/50">Local uniquement</p>
					<button
						class="mt-3 rounded-full border border-forest px-4 py-2 text-sm font-extrabold text-forest disabled:opacity-60"
						disabled={pending}
						type="button"
						onclick={showOtp}
					>
						Afficher le code
					</button>
					{#if revealedOtp}
						<p class="mt-3 text-2xl font-extrabold tracking-widest text-ink">{revealedOtp}</p>
					{/if}
				</div>
			{/if}
			{#if error}
				<p class="text-sm font-bold text-clay">{error}</p>
			{/if}
			<button
				class="w-full rounded-full bg-forest px-6 py-3 text-lg font-extrabold text-white disabled:opacity-60"
				disabled={pending || (step === 'email' && (!terms || !acceptedTerms))}
				type="submit"
			>
				{pending ? 'Vérification…' : step === 'email' ? 'Recevoir un code' : 'Se connecter'}
			</button>
		</form>
	</div>
</main>
