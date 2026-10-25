<script lang="ts">
	import SetDraftHost from '$lib/SetDraftHost.svelte';
	import type { ExerciseSet } from '$lib/types';

	let { data, children }: { data: { set: ExerciseSet }; children: import('svelte').Snippet } = $props();
</script>

{#key data.set.id}
	<SetDraftHost>
		{@render children()}
	</SetDraftHost>
{/key}
