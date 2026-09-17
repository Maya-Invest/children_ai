import type { HomePayload } from './types';

const WEEKDAY_LABELS = [
	{ id: 'monday', label: 'Lundi' },
	{ id: 'tuesday', label: 'Mardi' },
	{ id: 'wednesday', label: 'Mercredi' },
	{ id: 'thursday', label: 'Jeudi' },
	{ id: 'friday', label: 'Vendredi' },
	{ id: 'saturday', label: 'Samedi' },
	{ id: 'sunday', label: 'Dimanche' },
] as const;

const JS_DAY_TO_TIMETABLE = [
	'sunday',
	'monday',
	'tuesday',
	'wednesday',
	'thursday',
	'friday',
	'saturday',
] as const;

export function groupTimetable(slots: HomePayload['timetable']) {
	if (slots.length === 0) return [];
	const used = new Set(slots.map((slot) => slot.dayOfWeek));
	const includeWeekend = used.has('saturday') || used.has('sunday');
	const today = JS_DAY_TO_TIMETABLE[new Date().getDay()] ?? 'monday';
	const days = WEEKDAY_LABELS.filter(
		(day) => includeWeekend || (day.id !== 'saturday' && day.id !== 'sunday'),
	);
	return days.map((day) => ({
		...day,
		isToday: day.id === today,
		slots: slots
			.filter((slot) => slot.dayOfWeek === day.id)
			.slice()
			.sort((left, right) => left.startTime.localeCompare(right.startTime)),
	}));
}

export function formatMarkDate(value: string) {
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return value;
	return parsed.toLocaleDateString('fr-CI');
}

export function groupClassProgress(items: HomePayload['classProgress']) {
	const groups = new Map<string, HomePayload['classProgress']>();
	for (const item of items) {
		const key = item.subject?.trim() || 'Programme';
		const list = groups.get(key) ?? [];
		list.push(item);
		groups.set(key, list);
	}
	return [...groups.entries()].map(([subject, grouped]) => ({
		subject,
		items: grouped,
		average: Math.round(
			grouped.reduce((sum, item) => sum + item.completedPercentage, 0) / grouped.length,
		),
	}));
}

export function groupMarksBySubject(marks: HomePayload['marks']) {
	const groups = new Map<string, HomePayload['marks']>();
	for (const mark of marks) {
		const key = mark.subject?.trim() || 'Autres';
		const list = groups.get(key) ?? [];
		list.push(mark);
		groups.set(key, list);
	}
	return [...groups.entries()].map(([subject, grouped]) => {
		const items = grouped.slice().sort((left, right) => {
			const byDate = right.date.localeCompare(left.date);
			return byDate !== 0 ? byDate : left.title.localeCompare(right.title);
		});
		const average =
			items.length === 0
				? 0
				: items.reduce(
						(sum, mark) => sum + (mark.maxScore > 0 ? (mark.score / mark.maxScore) * 20 : 0),
						0,
					) / items.length;
		return {
			subject,
			items,
			average: Math.round(average * 10) / 10,
		};
	});
}

export type WeekDay = ReturnType<typeof groupTimetable>[number];
export type ProgressGroup = ReturnType<typeof groupClassProgress>[number];
export type MarkGroup = ReturnType<typeof groupMarksBySubject>[number];
