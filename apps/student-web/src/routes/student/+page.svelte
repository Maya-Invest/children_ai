<script lang="ts">
	import { goto } from '$app/navigation';
	import { signInStudent } from '$lib/api';
	import { setToken } from '$lib/session';

	let code = $state('');
	let error = $state('');
	let pending = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		pending = true;
		try {
			const result = await signInStudent(code);
			setToken(result.token);
			await goto('/app');
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Code invalide';
		} finally {
			pending = false;
		}
	}
</script>

<main class="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
	<div class="rounded-[2rem] bg-paper p-8 shadow-card sm:p-10">
		<a class="text-sm font-bold text-forest" href="/">← Accueil</a>
		<h1 class="mt-4 text-3xl font-extrabold text-ink">Entrer avec un code</h1>
		<p class="mt-3 text-ink/70">
			Le code est donné par un parent. Il ressemble à <span class="font-extrabold">A123-B456-C789-D125</span>.
		</p>

		<form class="mt-8 space-y-4" onsubmit={submit}>
			<label class="block">
				<span class="text-sm font-bold text-ink/80">Code élève</span>
				<input
					class="mt-2 w-full rounded-2xl border border-ink/10 bg-cream px-4 py-3 text-lg uppercase outline-none ring-forest focus:ring-2"
					bind:value={code}
					placeholder="A123-B456-C789-D125"
					autocomplete="off"
				/>
			</label>
			{#if error}
				<p class="text-sm font-bold text-clay">{error}</p>
			{/if}
			<button
				class="w-full rounded-full bg-clay px-6 py-3 text-lg font-extrabold text-white shadow-card disabled:opacity-60"
				disabled={pending}
				type="submit"
			>
				{pending ? 'Entrée…' : 'Entrer'}
			</button>
		</form>
	</div>
</main>
