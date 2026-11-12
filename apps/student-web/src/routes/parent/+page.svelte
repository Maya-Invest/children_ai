<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { issueChildAccessCode, revokeChildAccessCode } from '$lib/parent-api';
	import { isDemoExplore } from '$lib/session';
	import TermsAcceptance from '$lib/TermsAcceptance.svelte';
	import type { ParentChildrenPayload } from '$lib/types';

	let { data }: { data: { listing: ParentChildrenPayload } } = $props();
	let listing = $derived(data.listing);
	let schools = $derived(
		listing.schools.length > 0
			? listing.schools
			: listing.children.length === 0
				? []
				: [{
					schoolId: listing.schoolId || 'school',
					schoolName: listing.schoolId || 'École',
					children: listing.children,
				}],
	);
	let demo = $derived(isDemoExplore());
	let revealed = $state<Record<string, string>>({});
	let revokedIds = $state<string[]>([]);
	let error = $state('');
	let pendingId = $state('');
	let acceptedTerms = $state(false);
	let copiedId = $state('');
	let copiedTimer = 0;

	function requireTerms(): boolean {
		if (acceptedTerms) return true;
		error = 'Accepte les conditions d’utilisation pour continuer.';
		return false;
	}

	async function generate(studentId: string) {
		if (!requireTerms()) return;
		pendingId = studentId;
		error = '';
		if (copiedId === studentId) copiedId = '';
		try {
			const issued = await issueChildAccessCode(studentId);
			revealed = { ...revealed, [studentId]: issued.code };
			revokedIds = revokedIds.filter((id) => id !== studentId);
			await invalidateAll();
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Impossible de générer le code';
		} finally {
			pendingId = '';
		}
	}

	async function revoke(studentId: string) {
		pendingId = studentId;
		error = '';
		if (copiedId === studentId) copiedId = '';
		try {
			await revokeChildAccessCode(studentId);
			const next = { ...revealed };
			delete next[studentId];
			revealed = next;
			revokedIds = [...revokedIds, studentId];
			await invalidateAll();
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Impossible de révoquer le code';
		} finally {
			pendingId = '';
		}
	}

	function activeCode(child: ParentChildrenPayload['children'][number]) {
		if (revokedIds.includes(child.studentId)) return null;
		return child.accessCode;
	}

	async function copyCode(studentId: string, code: string) {
		error = '';
		try {
			await navigator.clipboard.writeText(code);
			copiedId = studentId;
			if (copiedTimer) clearTimeout(copiedTimer);
			copiedTimer = window.setTimeout(() => {
				if (copiedId === studentId) copiedId = '';
			}, 2000);
		} catch {
			error = 'Impossible de copier le code. Copiez-le manuellement.';
		}
	}
</script>

<section class="rounded-[2rem] bg-paper p-6 shadow-card sm:p-10">
	<p class="text-sm font-extrabold uppercase tracking-[0.18em] text-forest">Espace parent</p>
	<h1 class="mt-2 text-4xl font-extrabold text-ink">Bonjour {listing.displayName}</h1>
	<p class="mt-3 text-lg text-ink/70">
		Génère un code d’accès pour ton enfant, puis ouvre son suivi pour les notes, l’emploi du temps et
		les corrigés.
	</p>
	{#if demo}
		<p class="mt-3 rounded-2xl bg-forest/10 px-4 py-3 text-sm font-bold text-forest">
			Pour ouvrir l’espace élève : génère un code, copie-le, puis connecte-toi comme élève.
		</p>
	{/if}

	<div class="mt-6">
		<TermsAcceptance bind:accepted={acceptedTerms} />
	</div>

	{#if error}
		<p class="mt-4 font-bold text-clay">{error}</p>
	{/if}

	{#if listing.children.length === 0}
		<div class="mt-8 rounded-2xl bg-cream px-4 py-6">
			<p class="font-extrabold text-ink">Aucun enfant lié</p>
			<p class="mt-2 text-ink/70">
				{listing.emptyMessage ?? "Aucun enfant n'est lié à votre compte à l'école."}
			</p>
		</div>
	{:else}
		{#each schools as school (school.schoolId)}
			<section class="mt-8">
				<h2 class="text-lg font-extrabold text-ink">{school.schoolName}</h2>
				<ul class="mt-4 space-y-4">
					{#each school.children as child (`${school.schoolId}:${child.studentId}`)}
				{@const active = activeCode(child)}
				<li class="rounded-2xl bg-cream p-5">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<p class="text-xl font-extrabold">{child.firstName} {child.lastName}</p>
							<p class="text-sm font-bold text-ink/60">
								Classe : {child.classLabel ?? '—'}
							</p>
							{#if revealed[child.studentId]}
								{@const code = revealed[child.studentId]}
								<div class="mt-2 flex flex-wrap items-center gap-2">
									<p class="text-sm text-ink/70">
										Code (une seule fois) :
										<span class="font-extrabold tracking-wide">{code}</span>
									</p>
									<button
										class="rounded-full bg-white px-4 py-2 text-sm font-extrabold text-forest"
										type="button"
										onclick={() => copyCode(child.studentId, code)}
									>
										{copiedId === child.studentId ? 'Copié' : 'Copier'}
									</button>
								</div>
								<p class="mt-1 text-sm font-bold text-clay">
									Copiez ce code et conservez-le (notes, carnet). Il ne sera plus affiché en entier.
								</p>
								{#if demo}
									<a
										class="mt-3 inline-block rounded-full bg-clay px-4 py-2 text-sm font-extrabold text-white"
										href="/student"
									>
										Se connecter comme élève
									</a>
								{/if}
							{:else if active}
								<p class="mt-2 text-sm text-ink/70">
									Code actif · se termine par {active.hint}
								</p>
							{:else}
								<p class="mt-2 text-sm text-ink/70">Aucun code actif</p>
							{/if}
						</div>
						<div class="flex flex-wrap gap-2">
							<button
								class="rounded-full bg-clay px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
								type="button"
								disabled={pendingId === child.studentId || !acceptedTerms}
								onclick={() => generate(child.studentId)}
							>
								{active ? 'Régénérer' : 'Générer un code'}
							</button>
							{#if active}
								<button
									class="rounded-full bg-white px-4 py-2 text-sm font-extrabold text-ink disabled:opacity-60"
									type="button"
									disabled={pendingId === child.studentId}
									onclick={() => revoke(child.studentId)}
								>
									Révoquer
								</button>
							{/if}
							<a
								class="rounded-full bg-forest px-4 py-2 text-sm font-extrabold text-white aria-disabled:opacity-60"
								href={`/parent/children/${child.studentId}`}
								aria-disabled={!acceptedTerms}
								onclick={(event) => {
									if (!acceptedTerms) event.preventDefault();
								}}
							>
								Suivi
							</a>
						</div>
					</div>
					</li>
					{/each}
				</ul>
			</section>
		{/each}
	{/if}
</section>
