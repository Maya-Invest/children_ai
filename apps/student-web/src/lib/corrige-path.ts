import { filterFromSlug, type ResultFilter } from './result-filter';

const STUDENT = /^\/app\/corriges\/([^/]+)(?:\/filtre\/([^/]+))?\/?$/;
const PARENT = /^\/parent\/children\/[^/]+\/corriges\/([^/]+)(?:\/filtre\/([^/]+))?\/?$/;

export function corrigeFromPath(path: string): { setId: string; filter: ResultFilter } | null {
	const match = path.match(STUDENT) ?? path.match(PARENT);
	if (!match?.[1]) return null;
	const slug = match[2];
	const filter = slug ? filterFromSlug(slug) : 'all';
	return { setId: decodeURIComponent(match[1]), filter: filter ?? 'all' };
}
