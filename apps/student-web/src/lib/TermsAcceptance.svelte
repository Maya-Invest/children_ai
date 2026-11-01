<script lang="ts">
	let { accepted = $bindable(false), html, disabled = false }: { accepted?: boolean; html?: string; disabled?: boolean } = $props();
	// A parent sign-in must show the very snapshot that will be acknowledged at OTP start.
	const snapshot = $derived(html ? `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>body{margin:0;padding:1rem 1.5rem;font:1rem/1.6 system-ui,sans-serif;color:#2a1810;overflow-wrap:anywhere}h1,h2{line-height:1.25}a{color:#1f6f62}</style></head><body>${html}</body></html>` : undefined);

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
	<input class="mt-1 shrink-0" type="checkbox" bind:checked={accepted} {disabled} />
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
			src={snapshot ? undefined : '/conditions'}
			srcdoc={snapshot}
			sandbox={snapshot ? 'allow-popups allow-popups-to-escape-sandbox' : undefined}
		></iframe>
	</dialog>
{/if}
