export type SubjectSlug = { label: string; slug: string };

export function subjectSlug(label: string): string {
	const base = label
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return base || 'matiere';
}

export function subjectSlugs(labels: string[]): SubjectSlug[] {
	const seen: Record<string, number> = {};
	return labels.map((label) => {
		const base = subjectSlug(label);
		const count = seen[base] ?? 0;
		seen[base] = count + 1;
		return { label, slug: count === 0 ? base : `${base}-${count + 1}` };
	});
}

export function subjectFromSlug(labels: string[], slug: string | undefined): string | null {
	if (!slug) return null;
	return subjectSlugs(labels).find((entry) => entry.slug === slug)?.label ?? null;
}
