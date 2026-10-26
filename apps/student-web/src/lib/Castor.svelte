<script lang="ts">
	let { talking = false }: { talking?: boolean } = $props();
</script>

<svg
	viewBox="0 0 96 96"
	class={['h-full w-full overflow-visible', talking && 'castor-talking']}
	aria-hidden="true"
>
	<g class="castor-tail">
		<ellipse cx="18" cy="70" rx="16" ry="9" fill="var(--doodle-ink)" opacity="0.85" />
		<path d="M8 70h20M12 66h12M12 74h12" stroke="var(--doodle-paper)" stroke-width="1.4" stroke-linecap="round" />
	</g>
	<ellipse cx="52" cy="68" rx="24" ry="16" fill="var(--doodle-gold)" />
	<ellipse cx="58" cy="40" rx="22" ry="20" fill="var(--doodle-gold)" />
	<ellipse cx="44" cy="28" rx="6" ry="7" fill="var(--doodle-ink)" />
	<ellipse cx="72" cy="28" rx="6" ry="7" fill="var(--doodle-ink)" />
	<ellipse cx="44" cy="27" rx="3" ry="4" fill="var(--doodle-accent)" />
	<ellipse cx="72" cy="27" rx="3" ry="4" fill="var(--doodle-accent)" />
	<g class="castor-blink">
		<ellipse cx="50" cy="40" rx="4.2" ry="4.6" fill="var(--doodle-ink)" />
		<ellipse cx="66" cy="40" rx="4.2" ry="4.6" fill="var(--doodle-ink)" />
		<circle cx="51.4" cy="38.6" r="1.3" fill="var(--doodle-paper)" />
		<circle cx="67.4" cy="38.6" r="1.3" fill="var(--doodle-paper)" />
	</g>
	<ellipse cx="58" cy="48" rx="7" ry="5" fill="var(--doodle-ink)" />
	<ellipse cx="56" cy="47" rx="2" ry="1.4" fill="var(--doodle-paper)" opacity="0.7" />
	<g class="castor-mouth">
		<path d="M50 54c3 6 13 6 16 0" fill="var(--doodle-accent)" />
		<rect x="55" y="54" width="3" height="5" rx="1" fill="var(--doodle-paper)" />
		<rect x="59" y="54" width="3" height="5" rx="1" fill="var(--doodle-paper)" />
	</g>
	<ellipse cx="40" cy="74" rx="6" ry="4" fill="var(--doodle-ink)" />
	<ellipse cx="66" cy="76" rx="6" ry="4" fill="var(--doodle-ink)" />
</svg>
