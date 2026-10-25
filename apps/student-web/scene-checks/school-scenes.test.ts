import { describe, expect, test } from 'bun:test';
import { resolveSchoolScene, schoolScene } from '../src/lib/school-scenes.ts';

describe('resolveSchoolScene', () => {
	test('keeps a 6ème label on the current scene', () => {
		expect(resolveSchoolScene({ gradeLevel: { label: '6ème', cycle: 'Collège' } })).toBe('6e');
	});

	test('reads the class label when no grade level is stored', () => {
		expect(resolveSchoolScene({ classLabel: '5ème 1' })).toBe('5e');
	});

	test('shares one scene across series of the same year', () => {
		expect(resolveSchoolScene({ gradeLevel: { label: '2nde A', cycle: 'Lycée' } })).toBe('2nde');
		expect(resolveSchoolScene({ gradeLevel: { label: '2nde C', cycle: 'Lycée' } })).toBe('2nde');
		expect(resolveSchoolScene({ gradeLevel: { label: '1ère D' } })).toBe('1ere');
		expect(resolveSchoolScene({ gradeLevel: { label: 'Tle A' } })).toBe('tle');
		expect(resolveSchoolScene({ gradeLevel: { label: 'Terminale C' } })).toBe('tle');
	});

	test('does not treat a lycée label as 6ème', () => {
		expect(resolveSchoolScene({ gradeLevel: { label: 'Seconde C', cycle: 'Lycée' } })).not.toBe('6e');
		expect(resolveSchoolScene({ gradeLevel: { label: 'Première A' } })).toBe('1ere');
	});

	test('uses the cycle when the label matches no year', () => {
		expect(resolveSchoolScene({ gradeLevel: { label: 'Niveau libre', cycle: 'Lycée' } })).toBe('2nde');
		expect(resolveSchoolScene({ gradeLevel: { label: 'Niveau libre', cycle: 'Technique' } })).toBe('2nde');
		expect(resolveSchoolScene({ gradeLevel: { label: 'Niveau libre', cycle: 'Primaire' } })).toBe('6e');
		expect(resolveSchoolScene({ gradeLevel: { label: 'CE2', cycle: 'Primaire' } })).toBe('6e');
	});

	test('falls back to the 6ème scene when nothing matches', () => {
		expect(resolveSchoolScene({})).toBe('6e');
	});

	test('keeps the cream wash and the apple for 6ème', () => {
		const scene = schoolScene(resolveSchoolScene({ gradeLevel: { label: '6ème', cycle: 'Collège' } }));
		expect(scene.paper).toBe('#fbf4e8');
		expect(scene.washA).toBe('#ffe3c4');
		expect(scene.washB).toBe('#c8ebe4');
		expect(scene.pieces.map((piece) => piece.kind)).toContain('apple');
	});

	test('uses the cooler wash for 5ème', () => {
		const scene = schoolScene(resolveSchoolScene({ gradeLevel: { label: '5ème', cycle: 'Collège' } }));
		expect(scene.id).toBe('5e');
		expect(scene.paper).toBe('#f4f7fb');
		expect(scene.washA).toBe('#d5e6f7');
		expect(scene.washB).toBe('#f6e4c4');
		expect(scene.pieces.map((piece) => piece.kind)).toContain('compass');
		expect(scene.pieces.map((piece) => piece.kind)).not.toContain('apple');
	});

	test('uses the gold wash for terminale', () => {
		const scene = schoolScene(resolveSchoolScene({ gradeLevel: { label: 'Tle D', cycle: 'Lycée' } }));
		expect(scene.id).toBe('tle');
		expect(scene.paper).toBe('#f3f0ea');
		expect(scene.washB).toBe('#e7d7b0');
		expect(scene.pieces.map((piece) => piece.kind)).toContain('laurel');
	});
});
