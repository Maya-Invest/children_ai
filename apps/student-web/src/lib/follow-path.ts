export type FollowTab = 'timetable' | 'progress' | 'marks';

export function followFromPath(
	pathname: string,
	basePath: string,
): { tab: FollowTab; subjectSlug: string } | null {
	const path = stripSlash(pathname);
	const base = stripSlash(basePath);
	if (path !== base && !path.startsWith(`${base}/`)) return null;
	const parts = path.slice(base.length).split('/').filter(Boolean);
	if (parts.length === 0) return { tab: 'timetable', subjectSlug: '' };
	if (parts[0] === 'avancement') return { tab: 'progress', subjectSlug: decodeURIComponent(parts[1] ?? '') };
	if (parts[0] === 'notes') return { tab: 'marks', subjectSlug: decodeURIComponent(parts[1] ?? '') };
	return null;
}

export function followView(
	state: { followTab?: FollowTab; subjectSlug?: string },
	pathname: string,
	basePath: string,
	visiblePath = pathname,
): { tab: FollowTab; subjectSlug: string } {
	if (state.followTab) {
		return { tab: state.followTab, subjectSlug: state.subjectSlug ?? '' };
	}
	return (
		followFromPath(visiblePath, basePath) ??
		followFromPath(pathname, basePath) ?? { tab: 'timetable', subjectSlug: '' }
	);
}

function stripSlash(path: string) {
	return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}
