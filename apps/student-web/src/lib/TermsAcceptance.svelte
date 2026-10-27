<script lang="ts">
	let { accepted = $bindable(false) }: { accepted?: boolean } = $props();

	const termsUrl = 'https://edayaplus.com/conditions-utilisation/';
	let open = $state(false);

	function openTerms(event: MouseEvent) {
		event.preventDefault();
		open = true;
	}

	function showDialog(node: HTMLDialogElement) {
		node.showModal();
		return () => {
			if (node.open) node.close();
		};
	}
</script>

<label class="flex cursor-pointer items-start gap-3 rounded-2xl bg-cream px-4 py-3">
	<input class="mt-1 shrink-0" type="checkbox" bind:checked={accepted} />
	<span class="text-sm font-bold text-ink">
		J’accepte les
		<a class="font-extrabold text-forest underline" href={termsUrl} onclick={openTerms}>
			conditions d’utilisation
		</a>
	</span>
</label>

{#if open}
	<dialog
		{@attach showDialog}
		class="m-auto flex h-[min(85dvh,calc(100dvh-2rem))] w-[min(56rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-[2rem] bg-paper p-4 shadow-card backdrop:bg-ink/40"
		aria-labelledby="terms-dialog-title"
		onclose={() => (open = false)}
	>
		<div class="flex shrink-0 items-center justify-between gap-3">
			<h2 id="terms-dialog-title" class="text-lg font-extrabold text-ink">Conditions d’utilisation</h2>
			<form method="dialog">
				<button class="rounded-full bg-cream px-4 py-2 text-sm font-extrabold text-ink" type="submit">
					Fermer
				</button>
			</form>
		</div>
		<iframe
			class="mt-3 min-h-0 w-full flex-1 rounded-[1.5rem] border border-ink/10 bg-paper"
			title="Conditions d’utilisation Edaya"
			src="/conditions"
		></iframe>
	</dialog>
{/if}
