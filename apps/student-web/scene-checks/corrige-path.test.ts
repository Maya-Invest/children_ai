import { describe, expect, test } from 'bun:test';
import { corrigeFromPath } from '../src/lib/corrige-path.ts';

describe('corrigeFromPath', () => {
	test('reads a student corrigé and its filter', () => {
		expect(corrigeFromPath('/app/corriges/set-1')).toEqual({ setId: 'set-1', filter: 'all' });
		expect(corrigeFromPath('/app/corriges/set-1/filtre/justes')).toEqual({
			setId: 'set-1',
			filter: 'correct',
		});
	});

	test('reads a parent corrigé without treating the child id as the series', () => {
		expect(corrigeFromPath('/parent/children/child-1/corriges/set-9/filtre/fausses')).toEqual({
			setId: 'set-9',
			filter: 'incorrect',
		});
		expect(corrigeFromPath('/app')).toBeNull();
	});
});
