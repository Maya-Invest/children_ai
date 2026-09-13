<script lang="ts">
	import '../app.css';

	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<svelte:head>
	<title>Children AI</title>
</svelte:head>

{@render children()}
