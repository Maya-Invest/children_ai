<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { getFollowHome } from '$lib/follow-home.svelte';
	import { followView } from '$lib/follow-path';
	import SchoolFollowPanel from '$lib/SchoolFollowPanel.svelte';

	let { basePath }: { basePath: string } = $props();

	const source = getFollowHome();
	let home = $derived(source.home);
	let view = $derived(
		followView(
			page.state,
			page.url.pathname,
			basePath,
			browser ? window.location.pathname : page.url.pathname,
		),
	);
</script>

<SchoolFollowPanel {home} tab={view.tab} subjectSlug={view.subjectSlug} {basePath} />
