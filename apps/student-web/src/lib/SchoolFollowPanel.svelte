<script lang="ts">
	import SubjectSplitAccordion from '$lib/SubjectSplitAccordion.svelte';
	import { formatMarkDate, type MarkGroup, type ProgressGroup, type WeekDay } from '$lib/timetable';
	import type { Mark } from '$lib/types';

	let {
		classLabel,
		attendanceLabel,
		weekDays,
		progressGroups,
		markGroups,
		rankLabel,
		averageLabel,
	}: {
		classLabel: string;
		attendanceLabel: string;
		weekDays: WeekDay[];
		progressGroups: ProgressGroup[];
		markGroups: MarkGroup[];
		rankLabel: string;
		averageLabel: string;
	} = $props();

	let tab = $state<'timetable' | 'progress' | 'marks'>('timetable');

	let progressAccordionGroups = $derived(
		progressGroups.map((group) => ({
			subject: group.subject,
			headerLabel: `${group.average} %`,
			items: group.items,
		})),
	);

	let marksAccordionGroups = $derived(
		markGroups.map((group) => ({
			subject: group.subject,
			headerLabel: `${group.average.toLocaleString('fr-CI', { maximumFractionDigits: 1 })} / 20`,
			items: group.items,
		})),
	);

	function tabClass(active: boolean) {
		return [
			'rounded-full px-4 py-2 text-sm font-extrabold',
			active ? 'bg-forest text-white' : 'bg-white text-ink ring-1 ring-ink/10',
		];
	}
</script>

<section class="mt-6 rounded-[2rem] bg-paper p-6 shadow-card">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div
			class="flex flex-wrap gap-2"
			role="tablist"
			aria-label="Emploi du temps, avancement et notes"
		>
			<button
				id="school-follow-tab-timetable"
				class={tabClass(tab === 'timetable')}
				type="button"
				role="tab"
				aria-selected={tab === 'timetable'}
				aria-controls="school-follow-panel-timetable"
				onclick={() => (tab = 'timetable')}
			>
				Emploi du temps
			</button>
			<button
				id="school-follow-tab-progress"
				class={tabClass(tab === 'progress')}
				type="button"
				role="tab"
				aria-selected={tab === 'progress'}
				aria-controls="school-follow-panel-progress"
				onclick={() => (tab = 'progress')}
			>
				Avancement
			</button>
			<button
				id="school-follow-tab-marks"
				class={tabClass(tab === 'marks')}
				type="button"
				role="tab"
				aria-selected={tab === 'marks'}
				aria-controls="school-follow-panel-marks"
				onclick={() => (tab = 'marks')}
			>
				Dernières notes
			</button>
		</div>
		{#if tab === 'timetable'}
			<div class="shrink-0 text-right">
				<p class="text-xs font-bold text-ink/50">Présence</p>
				<p class="text-lg font-extrabold text-forest">{attendanceLabel}</p>
			</div>
		{:else if tab === 'marks'}
			<div class="shrink-0 text-right">
				<p class="text-sm font-bold text-ink/50">Rang</p>
				<p class="mt-1 text-xl font-extrabold text-forest">{rankLabel}</p>
				<p class="mt-1 text-sm font-bold text-ink/60">Moyenne {averageLabel}</p>
			</div>
		{/if}
	</div>

	{#if tab === 'timetable'}
		<div
			id="school-follow-panel-timetable"
			role="tabpanel"
			aria-labelledby="school-follow-tab-timetable"
		>
			<p class="mt-3 text-sm font-bold text-ink/50">Semaine type · {classLabel}</p>
			{#if weekDays.length === 0}
				<p class="mt-4 text-ink/70">Aucun emploi du temps n’est encore publié pour cette classe.</p>
			{:else}
				<div class="mt-4 grid gap-2 sm:grid-cols-5">
					{#each weekDays as day (day.id)}
						<div
							class={[
								'rounded-2xl p-3',
								day.isToday ? 'bg-forest/10 ring-2 ring-forest/20' : 'bg-cream',
							]}
							aria-current={day.isToday ? 'date' : undefined}
						>
							<p class="text-sm font-extrabold text-forest">{day.label}</p>
							{#if day.slots.length === 0}
								<p class="mt-2 text-sm font-bold text-ink/40">—</p>
							{:else}
								<ul class="mt-2 space-y-2">
									{#each day.slots as slot (slot.id)}
										<li>
											<p class="text-xs font-bold text-ink/50">{slot.startTime} – {slot.endTime}</p>
											<p class="text-sm font-extrabold leading-snug text-ink">{slot.title}</p>
											{#if slot.kind === 'activity'}
												<p class="text-xs font-bold text-clay">Activité</p>
											{/if}
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else if tab === 'progress'}
		<div
			id="school-follow-panel-progress"
			role="tabpanel"
			aria-labelledby="school-follow-tab-progress"
		>
			{#if progressGroups.length === 0}
				<p class="mt-4 text-ink/70">Aucun avancement de classe n’est encore disponible.</p>
			{:else}
				<SubjectSplitAccordion
					groups={progressAccordionGroups}
					navLabel="Matières"
					idPrefix="school-follow-matters"
				>
					{#snippet item(entry)}
						<div class="flex items-center justify-between gap-3">
							<span class="text-sm font-bold text-ink/70">{entry.subjectMatter}</span>
							<span class="text-sm font-extrabold text-forest">{entry.completedPercentage} %</span>
						</div>
						<div class="mt-2 h-2 overflow-hidden rounded-full bg-cream">
							<div
								class="h-2 rounded-full bg-forest"
								style:width={`${Math.min(100, Math.max(0, entry.completedPercentage))}%`}
							></div>
						</div>
					{/snippet}
				</SubjectSplitAccordion>
			{/if}
		</div>
	{:else}
		<div
			id="school-follow-panel-marks"
			role="tabpanel"
			aria-labelledby="school-follow-tab-marks"
		>
			{#if markGroups.length === 0}
				<p class="mt-4 text-ink/70">Aucune note pour le moment.</p>
			{:else}
				<SubjectSplitAccordion
					groups={marksAccordionGroups}
					navLabel="Matières"
					idPrefix="school-follow-marks"
				>
					{#snippet item(mark: Mark)}
						<div class="flex items-center justify-between gap-3">
							<div>
								<p class="font-bold">{mark.title}</p>
								<p class="text-sm font-bold text-ink/50">{formatMarkDate(mark.date)}</p>
							</div>
							<span class="font-extrabold text-forest">{mark.score}/{mark.maxScore}</span>
						</div>
					{/snippet}
				</SubjectSplitAccordion>
			{/if}
		</div>
	{/if}
</section>
