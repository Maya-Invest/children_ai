<script lang="ts">
	import { resolve } from '$app/paths';
	import ResultFilterBar from '$lib/ResultFilterBar.svelte';
	import SchoolFollowPanel from '$lib/SchoolFollowPanel.svelte';
	import { summarizePractice } from '$lib/revision-stats';
	import { filterByResult, resultCounts, type ResultFilter } from '$lib/result-filter';
	import { formatMarkDate, groupClassProgress, groupMarksBySubject, groupTimetable } from '$lib/timetable';
	import type { ExerciseSet, HomePayload, Question } from '$lib/types';

	type ListedExercise = {
		id: string;
		title: string;
		detail: string;
		status: string;
		setId: string | null;
		submitted: boolean;
		correctionReleased: boolean;
		hasCorrection: boolean;
		hasAnyAnswer: boolean;
		set: ExerciseSet | null;
	};

	let {
		home,
		onGenerate,
		onReleaseCorrection,
	}: {
		home: HomePayload;
		onGenerate?: () => Promise<void> | void;
		onReleaseCorrection?: (setId: string) => Promise<void> | void;
	} = $props();

	let student = $derived(home.student);
	let pending = $state(false);
	let releasingId = $state('');
	let releasingAll = $state(false);
	let viewingSetId = $state<string | null>(null);
	let resultFilter = $state<ResultFilter>('all');
	let error = $state('');
	let isGuardian = $derived(home.actor.role === 'guardian');
	let timetable = $derived(home.timetable ?? []);
	let classProgress = $derived(home.classProgress ?? []);
	let progressGroups = $derived(groupClassProgress(classProgress));
	let programmeLine = $derived(
		home.programmeLine || `${student.classLabel} · Programme officiel DPFC`,
	);
	let observations = $derived(home.observations ?? []);
	let weekDays = $derived(groupTimetable(timetable));
	let attendanceLabel = $derived(
		home.attendance ? `${Math.round(home.attendance.presentRate * 100)} %` : '—',
	);
	let markGroups = $derived(groupMarksBySubject(home.marks ?? []));
	let rankLabel = $derived(home.rank ? `${home.rank.rank}e / ${home.rank.classSize}` : '—');
	let averageLabel = $derived(
		home.rank
			? home.rank.overallAverage.toLocaleString('fr-CI', { maximumFractionDigits: 1 })
			: '—',
	);
	let snapshotLabel = $derived(formatMarkDate(home.snapshot.createdAt));
	let practice = $derived(summarizePractice(home.history, home.currentSet));
	let seriesHint = $derived(
		practice.openCount > 0
			? `${practice.openCount} en cours`
			: practice.submittedCount === 0
				? 'Pas encore commencé'
				: practice.submittedCount === 1
					? 'série terminée'
					: 'séries terminées',
	);
	let successValue = $derived(
		practice.successPercent !== null
			? `${practice.successPercent} %`
			: practice.pendingCorrectionCount > 0
				? 'En attente'
				: '—',
	);
	let successHint = $derived(
		practice.successPercent !== null
			? 'sur les corrigés'
			: practice.pendingCorrectionCount > 0
				? 'Corrigé à ouvrir'
				: 'Après le corrigé',
	);
	let questionsValue = $derived(
		practice.questionsWorked > 0
			? String(practice.questionsWorked)
			: practice.questionsOpen > 0
				? String(practice.questionsOpen)
				: '0',
	);
	let questionsHint = $derived(
		practice.questionsWorked > 0
			? 'travaillées'
			: practice.questionsOpen > 0
				? 'dans la série'
				: 'travaillées',
	);
	let lastActivityValue = $derived(
		practice.lastPracticeAt ? formatMarkDate(practice.lastPracticeAt) : '—',
	);
	let currentSet = $derived(home.currentSet);
	let canStudentGenerate = $derived(!isGuardian && Boolean(onGenerate));
	let generateEnabled = $derived(canStudentGenerate && home.canGenerate);
	let listedExercises = $derived.by((): ListedExercise[] => {
		const title = home.focusSubject
			? `${home.focusSubject} · ${home.lessonTitle}`
			: home.lessonTitle;
		const items: ListedExercise[] = [];
		const seen: Record<string, true> = {};

		if (currentSet) {
			items.push(toListedExercise(currentSet, title));
			seen[currentSet.id] = true;
		} else {
			items.push({
				id: `new-${home.focus.lessonId}`,
				title,
				detail: questionDetail(0),
				status: 'À préparer',
				setId: null,
				submitted: false,
				correctionReleased: false,
				hasCorrection: false,
				hasAnyAnswer: false,
				set: null,
			});
		}

		for (const set of home.history ?? []) {
			if (seen[set.id]) continue;
			seen[set.id] = true;
			items.push(toListedExercise(set, `Série du ${formatMarkDate(set.generatedAt)}`));
		}

		return items;
	});
	let viewingExercise = $derived(
		listedExercises.find((item) => item.setId === viewingSetId) ?? null,
	);
	let viewingSet = $derived(viewingExercise?.set ?? null);
	let viewingHasCorrection = $derived(viewingExercise?.hasCorrection ?? false);
	let viewingHasAnyAnswer = $derived(viewingExercise?.hasAnyAnswer ?? false);
	let viewingSubmitted = $derived(viewingExercise?.submitted ?? false);
	let correctionCounts = $derived(resultCounts(viewingSet?.questions ?? []));
	let visibleCorrectionQuestions = $derived(
		filterByResult(viewingSet?.questions ?? [], resultFilter),
	);
	let pendingCorrectionIds = $derived(
		listedExercises
			.filter(
				(item) =>
					Boolean(item.setId)
					&& item.submitted
					&& item.hasAnyAnswer
					&& item.hasCorrection
					&& !item.correctionReleased,
			)
			.map((item) => item.setId)
			.filter((setId): setId is string => Boolean(setId)),
	);

	function questionDetail(count: number) {
		if (count > 0) {
			return `${count} question${count > 1 ? 's' : ''} · QCM et réponses rédigées`;
		}
		return '4 à 6 questions · QCM et réponses rédigées';
	}

	function hasCompleteCorrection(set: ExerciseSet): boolean {
		return (
			set.questions.length > 0
			&& set.questions.every((question) => Boolean(question.expectedAnswer?.trim()))
		);
	}

	function hasAnyAnswer(set: ExerciseSet): boolean {
		return (set.answers ?? []).some((answer) => answer.value.trim().length > 0);
	}

	function setStatus(set: ExerciseSet, hasCorrection: boolean, hasAnswer: boolean) {
		if (!set.submittedAt) {
			if (hasAnswer) return 'En cours';
			return isGuardian ? `${student.firstName} n’a pas encore répondu` : 'Pas débuté';
		}
		if (!hasAnswer) return 'Aucune réponse enregistrée';
		if (!set.correctionReleasedAt) return 'En attente du corrigé';
		if (hasCorrection) return 'Corrigé ouvert';
		return 'Ancienne série · corrigé indisponible';
	}

	function toListedExercise(set: ExerciseSet, title: string): ListedExercise {
		const hasCorrection = hasCompleteCorrection(set);
		const hasAnswer = hasAnyAnswer(set);
		return {
			id: set.id,
			title,
			detail: questionDetail(set.questions.length),
			status: setStatus(set, hasCorrection, hasAnswer),
			setId: set.id,
			submitted: Boolean(set.submittedAt),
			correctionReleased: Boolean(set.correctionReleasedAt),
			hasCorrection,
			hasAnyAnswer: hasAnswer,
			set,
		};
	}

	function answerFor(set: ExerciseSet, questionId: string): string {
		const value = set.answers?.find((answer) => answer.questionId === questionId)?.value;
		return value?.trim() ? value : '—';
	}

	function questionTone(item: Question): string {
		if (item.answered === false) return 'border-2 border-ink/20 bg-cream';
		if (item.correct === true) return 'border-2 border-forest/40 bg-forest/10';
		if (item.correct === false) return 'border-2 border-clay bg-clay/15';
		return 'border-2 border-transparent bg-cream';
	}

	function closeCorrection() {
		viewingSetId = null;
		resultFilter = 'all';
	}

	function openCorrection(setId: string | null) {
		if (!setId) return;
		resultFilter = 'all';
		viewingSetId = setId;
	}

	function onWindowKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && viewingSetId) closeCorrection();
	}

	async function generate() {
		if (!home.canGenerate || !onGenerate) return;
		pending = true;
		error = '';
		try {
			await onGenerate();
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Génération impossible';
		} finally {
			pending = false;
		}
	}

	async function generateCorrection(setId: string) {
		if (!setId || !onReleaseCorrection) return;
		releasingId = setId;
		error = '';
		try {
			await onReleaseCorrection(setId);
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Impossible de générer la correction';
		} finally {
			releasingId = '';
		}
	}

	async function generateAllCorrections() {
		if (!onReleaseCorrection || pendingCorrectionIds.length === 0) return;
		const ids = [...pendingCorrectionIds];
		releasingAll = true;
		error = '';
		try {
			for (const setId of ids) {
				await onReleaseCorrection(setId);
			}
		} catch (caught) {
			error = caught instanceof Error ? caught.message : 'Impossible de générer les corrections';
		} finally {
			releasingAll = false;
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<section class="rounded-[2rem] bg-paper p-6 shadow-card sm:p-10">
	<div class="flex items-center justify-between gap-3">
		<p class="text-sm font-extrabold uppercase tracking-[0.18em] text-forest">
			{isGuardian ? `Espace parent · ${student.firstName}` : 'Espace élève'}
		</p>
		<p class="shrink-0 text-right text-xs font-bold text-ink/40">Snapshot · {snapshotLabel}</p>
	</div>
	<h1 class="mt-2 text-4xl font-extrabold text-ink">
		{isGuardian ? `Le suivi de ${student.firstName}` : `Bonjour ${student.firstName}`}
	</h1>
	<p class="mt-3 max-w-2xl text-lg text-ink/70">
		{programmeLine}
	</p>

	<div
		class="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-[minmax(0,1.25fr)_repeat(4,minmax(0,1fr))]"
	>
		<div class="col-span-2 rounded-2xl bg-cream p-4 lg:col-span-1">
			<p class="text-sm font-bold text-ink/50">Focus suggéré</p>
			{#if home.focusSubject}
				<p class="mt-1 text-xs font-extrabold uppercase tracking-wide text-forest">{home.focusSubject}</p>
			{/if}
			<p class="mt-1 text-xl font-extrabold">{home.lessonTitle}</p>
		</div>
		<div class="min-w-0 rounded-2xl bg-cream p-4">
			<p class="text-sm font-bold text-ink/50">Révisions</p>
			<p class="mt-1 text-xl font-extrabold">{practice.submittedCount}</p>
			<p class="mt-1 text-sm font-bold text-ink/60">{seriesHint}</p>
		</div>
		<div class="min-w-0 rounded-2xl bg-cream p-4">
			<p class="text-sm font-bold text-ink/50">Réussite</p>
			<p class="mt-1 text-xl font-extrabold">{successValue}</p>
			<p class="mt-1 text-sm font-bold text-ink/60">{successHint}</p>
		</div>
		<div class="min-w-0 rounded-2xl bg-cream p-4">
			<p class="text-sm font-bold text-ink/50">Questions</p>
			<p class="mt-1 text-xl font-extrabold">{questionsValue}</p>
			<p class="mt-1 text-sm font-bold text-ink/60">{questionsHint}</p>
		</div>
		<div class="min-w-0 rounded-2xl bg-cream p-4">
			<p class="text-sm font-bold text-ink/50">Dernière activité</p>
			<p class="mt-1 break-words text-xl font-extrabold">{lastActivityValue}</p>
			<p class="mt-1 text-sm font-bold text-ink/60">sur la plateforme</p>
		</div>
	</div>

	<p class="mt-6 text-ink/80">{home.focus.rationale}</p>

	<div class="mt-8 flex flex-wrap gap-3">
		{#if canStudentGenerate}
			<button
				class="rounded-full bg-clay px-6 py-3 text-lg font-extrabold text-white disabled:opacity-60"
				onclick={generate}
				disabled={!generateEnabled || pending}
				type="button"
			>
				{pending ? 'Préparation…' : 'Tout générer'}
			</button>
		{/if}
		{#if !isGuardian}
			<a
				class="rounded-full bg-white px-6 py-3 text-lg font-extrabold text-ink"
				href={resolve('/app/history')}
			>
				Voir l’historique
			</a>
		{/if}
	</div>
	{#if isGuardian && !home.currentSet}
		<p class="mt-4 text-sm font-bold text-ink/60">
			Aucun ensemble pour le moment. Seul {student.firstName} peut en demander un.
		</p>
	{/if}

	<div
		class={[
			'relative mt-8 overflow-hidden rounded-[1.75rem] bg-forest/[0.06] p-4 ring-1 ring-forest/10 sm:p-5',
			viewingSet ? 'min-h-[28rem]' : '',
		]}
	>
		<div class="flex flex-wrap items-center justify-between gap-3">
			<p class="text-xs font-extrabold uppercase tracking-[0.16em] text-forest">Exercices de révision</p>
			{#if isGuardian && pendingCorrectionIds.length > 0}
				<button
					class="shrink-0 rounded-full bg-clay px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50"
					type="button"
					disabled={!onReleaseCorrection || releasingAll || Boolean(releasingId)}
					onclick={generateAllCorrections}
				>
					{releasingAll ? 'Ouverture…' : 'Ouvrir tous les corrigés'}
				</button>
			{/if}
		</div>
		<ul class="mt-4 space-y-2">
			{#each listedExercises as exercise, index (exercise.id)}
				<li class="flex items-center gap-3 rounded-2xl bg-paper px-3 py-3 shadow-sm">
					<span
						class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest text-sm font-extrabold text-white"
					>
						{index + 1}
					</span>
					<div class="min-w-0 flex-1">
						<p class="text-sm font-extrabold text-ink">{exercise.title}</p>
						<p class="mt-0.5 text-xs font-bold text-ink/45">{exercise.detail}</p>
						<p class="mt-0.5 text-xs font-extrabold text-forest">{exercise.status}</p>
					</div>
					<div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
						{#if !isGuardian}
							{#if exercise.setId && !exercise.correctionReleased}
								<a
									class="rounded-full bg-white px-3 py-2 text-xs font-extrabold text-ink ring-1 ring-ink/10"
									href={resolve('/app/sets/[id]', { id: exercise.setId })}
								>
									{exercise.submitted ? 'Voir mes réponses' : 'Répondre'}
								</a>
							{:else if !exercise.setId}
								<button
									class="rounded-full bg-clay px-3 py-2 text-xs font-extrabold text-white disabled:opacity-60"
									onclick={generate}
									disabled={!generateEnabled || pending}
									type="button"
								>
									{pending ? 'Préparation…' : 'Générer'}
								</button>
							{/if}
						{/if}
						{#if exercise.setId && isGuardian}
							<button
								class="rounded-full bg-forest px-3 py-2 text-xs font-extrabold text-white"
								type="button"
								onclick={() => openCorrection(exercise.setId)}
							>
								{exercise.hasCorrection ? 'Voir le corrigé' : 'Voir la série'}
							</button>
							{#if exercise.submitted
								&& exercise.hasAnyAnswer
								&& exercise.hasCorrection
								&& !exercise.correctionReleased}
								<button
									class="rounded-full bg-clay px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50"
									type="button"
									disabled={!onReleaseCorrection
										|| releasingAll
										|| releasingId === exercise.setId}
									onclick={() => {
										const setId = exercise.setId;
										if (setId) void generateCorrection(setId);
									}}
								>
									{releasingId === exercise.setId ? 'Ouverture…' : 'Ouvrir à l’élève'}
								</button>
							{/if}
						{:else if exercise.setId && exercise.correctionReleased}
							<button
								class="rounded-full bg-forest px-3 py-2 text-xs font-extrabold text-white"
								type="button"
								onclick={() => openCorrection(exercise.setId)}
							>
								Voir la correction
							</button>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
		{#if viewingSet}
			{@const openSet = viewingSet}
			<div
				class="absolute inset-0 z-10 flex flex-col overflow-hidden rounded-[1.75rem] bg-paper p-4 shadow-card sm:p-5"
				role="dialog"
				aria-modal="true"
				aria-labelledby="correction-title"
			>
				<div class="shrink-0 rounded-xl border-2 border-clay bg-paper px-3 py-2">
					<div class="flex flex-wrap items-center gap-2">
						<div class="min-w-0 flex-1">
							<p class="text-[10px] font-extrabold uppercase tracking-[0.14em] text-forest">
								{viewingHasCorrection ? 'Corrigé' : 'Série'}
							</p>
							<h3 id="correction-title" class="mt-0.5 truncate text-sm font-extrabold text-ink">
								{viewingExercise?.title ?? 'Correction'}
							</h3>
						</div>
						{#if openSet.score}
							<p
								class="shrink-0 rounded-lg border-2 border-clay px-2.5 py-1 text-sm font-extrabold text-clay"
							>
								Score : {openSet.score.correct} / {openSet.score.total}
							</p>
						{:else if !viewingHasCorrection}
							<p class="shrink-0 rounded-lg bg-cream px-2.5 py-1 text-sm font-extrabold text-ink/70">
								Corrigé indisponible
							</p>
						{:else if viewingSubmitted && !viewingHasAnyAnswer}
							<p class="shrink-0 rounded-lg bg-cream px-2.5 py-1 text-sm font-extrabold text-ink/70">
								Aucune réponse
							</p>
						{:else if !viewingSubmitted}
							<p class="shrink-0 rounded-lg bg-cream px-2.5 py-1 text-sm font-extrabold text-ink/70">
								Pas encore terminé
							</p>
						{/if}
						<button
							class="shrink-0 rounded-full bg-cream px-2.5 py-1.5 text-[11px] font-extrabold text-ink"
							type="button"
							onclick={closeCorrection}
						>
							Fermer
						</button>
					</div>
					{#if !viewingHasCorrection}
						<p class="mt-2 rounded-lg bg-cream px-3 py-2 text-xs font-bold text-ink/70">
							Cette ancienne série ne contient pas les réponses attendues nécessaires au corrigé.
						</p>
					{/if}
					{#if viewingSubmitted && viewingHasCorrection}
						<ResultFilterBar
							compact
							value={resultFilter}
							correctCount={correctionCounts.correct}
							incorrectCount={correctionCounts.incorrect}
							unansweredCount={correctionCounts.unanswered}
							total={correctionCounts.total}
							onSelect={(next) => (resultFilter = next)}
						/>
					{/if}
				</div>
				<div class="mt-3 min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
					{#if visibleCorrectionQuestions.length === 0}
						<p class="font-bold text-ink/60">Aucune question dans ce filtre.</p>
					{:else}
						<ul class="space-y-3">
							{#each visibleCorrectionQuestions as item (item.id)}
								<li class={['rounded-2xl px-4 py-3', questionTone(item)]}>
									<p class="font-bold">{item.prompt}</p>
									{#if item.answered === false}
										<span class="mt-2 inline-flex rounded-full bg-ink/60 px-3 py-1 text-xs font-extrabold text-white">
											Non répondu
										</span>
									{:else if item.correct === true}
										<span class="mt-2 inline-flex rounded-full bg-forest px-3 py-1 text-xs font-extrabold text-white">Juste</span>
									{:else if item.correct === false}
										<span class="mt-2 inline-flex rounded-full bg-clay px-3 py-1 text-xs font-extrabold text-white">Faux</span>
									{/if}
									<p class="mt-2 text-sm font-extrabold text-ink/50">Réponse de l’élève</p>
									<p class="mt-1 whitespace-pre-wrap">{answerFor(openSet, item.id)}</p>
									{#if item.expectedAnswer}
										<p class="mt-2 text-sm font-extrabold text-forest">Corrigé</p>
										<p class="mt-1 whitespace-pre-wrap font-bold text-ink">{item.expectedAnswer}</p>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		{/if}
	</div>
	{#if error}
		<p class="mt-4 font-bold text-clay">{error}</p>
	{/if}
</section>

<SchoolFollowPanel
	classLabel={student.classLabel}
	{attendanceLabel}
	{weekDays}
	{progressGroups}
	{markGroups}
	{rankLabel}
	{averageLabel}
/>

{#if isGuardian && observations.length > 0}
	<section class="mt-6 rounded-[2rem] bg-paper p-6 shadow-card">
		<h2 class="text-xl font-extrabold">Observations de l’école</h2>
		<ul class="mt-4 space-y-2">
			{#each observations as note, index (`${index}-${note}`)}
				<li class="rounded-2xl bg-cream px-4 py-3 font-bold text-ink/80">{note}</li>
			{/each}
		</ul>
	</section>
{/if}
