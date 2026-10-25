import type { LearnerContext } from "./types.ts";

const SUBJECT_LABELS: Record<string, string> = {
	math: "Mathématiques",
	maths: "Mathématiques",
	mathematiques: "Mathématiques",
	fr: "Français",
	francais: "Français",
	hg: "Histoire-Géographie",
	histgeo: "Histoire-Géographie",
	"histoire geographie": "Histoire-Géographie",
	svt: "SVT",
	ang: "Anglais",
	anglais: "Anglais",
	edhc: "EDHC",
	eps: "EPS",
	pc: "Physique-Chimie",
	"physique chimie": "Physique-Chimie",
};

function fold(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

export function displaySubjectLabel(subject: string): string {
	const raw = subject.trim();
	if (!raw) return "";
	const folded = fold(raw);
	return SUBJECT_LABELS[folded] ?? SUBJECT_LABELS[folded.replace(/\s+/g, "")] ?? raw;
}

export function subjectsMatch(left: string, right: string): boolean {
	const a = displaySubjectLabel(left);
	const b = displaySubjectLabel(right);
	if (!a || !b) return false;
	return fold(a) === fold(b);
}

export function listLearnerSubjects(context: LearnerContext): string[] {
	const labels: string[] = [];
	const seen = new Set<string>();
	const add = (raw?: string) => {
		const label = displaySubjectLabel(raw ?? "");
		if (!label) return;
		const key = fold(label);
		if (!key || seen.has(key)) return;
		seen.add(key);
		labels.push(label);
	};
	for (const mark of context.marks) add(mark.subject);
	for (const item of context.classProgress) add(item.subject);
	return labels;
}

export function formatProgrammeLine(classLabel: string, subjects: string[]): string {
	const head = classLabel.trim() || "Classe";
	if (subjects.length === 0) return head;
	if (subjects.length <= 4) return `${head} · ${subjects.join(" · ")}`;
	return `${head} · Toutes les matières`;
}
