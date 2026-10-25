<script lang="ts">
	let { kind }: { kind: SchoolDoodleKind } = $props();

	export type SchoolDoodleKind =
		| 'book'
		| 'pencil'
		| 'apple'
		| 'star'
		| 'plane'
		| 'flask'
		| 'ruler'
		| 'globe'
		| 'backpack'
		| 'compass'
		| 'map'
		| 'microscope'
		| 'triangle'
		| 'calculator'
		| 'notebook'
		| 'atom'
		| 'setsquare'
		| 'chart'
		| 'quotation'
		| 'pen'
		| 'graph'
		| 'laurel'
		| 'diploma';
</script>

<svg viewBox="0 0 64 64" class="h-full w-full overflow-visible" aria-hidden="true">
	{#if kind === 'book'}
		<path d="M6 18c9-6 16-6 24 0v32c-8-6-15-6-24 0V18z" fill="var(--doodle-primary)" />
		<path d="M58 18c-9-6-16-6-24 0v32c8-6 15-6 24 0V18z" fill="var(--doodle-accent)" />
		<path d="M30 18h4v32h-4z" fill="var(--doodle-ink)" opacity="0.28" />
		<path
			d="M14 28h12M14 34h10M40 28h10M40 34h12"
			stroke="var(--doodle-paper)"
			stroke-width="1.6"
			stroke-linecap="round"
		/>
	{:else if kind === 'pencil'}
		<rect x="26" y="6" width="12" height="34" rx="2" fill="var(--doodle-gold)" />
		<rect x="26" y="6" width="12" height="8" rx="1" fill="var(--doodle-accent)" />
		<polygon points="26,40 38,40 32,58" fill="var(--doodle-soft)" />
		<polygon points="29,48 35,48 32,58" fill="var(--doodle-ink)" />
	{:else if kind === 'apple'}
		<circle cx="32" cy="36" r="16" fill="var(--doodle-accent)" />
		<ellipse cx="25" cy="32" rx="4" ry="7" fill="var(--doodle-paper)" opacity="0.28" />
		<path d="M32 22c1-7 8-10 13-7" fill="none" stroke="var(--doodle-primary)" stroke-width="2.4" stroke-linecap="round" />
		<path d="M33 21c7-1 12 3 13 8-6 0-10-2-13-8z" fill="var(--doodle-primary)" />
	{:else if kind === 'star'}
		<polygon points="32,4 39,23 58,24 43,37 48,56 32,46 16,56 21,37 6,24 25,23" fill="var(--doodle-gold)" />
	{:else if kind === 'plane'}
		<path d="M6 34 58 12 38 56 31 38Z" fill="var(--doodle-primary)" />
		<path d="M31 38 38 56 22 46Z" fill="var(--doodle-accent)" />
		<path d="M31 38 18 34 31 32Z" fill="var(--doodle-soft)" />
	{:else if kind === 'flask'}
		<path
			d="M26 8h12v8l8 22a16 14 0 0 1-28 0L26 16V8z"
			fill="var(--doodle-soft)"
			stroke="var(--doodle-primary)"
			stroke-width="2.2"
			stroke-linejoin="round"
		/>
		<path d="M20 40h24c-1 7-6 11-12 11s-11-4-12-11z" fill="var(--doodle-primary)" opacity="0.45" />
		<rect x="24" y="5" width="16" height="6" rx="2" fill="var(--doodle-primary)" />
	{:else if kind === 'ruler'}
		<rect x="4" y="24" width="56" height="16" rx="3" fill="var(--doodle-gold)" />
		<path
			d="M12 24v8M20 24v5M28 24v8M36 24v5M44 24v8M52 24v5"
			stroke="var(--doodle-ink)"
			stroke-width="1.6"
			stroke-linecap="round"
			opacity="0.55"
		/>
	{:else if kind === 'globe'}
		<circle cx="32" cy="32" r="20" fill="var(--doodle-soft)" stroke="var(--doodle-primary)" stroke-width="2.4" />
		<ellipse cx="32" cy="32" rx="9" ry="20" fill="none" stroke="var(--doodle-primary)" stroke-width="1.8" />
		<path d="M12 32h40M16 23h32M16 41h32" fill="none" stroke="var(--doodle-primary)" stroke-width="1.6" />
	{:else if kind === 'backpack'}
		<rect x="16" y="20" width="32" height="34" rx="10" fill="var(--doodle-accent)" />
		<path d="M24 20v-3a8 8 0 0 1 16 0v3" fill="none" stroke="var(--doodle-ink)" stroke-width="2.6" />
		<rect x="22" y="30" width="20" height="14" rx="4" fill="var(--doodle-paper)" />
		<circle cx="32" cy="37" r="2" fill="var(--doodle-accent)" />
	{:else if kind === 'compass'}
		<circle cx="32" cy="34" r="18" fill="var(--doodle-soft)" stroke="var(--doodle-primary)" stroke-width="2.4" />
		<polygon points="32,16 37,34 32,31 27,34" fill="var(--doodle-accent)" />
		<polygon points="32,52 27,34 32,37 37,34" fill="var(--doodle-primary)" />
		<circle cx="32" cy="34" r="3" fill="var(--doodle-ink)" />
	{:else if kind === 'map'}
		<path d="M8 14 24 10 40 16 56 10v40L40 56 24 48 8 54Z" fill="var(--doodle-soft)" stroke="var(--doodle-primary)" stroke-width="2" />
		<path d="M24 10v38M40 16v40" stroke="var(--doodle-primary)" stroke-width="1.6" />
		<circle cx="33" cy="32" r="3.2" fill="var(--doodle-accent)" />
	{:else if kind === 'microscope'}
		<rect x="28" y="6" width="8" height="14" rx="2" fill="var(--doodle-primary)" />
		<circle cx="32" cy="26" r="9" fill="var(--doodle-soft)" stroke="var(--doodle-primary)" stroke-width="2.2" />
		<path d="M32 35v8" stroke="var(--doodle-ink)" stroke-width="3" stroke-linecap="round" />
		<ellipse cx="32" cy="50" rx="16" ry="5" fill="var(--doodle-accent)" />
		<rect x="18" y="46" width="8" height="4" rx="1" fill="var(--doodle-primary)" />
	{:else if kind === 'triangle'}
		<polygon points="8,54 56,54 32,8" fill="var(--doodle-gold)" stroke="var(--doodle-ink)" stroke-width="2.2" stroke-linejoin="round" />
	{:else if kind === 'calculator'}
		<rect x="14" y="8" width="36" height="48" rx="6" fill="var(--doodle-primary)" />
		<rect x="20" y="14" width="24" height="10" rx="2" fill="var(--doodle-soft)" />
		<circle cx="24" cy="34" r="2.4" fill="var(--doodle-paper)" />
		<circle cx="32" cy="34" r="2.4" fill="var(--doodle-paper)" />
		<circle cx="40" cy="34" r="2.4" fill="var(--doodle-gold)" />
		<circle cx="24" cy="44" r="2.4" fill="var(--doodle-paper)" />
		<circle cx="32" cy="44" r="2.4" fill="var(--doodle-paper)" />
		<circle cx="40" cy="44" r="2.4" fill="var(--doodle-accent)" />
	{:else if kind === 'notebook'}
		<rect x="18" y="8" width="34" height="48" rx="3" fill="var(--doodle-paper)" stroke="var(--doodle-primary)" stroke-width="2.2" />
		<path d="M18 18h-7M18 28h-7M18 38h-7M18 48h-7" stroke="var(--doodle-accent)" stroke-width="2.4" stroke-linecap="round" />
		<path d="M26 22h18M26 30h16M26 38h18" stroke="var(--doodle-primary)" stroke-width="1.6" stroke-linecap="round" opacity="0.7" />
	{:else if kind === 'atom'}
		<ellipse cx="32" cy="32" rx="22" ry="8" fill="none" stroke="var(--doodle-primary)" stroke-width="2" transform="rotate(60 32 32)" />
		<ellipse cx="32" cy="32" rx="22" ry="8" fill="none" stroke="var(--doodle-primary)" stroke-width="2" transform="rotate(-60 32 32)" />
		<ellipse cx="32" cy="32" rx="22" ry="8" fill="none" stroke="var(--doodle-accent)" stroke-width="2" />
		<circle cx="32" cy="32" r="4" fill="var(--doodle-accent)" />
	{:else if kind === 'setsquare'}
		<polygon points="8,54 56,54 56,12" fill="var(--doodle-gold)" stroke="var(--doodle-ink)" stroke-width="2.2" stroke-linejoin="round" />
		<path d="M16 54v-6M24 54v-4M32 54v-6M40 54v-4M48 54v-6" stroke="var(--doodle-ink)" stroke-width="1.4" opacity="0.45" />
	{:else if kind === 'chart'}
		<rect x="12" y="36" width="10" height="16" rx="1" fill="var(--doodle-primary)" />
		<rect x="27" y="24" width="10" height="28" rx="1" fill="var(--doodle-accent)" />
		<rect x="42" y="14" width="10" height="38" rx="1" fill="var(--doodle-primary)" />
	{:else if kind === 'quotation'}
		<path
			d="M8 28c0-8 6-14 14-14v8c-4 0-6 3-6 6h6v14H8V28zm26 0c0-8 6-14 14-14v8c-4 0-6 3-6 6h6v14H34V28z"
			fill="var(--doodle-accent)"
		/>
	{:else if kind === 'pen'}
		<path d="M42 8 52 18 24 52 12 54 14 42Z" fill="var(--doodle-primary)" />
		<path d="M42 8 52 18 46 24 36 14Z" fill="var(--doodle-accent)" />
		<path d="M14 42 24 52" stroke="var(--doodle-ink)" stroke-width="1.6" stroke-linecap="round" />
	{:else if kind === 'graph'}
		<path d="M12 52V10M12 52h42" stroke="var(--doodle-ink)" stroke-width="2.4" stroke-linecap="round" />
		<path d="M16 42 28 30 38 36 52 16" fill="none" stroke="var(--doodle-accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
	{:else if kind === 'laurel'}
		<path d="M32 56V12" stroke="var(--doodle-primary)" stroke-width="2" stroke-linecap="round" />
		<ellipse cx="22" cy="22" rx="8" ry="4" fill="var(--doodle-primary)" transform="rotate(-40 22 22)" />
		<ellipse cx="42" cy="22" rx="8" ry="4" fill="var(--doodle-primary)" transform="rotate(40 42 22)" />
		<ellipse cx="20" cy="34" rx="8" ry="4" fill="var(--doodle-gold)" transform="rotate(-50 20 34)" />
		<ellipse cx="44" cy="34" rx="8" ry="4" fill="var(--doodle-gold)" transform="rotate(50 44 34)" />
		<ellipse cx="22" cy="46" rx="7" ry="3.5" fill="var(--doodle-primary)" transform="rotate(-35 22 46)" />
		<ellipse cx="42" cy="46" rx="7" ry="3.5" fill="var(--doodle-primary)" transform="rotate(35 42 46)" />
	{:else}
		<rect x="8" y="16" width="48" height="26" rx="3" fill="var(--doodle-paper)" stroke="var(--doodle-gold)" stroke-width="2.4" />
		<path d="M18 28h28M18 34h20" stroke="var(--doodle-primary)" stroke-width="1.6" stroke-linecap="round" />
		<path d="M24 42c0 8 16 8 16 0" fill="var(--doodle-gold)" />
		<circle cx="32" cy="50" r="4" fill="var(--doodle-accent)" />
	{/if}
</svg>
