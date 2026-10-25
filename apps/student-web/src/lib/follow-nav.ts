import { pushState } from '$app/navigation';
import { page } from '$app/state';
import { followFromPath } from '$lib/follow-path';

export function openFollow(event: MouseEvent, href: string, basePath: string) {
	if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
	const path = new URL(href, window.location.origin).pathname;
	const follow = followFromPath(path, basePath);
	if (!follow) return;
	event.preventDefault();
	if (path === window.location.pathname) return;
	const next: App.PageState = { followTab: follow.tab };
	if (follow.subjectSlug) next.subjectSlug = follow.subjectSlug;
	if (page.state.setId) {
		next.setId = page.state.setId;
		next.filter = page.state.filter ?? 'all';
	}
	if (page.state.questionNumber) next.questionNumber = page.state.questionNumber;
	pushState(href, next);
}
