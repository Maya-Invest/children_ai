<script lang="ts">
	import { page } from '$app/state';
	import FollowPanelPage from '$lib/FollowPanelPage.svelte';

	let basePath = $derived(`/parent/children/${page.params.id}`);
</script>

<FollowPanelPage {basePath} />
