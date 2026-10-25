import type { ExerciseSet, HomePayload } from './types';

export function findHomeSet(home: HomePayload, setId: string): ExerciseSet | null {
	if (home.currentSet?.id === setId) return home.currentSet;
	const fromHistory = home.history.find((set) => set.id === setId);
	if (fromHistory) return fromHistory;
	for (const track of home.session.tracks) {
		if (track.currentSet?.id === setId) return track.currentSet;
		for (const item of track.items ?? []) {
			if (item.currentSet?.id === setId) return item.currentSet;
		}
	}
	return null;
}
