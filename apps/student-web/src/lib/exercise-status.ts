export type ExerciseStatusAudience = 'guardian' | 'student';

type StatusSet = {
	submittedAt?: string;
	correctionReleasedAt?: string | null;
	answers?: { value: string }[];
};

export function exerciseStatusLabel(
	set: StatusSet,
	options: {
		audience: ExerciseStatusAudience;
		firstName: string;
		archived?: boolean;
	},
): string {
	if (options.archived) return 'Archivé';
	const hasAnswer = (set.answers ?? []).some((answer) => answer.value.trim().length > 0);
	if (!set.submittedAt) {
		if (hasAnswer) return 'En cours';
		return options.audience === 'guardian'
			? `${options.firstName} n’a pas encore répondu`
			: 'Pas débuté';
	}
	if (!set.correctionReleasedAt) {
		return options.audience === 'guardian' ? 'Corrigé à rendre disponible' : 'En attente du corrigé';
	}
	return 'Corrigé ouvert';
}

/** Bouton de la vue élève pour chaque état de série. */
export function studentExerciseButtonLabel(
	set: StatusSet,
	archived = false,
): 'Répondre' | 'Voir mes réponses' | 'Voir la correction' {
	if (archived || set.correctionReleasedAt) return 'Voir la correction';
	if (set.submittedAt) return 'Voir mes réponses';
	return 'Répondre';
}
