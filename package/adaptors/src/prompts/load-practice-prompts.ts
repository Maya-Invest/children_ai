/// <reference path="./markdown.d.ts" />
import promptV1 from "./1.0.md" with { type: "text" };
import promptV11 from "./1.1.md" with { type: "text" };
import promptV12 from "./1.2.md" with { type: "text" };
import promptV13 from "./1.3.md" with { type: "text" };

/** Active prompt file. A new version is a sibling markdown file, then change this value. */
export const PRACTICE_PROMPT_VERSION = "1.3";

const bundledPrompts: Record<string, string> = {
	"1.0": promptV1,
	"1.1": promptV11,
	"1.2": promptV12,
	"1.3": promptV13,
};

export async function loadPracticePrompts(version = PRACTICE_PROMPT_VERSION): Promise<PracticePrompts> {
	const safe = version.trim();
	if (!/^\d+\.\d+$/.test(safe)) throw new Error(`Version de prompt invalide : ${version}`);
	let source = bundledPrompts[safe];
	if (typeof Bun !== "undefined") {
		const file = Bun.file(new URL(`./${safe}.md`, import.meta.url));
		if (await file.exists()) source = await file.text();
	}
	if (!source) throw new Error(`Version de prompt inconnue : ${safe}`);
	return parsePracticePrompts(source, safe);
}

export function parsePracticePrompts(source: string, version: string): PracticePrompts {
	const sections = new Map<string, string>();
	let name = "";
	let lines: string[] = [];
	const flush = () => {
		if (!name) return;
		sections.set(name, lines.join("\n").trim());
	};
	for (const line of source.split(/\r?\n/)) {
		const heading = /^# ([a-z0-9-]+)\s*$/.exec(line);
		if (heading?.[1]) {
			flush();
			name = heading[1];
			lines = [];
			continue;
		}
		if (name) lines.push(line);
	}
	flush();
	return new PracticePrompts(version, sections);
}

export class PracticePrompts {
	constructor(
		readonly version: string,
		private readonly sections: Map<string, string>,
	) {}

	fill(section: string, values: Record<string, string> = {}): string {
		const template = this.sections.get(section);
		if (template === undefined) throw new Error(`Section de prompt manquante : ${section}`);
		return template.replace(/\{\{\s*([a-zA-Z0-9]+)\s*\}\}/g, (_match, key: string) => {
			const value = values[key];
			if (value === undefined) throw new Error(`Valeur de prompt manquante : ${key} (${section})`);
			return value;
		});
	}
}
