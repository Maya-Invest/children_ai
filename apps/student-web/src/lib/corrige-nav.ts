import { pushState, replaceState } from '$app/navigation';
import { page } from '$app/state';
import { corrigeFromPath } from '$lib/corrige-path';
import { setFilterFromPath } from '$lib/result-filter';

export function openInPlace(event: MouseEvent, href: string, replace = false) {
	if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
	const path = new URL(href, window.location.origin).pathname;
	const opened = corrigeFromPath(path);
	const setFilter = opened ? null : setFilterFromPath(path);
	if (!opened && !setFilter) return;
	event.preventDefault();
	const next: App.PageState = opened
		? { setId: opened.setId, filter: opened.filter }
		: { filter: setFilter ?? 'all' };
	if (page.state.followTab) {
		next.followTab = page.state.followTab;
		if (page.state.subjectSlug) next.subjectSlug = page.state.subjectSlug;
	}
	if (page.state.questionNumber) next.questionNumber = page.state.questionNumber;
	if (!opened && page.state.setId) next.setId = page.state.setId;
	if (replace) replaceState(href, next);
	else pushState(href, next);
}
