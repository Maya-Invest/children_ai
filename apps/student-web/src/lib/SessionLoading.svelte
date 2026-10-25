<script lang="ts">
	let {
		title = 'Préparation de ta séance',
		detail = 'Le programme du jour est en cours de lecture.',
	}: {
		title?: string;
		detail?: string;
	} = $props();
</script>

<div
	class="fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#fbf4e8] px-6 text-center"
	role="status"
	aria-live="polite"
	aria-busy="true"
>
	<span
		class="size-11 animate-spin rounded-full border-4 border-ink/10 border-t-clay motion-reduce:animate-none"
		aria-hidden="true"
	></span>
	<p class="mt-6 text-2xl font-extrabold text-ink">{title}</p>
	<p class="mt-2 max-w-sm text-ink/70">{detail}</p>
</div>
