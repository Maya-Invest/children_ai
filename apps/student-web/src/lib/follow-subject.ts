import { redirect } from '@sveltejs/kit';
import { subjectFromSlug } from './subject-path';
import { groupClassProgress, groupMarksBySubject } from './timetable';
import type { HomePayload } from './types';

export async function ensureSubjectSlug(
	home: Promise<HomePayload>,
	tab: 'progress' | 'marks',
	slug: string | undefined,
	fallback: string,
) {
	if (!slug) return;
	const value = await home;
	const labels =
		tab === 'progress'
			? groupClassProgress(value.classProgress).map((group) => group.subject)
			: groupMarksBySubject(value.marks ?? []).map((group) => group.subject);
	if (!subjectFromSlug(labels, slug)) redirect(302, fallback);
}
