import { describe, expect, test } from 'bun:test';
import { subjectFromSlug, subjectSlug, subjectSlugs } from '../src/lib/subject-path.ts';

describe('subjectSlug', () => {
	test('folds accents and spaces into a path segment', () => {
		expect(subjectSlug('Mathématiques')).toBe('mathematiques');
		expect(subjectSlug('Histoire-Géo')).toBe('histoire-geo');
		expect(subjectSlug('Français')).toBe('francais');
	});

	test('gives colliding labels distinct slugs', () => {
		expect(subjectSlugs(['Maths', 'Maths'])).toEqual([
			{ label: 'Maths', slug: 'maths' },
			{ label: 'Maths', slug: 'maths-2' },
		]);
		expect(subjectFromSlug(['Maths', 'Maths'], 'maths-2')).toBe('Maths');
		expect(subjectFromSlug(['Maths'], 'svt')).toBeNull();
	});
});
