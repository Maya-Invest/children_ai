<script lang="ts">
	import ConnectedGrade from '$lib/ConnectedGrade.svelte';
	import type { GuardianChildView, HomePayload } from '$lib/types';

	let { data, children }: {
		data: { home: Promise<HomePayload & { child: GuardianChildView }> };
		children: import('svelte').Snippet;
	} = $props();
</script>

<ConnectedGrade home={data.home} />
{@render children()}
