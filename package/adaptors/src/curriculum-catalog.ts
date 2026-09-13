import pack6e from "@children-ai/curriculum-data/ci-college-maths-6e.json" with { type: "json" };
import pack5e from "@children-ai/curriculum-data/ci-college-maths-5e.json" with { type: "json" };
import pack4e from "@children-ai/curriculum-data/ci-college-maths-4e.json" with { type: "json" };
import pack3e from "@children-ai/curriculum-data/ci-college-maths-3e.json" with { type: "json" };
import mapping from "@children-ai/curriculum-data/edaya-math-mapping.json" with { type: "json" };
import type {
	CurriculumCatalogPort,
	CurriculumLesson,
	GradeId,
} from "@children-ai/domain";

export const COLLEGE_MATHS_PACK_VERSION = "dpfc-college-maths-6e-3e-cnd-0923";
export const EDAYA_MATH_SUBJECT_CODE = mapping.edayaSubjectCode as "MATH";

type PackLesson = {
	id: string;
	grade?: GradeId;
	competence: { id: string; title: string };
	theme: { id: string; title: string };
	title: string;
	sequence: number;
	exampleSituation: string;
	skills: string[];
	contents: string[];
};

type PackFile = {
	sourcePdf: string;
	grade?: GradeId;
	lessons: PackLesson[];
};

const packs: PackFile[] = [pack6e, pack5e, pack4e, pack3e] as PackFile[];

function hydrate(pack: PackFile, lesson: PackLesson): CurriculumLesson {
	const grade = lesson.grade ?? pack.grade;
	if (!grade) throw new Error(`Missing grade for lesson ${lesson.id}`);
	return {
		id: lesson.id,
		packVersion: COLLEGE_MATHS_PACK_VERSION,
		country: "CI",
		cycle: "college",
		grade,
		subject: "MATH",
		competence: lesson.competence,
		theme: lesson.theme,
		title: lesson.title,
		sequence: lesson.sequence,
		exampleSituation: lesson.exampleSituation,
		skills: lesson.skills,
		contents: lesson.contents,
		sourcePdf: pack.sourcePdf,
	};
}

const allLessons: CurriculumLesson[] = packs.flatMap((pack) =>
	pack.lessons.map((lesson) => hydrate(pack, lesson)),
);

export class JsonCurriculumCatalog implements CurriculumCatalogPort {
	packVersion(): string {
		return COLLEGE_MATHS_PACK_VERSION;
	}

	listLessons(grade: GradeId): CurriculumLesson[] {
		return allLessons.filter((lesson) => lesson.grade === grade);
	}

	listAllLessons(): CurriculumLesson[] {
		return allLessons;
	}

	getLesson(lessonId: string): CurriculumLesson | undefined {
		return allLessons.find((lesson) => lesson.id === lessonId);
	}
}

export function edayaMatterAliases(lesson: CurriculumLesson): string[] {
	return [lesson.title, ...lesson.contents];
}
