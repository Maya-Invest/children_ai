export type StudentActor = {
	role: 'student';
	studentId: string;
	schoolId: string;
	guardianSubjectId: string;
	codeId: string;
	displayName: string;
	childFirstName: string;
};

export type GuardianActor = {
	role: 'guardian';
	subjectId: string;
	schoolId: string;
	displayName: string;
};

export type Actor = StudentActor | GuardianActor;

export type Mark = {
	id: string;
	title: string;
	score: number;
	maxScore: number;
	date: string;
};

export type Question = {
	id: string;
	prompt: string;
	kind: 'short' | 'mcq';
	choices?: string[];
};

export type ExerciseSet = {
	id: string;
	snapshotId: string;
	lessonId: string;
	generatedAt: string;
	generator: string;
	questions: Question[];
};

export type GuardianChildView = {
	studentId: string;
	schoolId: string;
	firstName: string;
	lastName: string;
	classLabel?: string;
	grade?: string;
	accessCode: { hint: string } | null;
};

export type ParentChildrenPayload = {
	guardian: GuardianActor;
	schoolId: string;
	displayName: string;
	children: GuardianChildView[];
	emptyMessage?: string;
};

export type HomePayload = {
	actor: Actor;
	student: {
		firstName: string;
		lastName: string;
		grade: string;
		classLabel: string;
	};
	snapshot: {
		id: string;
		createdAt: string;
		packVersion: string;
	};
	marks: Mark[];
	rank?: { rank: number; classSize: number; overallAverage: number };
	focus: { lessonId: string; rationale: string };
	lessonTitle: string;
	canGenerate: boolean;
	currentSet: ExerciseSet | null;
	history: ExerciseSet[];
};
