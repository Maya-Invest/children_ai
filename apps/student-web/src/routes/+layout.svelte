<script lang="ts">
	import CastorGuide from '$lib/CastorGuide.svelte';
	import SchoolBackdrop from '$lib/SchoolBackdrop.svelte';
	import '../app.css';

	let { children }: { children: import('svelte').Snippet } = $props();
</script>

<svelte:head>
	<title>Edaya Spark</title>
</svelte:head>

<SchoolBackdrop />
<div class="relative z-10">
	{@render children()}
</div>
<CastorGuide />
