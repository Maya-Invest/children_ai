<script lang="ts">
	import SchoolDoodle from '$lib/SchoolDoodle.svelte';
	import { connectedScene } from '$lib/grade-scene.svelte';
	import { schoolScene } from '$lib/school-scenes';

	const scene = $derived(schoolScene(connectedScene()));
	const wash = $derived(
		`radial-gradient(1200px 500px at 10% -10%, ${scene.washA} 0%, transparent 55%), radial-gradient(900px 420px at 100% 0%, ${scene.washB} 0%, transparent 50%), ${scene.paper}`,
	);
</script>

<div
	class="pointer-events-none fixed inset-0 z-0 overflow-hidden"
	style:background={wash}
	style:--doodle-primary={scene.ink.primary}
	style:--doodle-accent={scene.ink.accent}
	style:--doodle-paper={scene.ink.paper}
	style:--doodle-ink={scene.ink.ink}
	style:--doodle-gold={scene.ink.gold}
	style:--doodle-soft={scene.ink.soft}
	aria-hidden="true"
>
	{#each scene.pieces as piece (piece.id)}
		<span class="school-float absolute opacity-90 {piece.className}" style={piece.style}>
			<SchoolDoodle kind={piece.kind} />
		</span>
	{/each}
</div>
