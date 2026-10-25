import { createContext } from 'svelte';
import type { HomePayload } from './types';

export type FollowHomeSource = {
	readonly home: HomePayload;
};

export const [getFollowHome, setFollowHome] = createContext<FollowHomeSource>();
