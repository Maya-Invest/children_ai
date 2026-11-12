/** Payloads shaped like the Edaya routes Edaya Spark already parses. */

export const SCHOOL_ID = "sch-edaya-ci-cocody";
export const ACADEMIC_YEAR_ID = "2025-ci";
export const S2S_API_KEY = "s2s_live_dev_edaya_ci_cocody_edaya_spark_key01";
export const RESOLVE_SECRET = "local-edaya-spark-resolve-secret";
export const PARENT_SUBJECT_ID = "parent-sub";
export const STAFF_SUBJECT_ID = "staff-sub";
export const STUDENT_ID = "ci-s1";
export const SECOND_STUDENT_ID = "ci-s10";
export const CLASS_GROUP_ID = "ci-6a";
export const GRADE_LEVEL_ID = "ci-gl-6";

const TIMETABLE_DAYS = [
	"sunday",
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
] as const;

export function utcTimetableDay(now = new Date()): (typeof TIMETABLE_DAYS)[number] {
	return TIMETABLE_DAYS[now.getUTCDay()] ?? "monday";
}

const parentChildren = [
		{
			studentId: STUDENT_ID,
			schoolId: SCHOOL_ID,
			firstName: "Aminata",
			lastName: "Koné",
			classLabel: "6ème",
			gradeLevel: {
				id: GRADE_LEVEL_ID,
				name: "Sixième",
				label: "6ème",
				order: 1,
				cycle: "Collège",
			},
		},
		{
			studentId: SECOND_STUDENT_ID,
			schoolId: SCHOOL_ID,
			firstName: "Yao",
			lastName: "Koffi",
			classLabel: "6ème",
			gradeLevel: {
				id: GRADE_LEVEL_ID,
				name: "Sixième",
				label: "6ème",
				order: 1,
				cycle: "Collège",
			},
		},
];

export const resolveParent = {
	schoolId: SCHOOL_ID,
	displayName: "Mariam Koné",
	children: parentChildren,
	schools: [
		{
			schoolId: SCHOOL_ID,
			schoolName: "Groupe scolaire Cocody",
			children: parentChildren,
		},
	],
};

export const resolveEmpty = {
	schoolId: "",
	displayName: "",
	children: [],
	schools: [],
};

export function entityRows(name: string, dayOfWeek: string): Record<string, unknown>[] {
	switch (name) {
		case "students":
			return [{
				id: STUDENT_ID,
				schoolId: SCHOOL_ID,
				firstName: "Aminata",
				lastName: "Koné",
			}];
		case "enrollments":
			return [{
				id: "ci-enr-s1",
				studentId: STUDENT_ID,
				classGroupId: CLASS_GROUP_ID,
				academicYearId: ACADEMIC_YEAR_ID,
			}];
		case "class-groups":
			return [{
				id: CLASS_GROUP_ID,
				schoolId: SCHOOL_ID,
				gradeLevelId: GRADE_LEVEL_ID,
				name: "6ème 1",
				academicYearId: ACADEMIC_YEAR_ID,
			}];
		case "grade-levels":
			return [{
				id: GRADE_LEVEL_ID,
				schoolId: SCHOOL_ID,
				name: "Sixième",
				label: "6ème",
				order: 1,
				cycle: "Collège",
			}];
		case "subjects":
			return [{
				id: "ci-subj-math",
				schoolId: SCHOOL_ID,
				name: "Mathématiques",
				code: "MATH",
			}];
		case "class-subjects":
			return [{
				id: "ci-cs-6a-math",
				classGroupId: CLASS_GROUP_ID,
				subjectId: "ci-subj-math",
			}];
		case "assessments":
			return [{
				id: "ci-as-math-1",
				classGroupId: CLASS_GROUP_ID,
				classSubjectId: "ci-cs-6a-math",
				title: "Numération",
				maxScore: 20,
				startsAt: "2026-10-01T08:00:00.000Z",
			}];
		case "assessment-results":
			return [{
				id: "ci-ar-s1-math",
				studentId: STUDENT_ID,
				assessmentId: "ci-as-math-1",
				score: 12,
			}];
		case "academic-years":
			return [{
				id: ACADEMIC_YEAR_ID,
				schoolId: SCHOOL_ID,
			}];
		case "schedules":
			return [{
				id: "ci-sched-math-today",
				classGroupId: CLASS_GROUP_ID,
				dayOfWeek,
				startTime: "08:00",
				endTime: "08:45",
				title: "Mathématiques",
				scheduleKind: "lesson",
				isRecurring: true,
			}];
		default:
			return [];
	}
}
