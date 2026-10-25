export type PracticeIntent = 'upcoming_work' | 'improve_results' | 'prepare_next_day';

export type PracticeTrackKind = 'revision' | 'homework';

export type StudentActor = {
	role: 'student';
	studentId: string;
	schoolId: string;
	guardianSubjectId: string;
	codeId: string;
	displayName: string;
	childFirstName: string;
	sessionKind?: 'demo' | 'code';
};

export type GuardianActor = {
	role: 'guardian';
	subjectId: string;
	schoolId: string;
	displayName: string;
	sessionKind?: 'demo';
};

export type Actor = StudentActor | GuardianActor;

export type Mark = {
	id: string;
	subject: string;
	title: string;
	score: number;
	maxScore: number;
	date: string;
};

export type Question = {
	id: string;
	prompt: string;
	kind: 'mcq' | 'written' | 'short';
	choices?: string[];
	expectedAnswer?: string;
	answered?: boolean;
	correct?: boolean;
};

export type ExerciseSet = {
	id: string;
	snapshotId: string;
	lessonId: string;
	generatedAt: string;
	generator: string;
	questions: Question[];
	answers?: { questionId: string; value: string }[];
	submittedAt?: string;
	score?: { correct: number; total: number };
	correctionReleasedAt?: string | null;
	track?: PracticeTrackKind;
	plannedMinutes?: number;
};

export type GuardianChildView = {
	studentId: string;
	schoolId: string;
	firstName: string;
	lastName: string;
	classLabel?: string;
	gradeLevel?: {
		id: string;
		name: string;
		label: string;
		order: number;
		cycle?: string;
	};
	accessCode: { hint: string } | null;
};

export type ParentChildrenPayload = {
	guardian: GuardianActor;
	schoolId: string;
	displayName: string;
	children: GuardianChildView[];
	emptyMessage?: string;
};

export type HomeTrackItem = {
	lessonId: string;
	lessonTitle: string;
	subjectLabel: string | null;
	minutes: number;
	assessmentLabel: string | null;
	questionTarget: number;
	canGenerate: boolean;
	currentSet: ExerciseSet | null;
};

export type HomeTrack = {
	kind: PracticeTrackKind;
	minutes: number;
	available: boolean;
	lessonTitle: string | null;
	subjectLabel: string | null;
	assessmentLabel: string | null;
	currentSet: ExerciseSet | null;
	questionTarget: number;
	canGenerate: boolean;
	items?: HomeTrackItem[];
};

export type HomePayload = {
	actor: Actor;
	student: {
		firstName: string;
		lastName: string;
		gradeLevel: {
			id: string;
			name: string;
			label: string;
			order: number;
			cycle?: string;
		};
		classLabel: string;
	};
	snapshot: {
		id: string;
		createdAt: string;
		packVersion: string;
	};
	marks: Mark[];
	rank?: { rank: number; classSize: number; overallAverage: number };
	classProgress: { subject?: string; subjectMatter: string; completedPercentage: number }[];
	timetable: {
		id: string;
		dayOfWeek: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
		startTime: string;
		endTime: string;
		title: string;
		kind: "lesson" | "activity";
	}[];
	attendance?: { presentRate: number };
	observations: string[];
	subjects: string[];
	programmeLine: string;
	focus: { lessonId: string; rationale: string; brief?: string; subject?: string; intent?: PracticeIntent } | null;
	focusSubject?: string;
	focusIntent?: PracticeIntent | null;
	planningDate?: string;
	lessonTitle: string;
	session: {
		summary: string;
		totalMinutes: number;
		tracks: HomeTrack[];
	};
	canGenerate: boolean;
	currentSet: ExerciseSet | null;
	history: ExerciseSet[];
	autoReleaseCorrection: boolean;
};
