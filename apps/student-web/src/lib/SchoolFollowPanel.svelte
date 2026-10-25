<script lang="ts">
	import { openFollow } from '$lib/follow-nav';
	import SubjectSplitAccordion from '$lib/SubjectSplitAccordion.svelte';
	import { subjectFromSlug, subjectSlugs } from '$lib/subject-path';
	import { formatMarkDate, groupClassProgress, groupMarksBySubject, groupTimetable } from '$lib/timetable';
	import type { HomePayload, Mark } from '$lib/types';

	let {
		home,
		tab,
		subjectSlug = '',
		basePath,
	}: {
		home: HomePayload;
		tab: 'timetable' | 'progress' | 'marks';
		subjectSlug?: string;
		basePath: string;
	} = $props();

	let classLabel = $derived(home.student.classLabel);
	let weekDays = $derived(groupTimetable(home.timetable ?? [], home.planningDate));
	let progressGroups = $derived(groupClassProgress(home.classProgress ?? []));
	let markGroups = $derived(groupMarksBySubject(home.marks ?? []));
	let attendanceLabel = $derived(
		home.attendance ? `${Math.round(home.attendance.presentRate * 100)} %` : '—',
	);
	let rankLabel = $derived(home.rank ? `${home.rank.rank}e / ${home.rank.classSize}` : '—');
	let averageLabel = $derived(
		home.rank ? home.rank.overallAverage.toLocaleString('fr-CI', { maximumFractionDigits: 1 }) : '—',
	);
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
	let progressSlugs = $derived(subjectSlugs(progressGroups.map((group) => group.subject)));
	let markSlugs = $derived(subjectSlugs(markGroups.map((group) => group.subject)));
	let selectedProgress = $derived(subjectFromSlug(progressSlugs.map((entry) => entry.label), subjectSlug) ?? '');
	let selectedMarks = $derived(subjectFromSlug(markSlugs.map((entry) => entry.label), subjectSlug) ?? '');
	let progressHref = $derived(
		tab === 'progress' && subjectSlug ? `${basePath}/avancement/${subjectSlug}` : `${basePath}/avancement`,
	);
	let marksHref = $derived(tab === 'marks' && subjectSlug ? `${basePath}/notes/${subjectSlug}` : `${basePath}/notes`);

	function tabClass(active: boolean) {
		return [
			'rounded-full px-4 py-2 text-sm font-extrabold',
			active ? 'bg-forest text-white' : 'bg-white text-ink ring-1 ring-ink/10',
		];
	}

	function subjectHref(section: 'avancement' | 'notes', labels: { label: string; slug: string }[], subject: string) {
		const slug = labels.find((entry) => entry.label === subject)?.slug;
		return slug ? `${basePath}/${section}/${slug}` : `${basePath}/${section}`;
	}
</script>

<section class="mt-6 rounded-[2rem] bg-paper p-6 shadow-card">
	<nav class="flex flex-wrap items-center justify-between gap-3" aria-label="Emploi du temps, avancement et notes">
		<div class="flex flex-wrap gap-2">
			<a
				class={tabClass(tab === 'timetable')}
				href={basePath}
				aria-current={tab === 'timetable' ? 'page' : undefined}
				onclick={(event) => openFollow(event, basePath, basePath)}
			>
				Emploi du temps
			</a>
			<a
				class={tabClass(tab === 'progress')}
				href={progressHref}
				aria-current={tab === 'progress' ? 'page' : undefined}
				onclick={(event) => openFollow(event, progressHref, basePath)}
			>
				Avancement
			</a>
			<a
				class={tabClass(tab === 'marks')}
				href={marksHref}
				aria-current={tab === 'marks' ? 'page' : undefined}
				onclick={(event) => openFollow(event, marksHref, basePath)}
			>
				Dernières notes
			</a>
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
	</nav>

	{#if tab === 'timetable'}
		<div>
			<p class="mt-3 text-sm font-bold text-ink/50">Semaine type · {classLabel}</p>
			{#if weekDays.length === 0}
				<p class="mt-4 text-ink/70">Aucun emploi du temps n’est encore publié pour cette classe.</p>
			{:else}
				<div class="mt-4 grid gap-2 sm:grid-cols-5">
					{#each weekDays as day (day.id)}
						<div
							class={['rounded-2xl p-3', day.isToday ? 'bg-forest/10 ring-2 ring-forest/20' : 'bg-cream']}
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
		<div>
			{#if progressGroups.length === 0}
				<p class="mt-4 text-ink/70">Aucun avancement de classe n’est encore disponible.</p>
			{:else}
				<SubjectSplitAccordion
					groups={progressAccordionGroups}
					navLabel="Matières"
					idPrefix="school-follow-matters"
					selectedSubject={selectedProgress}
					collapseHref="{basePath}/avancement"
					hrefFor={(subject) => subjectHref('avancement', progressSlugs, subject)}
					onNavigate={(event, href) => openFollow(event, href, basePath)}
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
		<div>
			{#if markGroups.length === 0}
				<p class="mt-4 text-ink/70">Aucune note pour le moment.</p>
			{:else}
				<SubjectSplitAccordion
					groups={marksAccordionGroups}
					navLabel="Matières"
					idPrefix="school-follow-marks"
					selectedSubject={selectedMarks}
					collapseHref="{basePath}/notes"
					hrefFor={(subject) => subjectHref('notes', markSlugs, subject)}
					onNavigate={(event, href) => openFollow(event, href, basePath)}
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
