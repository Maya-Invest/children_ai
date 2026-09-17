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
		const skills = lesson.skills.slice(0, 5);
		if (skills.length === 0) skills.push(lesson.title);

		const questions: ExerciseQuestion[] = skills.map((skill, index) =>
			index % 2 === 1
				? mcqQuestion(this.ids.next(), lesson, skill, name, index)
				: writtenQuestion(this.ids.next(), lesson, skill, name, index),
		);

		return {
			id: this.ids.next(),
			snapshotId: snapshot.id,
			schoolId: snapshot.schoolId,
			studentId: snapshot.studentId,
			lessonId: lesson.id,
			generatedAt: new Date().toISOString(),
			generator: "stub",
			promptVersion: "stub-v2",
			questions,
		};
	}
}

function writtenQuestion(
	id: string,
	lesson: CurriculumLesson,
	skill: string,
	name: string,
	index: number,
): ExerciseQuestion {
	const content = lesson.contents[index] ?? lesson.contents[0] ?? lesson.title;
	return {
		id,
		kind: "written",
		prompt: `${name}, pour la leçon officielle « ${lesson.title} » (${lesson.theme.title}) : ${skill.toLowerCase()}. Travaille à partir de la notion « ${content} ». Écris ta réponse dans le cadre.`,
		expectedAnswer: content,
	};
}

function mcqQuestion(
	id: string,
	lesson: CurriculumLesson,
	skill: string,
	name: string,
	index: number,
): ExerciseQuestion {
	const content = lesson.contents[index] ?? lesson.contents[0] ?? lesson.title;
	const choices = [
		content,
		"Cette affirmation est fausse.",
		"On ne peut pas conclure avec les informations données.",
	];
	return {
		id,
		kind: "mcq",
		prompt: `${name}, QCM — ${skill.toLowerCase()}. Quelle affirmation est juste pour la leçon « ${lesson.title} » ?`,
		choices,
		expectedAnswer: choices[0],
	};
}
