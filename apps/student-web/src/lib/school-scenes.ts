import type { SchoolDoodleKind } from '$lib/SchoolDoodle.svelte';

export type SchoolSceneId = '6e' | '5e' | '4e' | '3e' | '2nde' | '1ere' | 'tle';

export type GradeSceneInput = {
	gradeLevel?: { label?: string; cycle?: string } | null;
	classLabel?: string;
};

type DoodleInk = {
	primary: string;
	accent: string;
	paper: string;
	ink: string;
	gold: string;
	soft: string;
};

type ScenePiece = {
	id: string;
	kind: SchoolDoodleKind;
	className: string;
	style: string;
};

export type SchoolScene = {
	id: SchoolSceneId;
	paper: string;
	washA: string;
	washB: string;
	ink: DoodleInk;
	pieces: ScenePiece[];
};

const slot = {
	leftHigh: 'left-[1%] top-[12%] h-24 w-24 sm:h-28 sm:w-28',
	leftMid: 'left-[3%] top-[42%] h-14 w-14 sm:h-16 sm:w-16',
	leftLow: 'left-[2%] bottom-[9%] h-16 w-16 sm:h-20 sm:w-20',
	leftDesk: 'left-[1%] top-[68%] hidden h-20 w-20 md:block',
	rightHigh: 'right-[1.5%] top-[9%] h-24 w-14 sm:h-28 sm:w-16',
	rightMid: 'right-[2%] top-[38%] h-16 w-16 sm:h-20 sm:w-20',
	rightLow: 'right-[2%] bottom-[12%] h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]',
	rightDesk: 'right-[4%] bottom-[38%] hidden h-16 w-16 lg:block',
	bottom: 'bottom-[3%] left-[28%] hidden h-12 w-24 lg:block',
};

function float(tilt: number, dur: number, delay: number, drift: number): string {
	return `--tilt:${tilt}deg;--dur:${dur}s;--delay:${delay}s;--drift:${drift}px`;
}

function piece(
	id: string,
	kind: SchoolDoodleKind,
	className: string,
	tilt: number,
	dur: number,
	delay: number,
	drift: number,
): ScenePiece {
	return { id, kind, className, style: float(tilt, dur, delay, drift) };
}

const ink6e: DoodleInk = {
	primary: '#1F6F62',
	accent: '#E06C3A',
	paper: '#FFFDF8',
	ink: '#2A1810',
	gold: '#E8B84A',
	soft: '#C8EBE4',
};

const pieces6e: ScenePiece[] = [
	piece('book', 'book', slot.leftHigh, -12, 9, 0, 12),
	piece('star', 'star', slot.leftMid, 8, 7, -1.4, -8),
	piece('plane', 'plane', slot.leftLow, -6, 8.5, -2, 14),
	piece('backpack', 'backpack', slot.leftDesk, 6, 10, -3, -6),
	piece('pencil', 'pencil', slot.rightHigh, 14, 7.5, -0.8, -10),
	piece('apple', 'apple', slot.rightMid, -10, 8, -2.6, 8),
	piece('flask', 'flask', slot.rightLow, 7, 9.5, -1, -12),
	piece('globe', 'globe', slot.rightDesk, -4, 11, -4, 6),
	piece('ruler', 'ruler', slot.bottom, -8, 12, -2.2, 4),
];

const pieces5e: ScenePiece[] = [
	piece('compass', 'compass', slot.leftHigh, -12, 9, 0, 12),
	piece('triangle', 'triangle', slot.leftMid, 8, 7, -1.4, -8),
	piece('notebook', 'notebook', slot.leftLow, -6, 8.5, -2, 14),
	piece('calculator', 'calculator', slot.leftDesk, 6, 10, -3, -6),
	piece('map', 'map', slot.rightHigh, 14, 7.5, -0.8, -10),
	piece('microscope', 'microscope', slot.rightMid, -10, 8, -2.6, 8),
	piece('globe', 'globe', slot.rightLow, 7, 9.5, -1, -12),
];

const pieces4e: ScenePiece[] = [
	piece('atom', 'atom', slot.leftHigh, -8, 11, 0, 8),
	piece('book', 'book', slot.leftLow, -6, 10, -2, 10),
	piece('pen', 'pen', slot.rightHigh, 12, 9, -0.8, -8),
	piece('flask', 'flask', slot.rightMid, -8, 10, -2.4, 6),
	piece('chart', 'chart', slot.rightLow, 6, 12, -1, -8),
	piece('quotation', 'quotation', slot.rightDesk, -4, 13, -3, 4),
	piece('setsquare', 'setsquare', slot.bottom, -8, 14, -2, 4),
];

const pieces3e: ScenePiece[] = [
	piece('book', 'book', slot.leftHigh, -8, 14, 0, 6),
	piece('compass', 'compass', slot.leftLow, -4, 16, -2, 8),
	piece('pen', 'pen', slot.rightHigh, 10, 15, -1, -6),
	piece('graph', 'graph', slot.rightLow, 4, 16, -3, -4),
];

const piecesLycee: ScenePiece[] = [
	piece('book', 'book', slot.leftHigh, -8, 12, 0, 6),
	piece('compass', 'compass', slot.leftLow, -4, 13, -2, 8),
	piece('pen', 'pen', slot.rightHigh, 10, 12, -1, -6),
	piece('graph', 'graph', slot.rightMid, 4, 14, -2.5, 4),
	piece('quotation', 'quotation', slot.rightLow, -6, 15, -3, -4),
];

