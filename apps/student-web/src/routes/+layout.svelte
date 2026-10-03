<script lang="ts">
	import '../app.css';

	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<svelte:head>
	<title>Edaya Spark</title>
</svelte:head>

{@render children()}
