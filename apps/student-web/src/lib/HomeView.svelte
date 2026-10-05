<script lang="ts">
	import { resolve } from '$app/paths';
	import ResultFilterBar from '$lib/ResultFilterBar.svelte';
	import SchoolFollowPanel from '$lib/SchoolFollowPanel.svelte';
	import { exerciseStatusLabel, studentExerciseButtonLabel } from '$lib/exercise-status';
	import { summarizePractice } from '$lib/revision-stats';
	import { filterByResult, resultCounts, type ResultFilter } from '$lib/result-filter';
	import { formatMarkDate, groupClassProgress, groupMarksBySubject, groupTimetable } from '$lib/timetable';
	import type { ExerciseSet, HomePayload, PracticeIntent, Question } from '$lib/types';

	const FOCUS_CHOICES: { id: PracticeIntent; label: string; hint: string }[] = [
		{
			id: 'upcoming_work',
			label: 'Devoirs à venir',
			hint: 'Préparer les devoirs et les évaluations annoncés',
		},
		{
			id: 'improve_results',
			label: 'Amélioration des résultats',
			hint: 'Renforcer les matières où les notes sont les plus faibles',
		},
		{
			id: 'prepare_next_day',
			label: 'Préparation de cours',
			hint: 'Réviser les matières du prochain cours',
		},
	];

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
		onToggleAutoRelease,
		onChangeFocusIntent,
	}: {
		home: HomePayload;
		onGenerate?: () => Promise<void> | void;
		onReleaseCorrection?: (setId: string) => Promise<void> | void;
		onToggleAutoRelease?: (checked: boolean) => Promise<void> | void;
		onChangeFocusIntent?: (intent: PracticeIntent) => Promise<void> | void;
	} = $props();

	let student = $derived(home.student);
	let pending = $state(false);
	let settingsPending = $state(false);
	let settingsError = $state('');
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
	let practice = $derived(summarizePractice(home.history, home.currentSet));
	let questionTotal = $derived(practice.questionsWorked + practice.questionsOpen);
	let revisionsHint = $derived(
		practice.seriesCount === 0 ? 'Pas encore commencé' : 'séries terminées',
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
	let questionsHint = $derived(questionTotal === 0 ? 'Aucune pour le moment' : 'travaillées');
	let lastActivityValue = $derived(
		practice.lastPracticeAt ? formatMarkDate(practice.lastPracticeAt) : '—',
	);
	let openTip = $state('');
	let revisionsTip = $derived.by(() => {
		const done = practice.submittedCount;
		const total = practice.seriesCount;
		if (total === 0) return 'Aucune série pour le moment.';
		const finished = done === 1 ? '1 terminé' : `${done} terminés`;
		return `${done}/${total} (${finished} sur ${total} au total)`;
	});
	let successTip = $derived.by(() => {
		if (practice.successPercent !== null && practice.scoredTotal > 0) {
			const good =
				practice.scoredCorrect === 1
					? '1 bonne réponse'
					: `${practice.scoredCorrect} bonnes réponses`;
			return `${practice.successPercent} % (${good} sur ${practice.scoredTotal} dans les séries corrigées)`;
		}
		if (practice.pendingCorrectionCount > 0) {
			return 'Le pourcentage s’affichera quand le corrigé sera ouvert.';
		}
		return 'Le pourcentage s’affiche après l’ouverture du corrigé.';
	});
	let questionsTip = $derived.by(() => {
		const worked = practice.questionsWorked;
		const open = practice.questionsOpen;
		if (worked > 0 && open > 0) {
			return `${questionCountPhrase(worked, 'travaillée')} dans les séries terminées, et ${questionCountPhrase(open, 'ouverte')} en cours.`;
		}
		if (worked > 0) return `${questionCountPhrase(worked, 'travaillée')} dans les séries terminées.`;
		if (open > 0) return `${questionCountPhrase(open, 'ouverte')} dans les séries en cours.`;
		return 'Aucune question travaillée pour le moment.';
	});
	let activityTip = $derived(
		practice.lastPracticeAt
			? `Dernière série commencée ou terminée le ${lastActivityValue}.`
			: 'Aucune activité enregistrée sur la plateforme.',
	);
	let currentSet = $derived(home.currentSet);
	let practiceBrief = $derived(home.focus.brief || home.focus.rationale);
	let selectedFocus = $derived(home.focusIntent ?? home.focus.intent ?? 'improve_results');
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

	function questionCountPhrase(count: number, adjective: 'travaillée' | 'ouverte') {
		const plural = adjective === 'travaillée' ? 'travaillées' : 'ouvertes';
		if (count === 1) return `1 question ${adjective}`;
		return `${count} questions ${plural}`;
	}

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

	function setStatus(set: ExerciseSet, archived: boolean) {
		return exerciseStatusLabel(set, {
			audience: isGuardian ? 'guardian' : 'student',
			firstName: student.firstName,
			archived,
		});
	}

	function toListedExercise(set: ExerciseSet, title: string, archived = false): ListedExercise {
		const hasCorrection = hasCompleteCorrection(set);
		const hasAnswer = hasAnyAnswer(set);
		return {
			id: set.id,
			title,
			detail: questionDetail(set.questions.length),
			status: setStatus(set, archived),
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
		if (event.key !== 'Escape') return;
		if (viewingSetId) closeCorrection();
		else openTip = '';
	}

	async function changeFocus(intent: PracticeIntent) {
		if (!onChangeFocusIntent || intent === selectedFocus) return;
		settingsPending = true;
		settingsError = '';
		try {
			await onChangeFocusIntent(intent);
		} catch (caught) {
			settingsError =
				caught instanceof Error ? caught.message : 'Impossible d’enregistrer ce réglage.';
		} finally {
			settingsPending = false;
		}
	}

	async function toggleAutoRelease(event: Event) {
		if (!onToggleAutoRelease) return;
		const input = event.currentTarget as HTMLInputElement;
		const checked = input.checked;
		settingsPending = true;
		settingsError = '';
		try {
			await onToggleAutoRelease(checked);
		} catch (caught) {
			input.checked = home.autoReleaseCorrection;
			settingsError =
				caught instanceof Error ? caught.message : 'Impossible d’enregistrer ce réglage.';
		} finally {
			settingsPending = false;
		}
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
		<p class="shrink-0 text-right text-xs font-bold text-ink/40" title={activityTip}>
			Dernière activité · {lastActivityValue}
		</p>
	</div>
	<h1 class="mt-2 text-4xl font-extrabold text-ink">
		{isGuardian ? `Le suivi de ${student.firstName}` : `Bonjour ${student.firstName}`}
	</h1>
	<p class="mt-3 max-w-2xl text-lg text-ink/70">
		{programmeLine}
	</p>

	{#snippet statCard(
		id: string,
		label: string,
		value: string,
		total: string,
		hint: string,
		detail: string,
		alignEnd: boolean,
	)}
		<div
			class="relative min-w-0 rounded-2xl bg-cream p-4"
			role="group"
			onmouseenter={() => (openTip = id)}
			onmouseleave={() => {
				if (openTip === id) openTip = '';
			}}
		>
			<p class="text-sm font-bold text-ink/50">{label}</p>
			<p class="mt-1 flex items-end gap-1.5">
				<span class="min-w-0 break-words text-xl font-extrabold">{value}</span>
				{#if total}
					<span class="mb-0.5 text-sm font-bold text-ink/40">/ {total}</span>
				{/if}
				<button
					class="mb-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink/10 text-[11px] font-extrabold text-ink/60"
					type="button"
					aria-label={`Détail : ${label}`}
					aria-describedby={`stat-tip-${id}`}
					aria-expanded={openTip === id}
					onfocus={() => (openTip = id)}
					onblur={() => {
						if (openTip === id) openTip = '';
					}}
				>
					i
				</button>
			</p>
			<p class="mt-1 text-sm font-bold text-ink/60">{hint}</p>
			<p
				id={`stat-tip-${id}`}
				role="tooltip"
				class={[
					'absolute top-full z-30 mt-2 w-max max-w-[16rem] rounded-2xl bg-ink px-3 py-2 text-xs font-bold leading-snug text-white shadow-card',
					alignEnd ? 'right-0' : 'left-0',
					openTip === id ? '' : 'sr-only',
				]}
			>
				{detail}
			</p>
		</div>
	{/snippet}

	<div class="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
		{@render statCard(
			'revisions',
			'Révisions',
			String(practice.submittedCount),
			practice.seriesCount > 0 ? String(practice.seriesCount) : '',
			revisionsHint,
			revisionsTip,
			false,
		)}
		{@render statCard('success', 'Réussite', successValue, '', successHint, successTip, false)}
		{@render statCard(
			'questions',
			'Questions',
			String(practice.questionsWorked),
			questionTotal > 0 ? String(questionTotal) : '',
			questionsHint,
			questionsTip,
			true,
		)}
	</div>

	{#if !isGuardian}
		<p class="mt-6 rounded-2xl bg-forest/10 px-4 py-4 text-lg text-ink/80">{practiceBrief}</p>
	{/if}

	{#if isGuardian && onChangeFocusIntent}
		<fieldset class="mt-6 rounded-2xl bg-cream px-4 py-4" disabled={settingsPending}>
			<legend class="text-xs font-extrabold uppercase tracking-[0.14em] text-forest">
				Focus des exercices
			</legend>
			<div class="mt-3 space-y-2">
				{#each FOCUS_CHOICES as choice (choice.id)}
					<label class="flex cursor-pointer items-start gap-3 rounded-xl bg-paper px-3 py-3">
						<input
							class="mt-1"
							type="radio"
							name="practice-focus"
							value={choice.id}
							checked={selectedFocus === choice.id}
							onchange={() => changeFocus(choice.id)}
						/>
						<span>
							<span class="block font-extrabold">{choice.label}</span>
							<span class="mt-0.5 block text-sm font-bold text-ink/60">{choice.hint}</span>
						</span>
					</label>
				{/each}
			</div>
			<p class="mt-3 text-sm text-ink/70">
				<span class="font-extrabold text-ink">Message pour l’élève. </span>{practiceBrief}
			</p>
		</fieldset>
	{/if}

	{#if isGuardian && onToggleAutoRelease}
		<label class="mt-3 flex cursor-pointer items-center gap-3 rounded-2xl bg-cream px-4 py-3">
			<input
				class="shrink-0"
				type="checkbox"
				checked={home.autoReleaseCorrection}
				disabled={settingsPending}
				onchange={toggleAutoRelease}
			/>
			<span>
				<span class="text-xs font-extrabold uppercase tracking-[0.14em] text-forest">Corrigé</span>
				<span class="mt-0.5 block font-extrabold">Automatique dès la fin des exercices</span>
			</span>
		</label>
	{/if}
	{#if isGuardian && settingsError}
		<p class="mt-2 font-bold text-clay">{settingsError}</p>
	{/if}

	{#if canStudentGenerate || !isGuardian}
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
	{/if}
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
							{#if exercise.set}
								{@const studentButton = studentExerciseButtonLabel(exercise.set, exercise.status === 'Archivé')}
								{#if studentButton === 'Voir la correction'}
									<button
										class="rounded-full bg-forest px-3 py-2 text-xs font-extrabold text-white"
										type="button"
										onclick={() => openCorrection(exercise.setId)}
									>
										Voir la correction
									</button>
								{:else}
									<a
										class="rounded-full bg-white px-3 py-2 text-xs font-extrabold text-ink ring-1 ring-ink/10"
										href={resolve('/app/sets/[id]', { id: exercise.set.id })}
									>
										{studentButton}
									</a>
								{/if}
							{:else}
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
