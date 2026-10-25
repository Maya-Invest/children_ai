declare global {
	namespace App {
		interface PageState {
			setId?: string;
			filter?: 'all' | 'correct' | 'incorrect' | 'unanswered';
			followTab?: 'timetable' | 'progress' | 'marks';
			subjectSlug?: string;
			questionNumber?: number;
		}
	}
}

export {};