const piecesTle: ScenePiece[] = [
	piece('laurel', 'laurel', slot.leftHigh, -6, 18, 0, 4),
	piece('book', 'book', slot.leftLow, -4, 17, -2, 6),
	piece('pen', 'pen', slot.rightHigh, 8, 18, -1, -4),
	piece('diploma', 'diploma', slot.rightMid, -4, 16, -2.5, 4),
	piece('graph', 'graph', slot.rightLow, 3, 18, -3, -3),
];

const scenes: Record<SchoolSceneId, SchoolScene> = {
	'6e': {
		id: '6e',
		paper: '#fbf4e8',
		washA: '#ffe3c4',
		washB: '#c8ebe4',
		ink: ink6e,
		pieces: pieces6e,
	},
	'5e': {
		id: '5e',
		paper: '#f4f7fb',
		washA: '#d5e6f7',
		washB: '#f6e4c4',
		ink: {
			primary: '#3D6B8C',
			accent: '#C4922A',
			paper: '#FFFDF8',
			ink: '#1E2A33',
			gold: '#E8B84A',
			soft: '#D5E6F7',
		},
		pieces: pieces5e,
	},
	'4e': {
		id: '4e',
		paper: '#f6f3ee',
		washA: '#d7ebe6',
		washB: '#f0d2c0',
		ink: {
			primary: '#1A5C54',
			accent: '#C45C32',
			paper: '#FFFDF8',
			ink: '#2A1810',
			gold: '#D4A574',
			soft: '#D7EBE6',
		},
		pieces: pieces4e,
	},
	'3e': {
		id: '3e',
		paper: '#f3f0ea',
		washA: '#e4ddd2',
		washB: '#e7efe8',
		ink: {
			primary: '#3D4A42',
			accent: '#8A7348',
			paper: '#FFFDF8',
			ink: '#243028',
			gold: '#C6A15B',
			soft: '#E7EFE8',
		},
		pieces: pieces3e,
	},
	'2nde': {
		id: '2nde',
		paper: '#f3f6f8',
		washA: '#d5dde8',
		washB: '#e7eef6',
		ink: {
			primary: '#3D5568',
			accent: '#5C6B7A',
			paper: '#FFFDF8',
			ink: '#243038',
			gold: '#8AA0B4',
			soft: '#E7EEF6',
		},
		pieces: piecesLycee,
	},
	'1ere': {
		id: '1ere',
		paper: '#f4f2ee',
		washA: '#d9e0ea',
		washB: '#f0ddc4',
		ink: {
			primary: '#3A4038',
			accent: '#C4A06A',
			paper: '#FFFDF8',
			ink: '#2A2620',
			gold: '#C4A06A',
			soft: '#F0DDC4',
		},
		pieces: piecesLycee,
	},
	tle: {
		id: 'tle',
		paper: '#f3f0ea',
		washA: '#e4ddd2',
		washB: '#e7d7b0',
		ink: {
			primary: '#3A3832',
			accent: '#C6A15B',
			paper: '#FFFDF8',
			ink: '#243028',
			gold: '#C6A15B',
			soft: '#E7D7B0',
		},
		pieces: piecesTle,
	},
};

export function schoolScene(id: SchoolSceneId): SchoolScene {
	return scenes[id];
}

function fold(value: string): string {
	return value
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase();
}

function matchYear(raw: string): SchoolSceneId | null {
	const text = fold(raw);
	if (!text.trim()) return null;
	if (/terminale|\btle\b|\btlea\b|\btlec\b|\btled\b/.test(text)) return 'tle';
	if (/premiere|\b1ere\b|\b1era\b|\b1erc\b|\b1erd\b/.test(text)) return '1ere';
	if (/seconde|\b2nde\b|\b2nda\b|\b2ndc\b|\b2nd\b/.test(text)) return '2nde';
	if (/\b3\s*e(?:me)?\b|\btroisi/.test(text)) return '3e';
	if (/\b4\s*e(?:me)?\b|\bquatr/.test(text)) return '4e';
	if (/\b5\s*e(?:me)?\b|\bcinq/.test(text)) return '5e';
	if (/\b6\s*e(?:me)?\b|\bsixi/.test(text)) return '6e';
	if (/\b(?:cp\d*|ce\d*|cm\d*|gs|ms|ps)\b|maternelle|prescolaire|primaire/.test(text)) return '6e';
	return null;
}

function matchCycle(cycle: string | undefined): SchoolSceneId | null {
	const text = fold(cycle ?? '');
	if (!text) return null;
	if (/prescolaire|primaire|maternelle/.test(text)) return '6e';
	if (/college/.test(text)) return '6e';
	if (/lycee|technique/.test(text)) return '2nde';
	return null;
}

export function resolveSchoolScene(input: GradeSceneInput): SchoolSceneId {
	const label = input.gradeLevel?.label?.trim() ?? '';
	if (label) {
		return matchYear(label) ?? matchCycle(input.gradeLevel?.cycle) ?? '6e';
	}
	const fromClass = matchYear(input.classLabel ?? '');
	if (fromClass) return fromClass;
	return matchCycle(input.gradeLevel?.cycle) ?? '6e';
}
