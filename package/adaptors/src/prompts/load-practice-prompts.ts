import bundledPracticePrompts from "./practice-prompts.md" with { type: "text" };

export async function loadPracticePrompts(): Promise<PracticePrompts> {
	let source = bundledPracticePrompts;
	if (typeof Bun !== "undefined") {
		const file = Bun.file(new URL("./practice-prompts.md", import.meta.url));
		if (await file.exists()) source = await file.text();
	}
	return parsePracticePrompts(source);
}

export function parsePracticePrompts(source: string): PracticePrompts {
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
	return new PracticePrompts(sections);
}

export class PracticePrompts {
	constructor(private readonly sections: Map<string, string>) {}

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
