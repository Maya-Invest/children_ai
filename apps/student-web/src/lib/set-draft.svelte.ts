import { createContext } from 'svelte';

export type SetDraft = {
	answer: (questionId: string) => string | undefined;
	setAnswer: (questionId: string, value: string) => void;
};

export const [getSetDraft, setSetDraft] = createContext<SetDraft>();
