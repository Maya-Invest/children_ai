import { describe, expect, test } from 'bun:test';
import { followFromPath, followView } from '../src/lib/follow-path.ts';
import { setFilterFromPath } from '../src/lib/result-filter.ts';

describe('followFromPath', () => {
	test('reads the student timetable, avancement, and notes', () => {
		expect(followFromPath('/app', '/app')).toEqual({ tab: 'timetable', subjectSlug: '' });
		expect(followFromPath('/app/avancement', '/app')).toEqual({ tab: 'progress', subjectSlug: '' });
		expect(followFromPath('/app/avancement/maths', '/app')).toEqual({
			tab: 'progress',
			subjectSlug: 'maths',
		});
		expect(followFromPath('/app/notes/francais', '/app')).toEqual({
			tab: 'marks',
			subjectSlug: 'francais',
		});
		expect(followFromPath('/app/corriges/set-1', '/app')).toBeNull();
		expect(followFromPath('/app/stats', '/app')).toBeNull();
	});

	test('reads a parent child path without using the child id as the subject', () => {
		const base = '/parent/children/child-1';
		expect(followFromPath(base, base)).toEqual({ tab: 'timetable', subjectSlug: '' });
		expect(followFromPath(`${base}/notes/histoire`, base)).toEqual({
			tab: 'marks',
			subjectSlug: 'histoire',
		});
	});
});

describe('followView', () => {
	test('prefers the history state, then the visible path, then the rendered path', () => {
		expect(followView({ followTab: 'marks', subjectSlug: 'svt' }, '/app', '/app', '/app/corriges/set-1')).toEqual({
			tab: 'marks',
			subjectSlug: 'svt',
		});
		expect(followView({}, '/app', '/app', '/app/avancement/maths')).toEqual({
			tab: 'progress',
			subjectSlug: 'maths',
		});
		expect(followView({}, '/app/avancement', '/app', '/app/corriges/set-1')).toEqual({
			tab: 'progress',
			subjectSlug: '',
		});
	});
});

describe('setFilterFromPath', () => {
	test('reads series filters and ignores question steps', () => {
		expect(setFilterFromPath('/app/sets/set-1')).toBe('all');
		expect(setFilterFromPath('/app/sets/set-1/filtre/fausses')).toBe('incorrect');
		expect(setFilterFromPath('/parent/children/child-1/sets/set-1/filtre/non-repondu')).toBe('unanswered');
		expect(setFilterFromPath('/app/sets/set-1/question/2')).toBeNull();
	});
});
