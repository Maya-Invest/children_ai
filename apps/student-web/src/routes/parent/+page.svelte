<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { issueChildAccessCode, revokeChildAccessCode } from '$lib/parent-api';
	import type { ParentChildrenPayload } from '$lib/types';

	let { data }: { data: { listing: ParentChildrenPayload } } = $props();
	let listing = $derived(data.listing);
	let revealed = $state<Record<string, string>>({});
	let error = $state('');
	let pendingId = $state('');

	async function generate(studentId: string) {
		pendingId = studentId;
		error = '';
		try {
			const issued = await issueChildAccessCode(studentId);
			revealed = { ...revealed, [studentId]: issued.code };
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
		try {
			await revokeChildAccessCode(studentId);
			const next = { ...revealed };
			delete next[studentId];
			revealed = next;
			await invalidateAll();
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Impossible de révoquer le code';
		} finally {
			pendingId = '';
		}
	}
</script>

<section class="rounded-[2rem] bg-paper p-6 shadow-card sm:p-10">
	<p class="text-sm font-extrabold uppercase tracking-[0.18em] text-forest">Espace parent</p>
	<h1 class="mt-2 text-4xl font-extrabold text-ink">Bonjour {listing.displayName}</h1>
	<p class="mt-3 text-lg text-ink/70">Suivi de lecture, codes d’accès élève, notes et focus. Pas de génération d’exercices ici.</p>

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
		<ul class="mt-8 space-y-4">
			{#each listing.children as child (child.studentId)}
				<li class="rounded-2xl bg-cream p-5">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<p class="text-xl font-extrabold">{child.firstName} {child.lastName}</p>
							<p class="text-sm font-bold text-ink/60">{child.classLabel ?? 'Classe'} · {child.grade ?? ''}</p>
							<p class="mt-2 text-sm text-ink/70">
								{#if revealed[child.studentId]}
									Code (une seule fois) :
									<span class="font-extrabold tracking-wide">{revealed[child.studentId]}</span>
								{:else if child.accessCode}
									Code actif · se termine par {child.accessCode.hint}
								{:else}
									Aucun code actif
								{/if}
							</p>
						</div>
						<div class="flex flex-wrap gap-2">
							<button
								class="rounded-full bg-clay px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
								type="button"
								disabled={pendingId === child.studentId}
								onclick={() => generate(child.studentId)}
							>
								{child.accessCode ? 'Régénérer' : 'Générer un code'}
							</button>
							{#if child.accessCode}
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
								class="rounded-full bg-forest px-4 py-2 text-sm font-extrabold text-white"
								href={`/parent/children/${child.studentId}`}
							>
								Suivi
							</a>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
