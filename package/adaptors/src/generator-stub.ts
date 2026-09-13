import type {
	CurriculumLesson,
	ExerciseGeneratorPort,
	ExerciseQuestion,
	ExerciseSet,
	IdGenerator,
	LearnerAcademicSnapshot,
	PracticeFocus,
} from "@children-ai/domain";

export class StubExerciseGenerator implements ExerciseGeneratorPort {
	constructor(private readonly ids: IdGenerator) {}

	async generate(input: {
		snapshot: LearnerAcademicSnapshot;
		lesson: CurriculumLesson;
		focus: PracticeFocus;
	}): Promise<ExerciseSet> {
		const { snapshot, lesson } = input;
		const name = snapshot.context.student.firstName;
		const questions: ExerciseQuestion[] = lesson.skills.slice(0, 5).map((skill, index) => ({
			id: this.ids.next(),
			kind: "short",
			prompt: questionFor(lesson, skill, name, index),
		}));

		return {
			id: this.ids.next(),
			snapshotId: snapshot.id,
			schoolId: snapshot.schoolId,
			studentId: snapshot.studentId,
			lessonId: lesson.id,
			generatedAt: new Date().toISOString(),
			generator: "stub",
			promptVersion: "stub-v1",
			questions,
		};
	}
}

function questionFor(
	lesson: CurriculumLesson,
	skill: string,
	name: string,
	index: number,
): string {
	const content = lesson.contents[index] ?? lesson.contents[0] ?? lesson.title;
	return `${name}, pour la leçon officielle « ${lesson.title} » (${lesson.theme.title}) : ${skill.toLowerCase()}. Travaille à partir de la notion « ${content} ». Pas de solution fournie — écris ta démarche.`;
}
