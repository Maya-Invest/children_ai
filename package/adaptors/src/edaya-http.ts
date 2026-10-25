import {
	EdayaContextFetchError,
	type AssessmentMark,
	type ClassProgressItem,
	type EdayaContextPort,
	type EdayaCredentialsPort,
	type SchoolGradeLevel,
	type GuardianChildrenListing,
	type GuardianChildrenPort,
	type GuardianChildrenQuery,
	type LearnerContext,
	type LearnerContextQuery,
	type SchoolCredentials,
	type TimetableDay,
	type TimetableSlot,
	type UpcomingAssessment,
	type UpcomingAssessmentKind,
	EDAYA_SPARK_RESOLVE_SECRET_HEADER,
} from "@edaya-spark/domain";
import { SchoolIntegrationMissingError } from "@edaya-spark/domain";

export type EdayaFetch = (
	input: string,
	init?: RequestInit,
) => Promise<Response>;

export type HttpEdayaContextOptions = {
	credentials: EdayaCredentialsPort;
	fetchImpl?: EdayaFetch;
	now?: () => Date;
	resolveGuardian?: {
		origin: string;
		secret: string;
	};
};

type JsonRecord = Record<string, unknown>;

const CHILDREN_LIST_CACHE_MS = 10_000;

/**
 * Live EDAYA `/core/entities/{publicName}/list` adaptor.
 * Uses the school's edaya-spark S2S Bearer on this palier and filters to linked children.
 */
export class HttpEdayaContext implements EdayaContextPort, GuardianChildrenPort {
	private readonly fetchImpl: EdayaFetch;
	private readonly now: () => Date;
	private readonly childrenCache = new Map<string, { expiresAt: number; listing: GuardianChildrenListing }>();

	constructor(private readonly options: HttpEdayaContextOptions) {
		this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
		this.now = options.now ?? (() => new Date());
	}

	async listChildren(query: GuardianChildrenQuery): Promise<GuardianChildrenListing> {
		const resolve = this.options.resolveGuardian;
		const origin = resolve?.origin?.trim().replace(/\/+$/, "") ?? "";
		const secret = resolve?.secret?.trim() ?? "";
		if (!origin || !secret) {
			return { schoolId: "", displayName: query.email ?? "Parent", children: [] };
		}

		const cacheKey = `${origin}:${query.subjectId}`;
		const cached = this.childrenCache.get(cacheKey);
		if (cached && cached.expiresAt > Date.now()) {
			return cached.listing;
		}

		const response = await this.fetchImpl(`${origin}/internal/edaya-spark/resolve-guardian`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				[EDAYA_SPARK_RESOLVE_SECRET_HEADER]: secret,
			},
			body: JSON.stringify({ subjectId: query.subjectId }),
		});
		const text = await response.text();
		if (!response.ok) {
			throw new EdayaContextFetchError(
				`EDAYA resolve-guardian a renvoyé ${response.status}.`,
			);
		}
		const parsed = parseResolveGuardian(text);
		const listing = {
			schoolId: parsed.schoolId,
			displayName: parsed.displayName || query.email || "Parent",
			children: parsed.children,
		};
		this.childrenCache.set(cacheKey, {
			expiresAt: Date.now() + CHILDREN_LIST_CACHE_MS,
			listing,
		});
		return listing;
	}

	async pullLearnerContext(query: LearnerContextQuery): Promise<LearnerContext> {
		const credentials = await this.options.credentials.getActive(query.schoolId);
		if (!credentials) throw new SchoolIntegrationMissingError(query.schoolId);

		const [student, enrollments] = await Promise.all([
			this.requireStudent(credentials, query),
			this.list(credentials, "enrollments", {
				studentId: query.studentId,
			}),
		]);
		const enrollment =
			enrollments.find(
				(row) =>
					asString(row.studentId) === query.studentId
					&& asString(row.academicYearId) === credentials.integration.academicYearId,
			) ?? enrollments.find((row) => asString(row.studentId) === query.studentId);

		const classGroupId = enrollment ? asString(enrollment.classGroupId) : "";
		const classGroups = classGroupId
			? await this.list(credentials, "class-groups", { id: classGroupId })
			: [];
		const classGroup =
			classGroups.find((row) => asString(row.id) === classGroupId) ?? classGroups[0];

		const [
			gradeLevels,
			subjects,
			assessments,
			results,
			notes,
			attendances,
			years,
			periods,
			classSubjectsRaw,
			reportCards,
			schedules,
		] = await Promise.all([
			classGroup
				? this.listOptional(credentials, "grade-levels", {
						id: asString(classGroup.gradeLevelId),
					})
				: Promise.resolve([]),
			this.listOptional(credentials, "subjects", { schoolId: query.schoolId }),
			classGroupId
				? this.listOptional(credentials, "assessments", { classGroupId })
				: Promise.resolve([]),
			this.listOptional(credentials, "assessment-results", {
				studentId: query.studentId,
			}),
			this.listOptional(credentials, "student-notes", {
				studentId: query.studentId,
			}),
			this.listOptional(credentials, "attendances", {
				studentId: query.studentId,
			}),
			this.listOptional(credentials, "academic-years", {
				id: credentials.integration.academicYearId,
			}),
			this.listOptional(credentials, "academic-periods", {
				academicYearId: credentials.integration.academicYearId,
			}),
			classGroupId
				? this.listOptional(credentials, "class-subjects", { classGroupId })
				: Promise.resolve([]),
			this.listOptional(credentials, "results", {
				studentId: query.studentId,
			}),
			this.listSchedules(credentials, query.schoolId, classGroupId),
		]);

		const gradeLevel =
			gradeLevels.find(
				(row) => asString(row.id) === asString(classGroup?.gradeLevelId),
			) ?? gradeLevels[0];

		const marks = buildMarks(
			assessments,
			results,
			query.studentId,
			classSubjectsRaw,
			subjects,
		);
		const classProgress = await this.loadClassProgress(
			credentials,
			classSubjectsRaw,
			subjects,
		);
		const bulletin = pickBulletin(reportCards, query.studentId);
		const period = pickPeriod(periods, this.now());

		return {
			student: {
				edayaStudentId: query.studentId,
				firstName: asString(student.firstName) || "Élève",
				lastName: asString(student.lastName),
				gradeLevel: schoolGradeLevelFromEdaya(gradeLevel, asString(classGroup?.name)),
				classLabel: asString(classGroup?.name) || asString(gradeLevel?.label) || "classe",
			},
			academicYearId:
				asString(years[0]?.id) || credentials.integration.academicYearId,
			periodId: asString(period?.id) || asString(bulletin?.periodId) || "period",
			marks,
			rank: bulletin
				? {
						rank: asNumber(bulletin.rank) ?? 0,
						classSize: asNumber(bulletin.classSize) ?? 0,
						overallAverage: asNumber(bulletin.overallAverage) ?? 0,
					}
				: undefined,
			classProgress,
			timetable: buildTimetable(schedules, classGroupId),
			attendance: summarizeAttendance(attendances, query.studentId),
			observations: notes
				.filter(
					(row) =>
						asString(row.studentId) === query.studentId
						&& asString(row.visibility) !== "admin_only",
				)
				.map((row) => asString(row.body) || asString(row.title))
				.filter(Boolean),
			upcomingAssessments: buildUpcomingAssessments(
				assessments,
				results,
				query.studentId,
				classSubjectsRaw,
				subjects,
				this.now(),
			),
		};
	}

	private async requireStudent(
		credentials: SchoolCredentials,
		query: LearnerContextQuery,
	): Promise<JsonRecord> {
		const students = await this.list(credentials, "students", { id: query.studentId });
		const student = students.find((row) => asString(row.id) === query.studentId);
		if (!student) {
			throw new EdayaContextFetchError(
				`Élève ${query.studentId} introuvable sur EDAYA.`,
			);
		}
		if (asString(student.schoolId) !== query.schoolId) {
			throw new EdayaContextFetchError(
				`L'élève ${query.studentId} n'appartient pas à l'école ${query.schoolId}.`,
			);
		}
		return student;
	}

	private async loadClassProgress(
		credentials: SchoolCredentials,
		classSubjects: JsonRecord[],
		subjects: JsonRecord[],
	): Promise<ClassProgressItem[]> {
		if (classSubjects.length === 0) return [];

		const matterLists = await Promise.all(
			classSubjects.map((classSubject) =>
				this.listOptional(credentials, "class-subject-matters", {
					classSubjectId: asString(classSubject.id),
				}),
			),
		);
		const matters = matterLists.flat();
		if (matters.length === 0) return [];

		const subjectIds = [
			...new Set(classSubjects.map((row) => asString(row.subjectId)).filter(Boolean)),
		];
		const subjectMatterLists = await Promise.all(
			subjectIds.map((subjectId) =>
				this.listOptional(credentials, "subject-matters", { subjectId }),
			),
		);
		const names = new Map<string, string>();
		for (const row of subjectMatterLists.flat()) {
			const id = asString(row.id);
			if (id) names.set(id, asString(row.name) || "Chapitre");
		}

		const subjectNames = new Map<string, string>();
		for (const row of subjects) {
			const id = asString(row.id);
			if (!id) continue;
			subjectNames.set(id, asString(row.name) || asString(row.code) || "Matière");
		}
		const classSubjectById = new Map(
			classSubjects.map((row) => [asString(row.id), row] as const),
		);

		return matters.map((matter) => {
			const classSubject = classSubjectById.get(asString(matter.classSubjectId));
			const subject = subjectNames.get(asString(classSubject?.subjectId));
			return {
				...(subject ? { subject } : {}),
				subjectMatter:
					names.get(asString(matter.subjectMatterId))
					|| asString(matter.notes)
					|| "Chapitre",
				completedPercentage: asNumber(matter.completedPercentage) ?? 0,
			};
		});
	}

	private async listSchedules(
		credentials: SchoolCredentials,
		schoolId: string,
		classGroupId: string,
	): Promise<JsonRecord[]> {
		if (!classGroupId) return [];
		const byClass = await this.listOptional(credentials, "schedules", {
			classGroupId,
			$limit: 200,
		});
		if (byClass.length > 0) return byClass;
		return this.listOptional(credentials, "schedules", {
			schoolId,
			$limit: 200,
		});
	}

	private async listOptional(
		credentials: SchoolCredentials,
		publicName: string,
		filter: JsonRecord,
	): Promise<JsonRecord[]> {
		try {
			return await this.list(credentials, publicName, filter);
		} catch {
			return [];
		}
	}

	private async list(
		credentials: SchoolCredentials,
		publicName: string,
		filter: JsonRecord,
	): Promise<JsonRecord[]> {
		const origin = credentials.integration.edayaApiBaseUrl.replace(/\/+$/, "");
		const response = await this.fetchImpl(
			`${origin}/core/entities/${publicName}/list`,
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${credentials.apiKey}`,
					"x-academic-year-id": credentials.integration.academicYearId,
				},
				body: JSON.stringify(filter),
			},
		);
		const text = await response.text();
		if (!response.ok) {
			throw new EdayaContextFetchError(
				`EDAYA ${publicName}/list a renvoyé ${response.status}.`,
			);
		}
		return unwrapList(text).filter((row) => matchesFilter(row, filter));
	}
}

function parseResolveGuardian(text: string): GuardianChildrenListing {
	if (!text.trim()) {
		return { schoolId: "", displayName: "", children: [] };
	}
	const parsed: unknown = JSON.parse(text);
	if (!isRecord(parsed)) {
		return { schoolId: "", displayName: "", children: [] };
	}
	const childrenRaw = Array.isArray(parsed.children) ? parsed.children : [];
	const schoolId = asString(parsed.schoolId);
	return {
		schoolId,
		displayName: asString(parsed.displayName),
		children: childrenRaw.filter(isRecord).map((row) => {
			const classLabel = asString(row.classLabel);
			const gradeLevel = readOptionalGradeLevel(row.gradeLevel);
			return {
				studentId: asString(row.studentId) || asString(row.id),
				schoolId: asString(row.schoolId) || schoolId,
				firstName: asString(row.firstName) || "Élève",
				lastName: asString(row.lastName),
				...(classLabel ? { classLabel } : {}),
				...(gradeLevel ? { gradeLevel } : {}),
			};
		}).filter((child) => child.studentId),
	};
}

function unwrapList(text: string): JsonRecord[] {
	if (!text.trim()) return [];
	const parsed: unknown = JSON.parse(text);
	if (Array.isArray(parsed)) {
		return parsed.filter(isRecord);
	}
	if (isRecord(parsed) && Array.isArray(parsed.data)) {
		return parsed.data.filter(isRecord);
	}
	return [];
}

function matchesFilter(row: JsonRecord, filter: JsonRecord): boolean {
	for (const [key, expected] of Object.entries(filter)) {
		if (key.startsWith("$")) continue;
		if (expected === undefined || expected === "") continue;
		if (!(key in row)) continue;
		if (asString(row[key]) !== String(expected)) return false;
	}
	return true;
}

function buildMarks(
	assessments: JsonRecord[],
	results: JsonRecord[],
	studentId: string,
	classSubjects: JsonRecord[],
	subjects: JsonRecord[],
): AssessmentMark[] {
	const byId = new Map(assessments.map((row) => [asString(row.id), row]));
	const subjectsById = new Map(
		subjects.map((row) => [asString(row.id), row] as const).filter(([id]) => id),
	);
	const classSubjectsById = new Map(
		classSubjects.map((row) => [asString(row.id), row] as const).filter(([id]) => id),
	);
	const marks: AssessmentMark[] = [];
	for (const result of results) {
		if (asString(result.studentId) !== studentId) continue;
		const assessment = byId.get(asString(result.assessmentId));
		if (!assessment) continue;
		const score = asNumber(result.score);
		if (score === undefined) continue;
		const classSubject = classSubjectsById.get(asString(assessment.classSubjectId));
		const subject = subjectsById.get(asString(classSubject?.subjectId));
		marks.push({
			id: asString(result.id) || asString(assessment.id),
			subject:
				asString(subject?.name)
				|| asString(subject?.code)
				|| asString(assessment.subject)
				|| "Matière",
			title: asString(assessment.title) || "Évaluation",
			score,
			maxScore: asNumber(assessment.maxScore) ?? 20,
			date: dateOnly(
				asString(assessment.startsAt)
					|| asString(assessment.dueAt)
					|| asString(result.createdAt),
			),
		});
	}
	return marks;
}

function buildUpcomingAssessments(
	assessments: JsonRecord[],
	results: JsonRecord[],
	studentId: string,
	classSubjects: JsonRecord[],
	subjects: JsonRecord[],
	now: Date,
): UpcomingAssessment[] {
	const today = now.toISOString().slice(0, 10);
	const horizon = new Date(now.getTime());
	horizon.setUTCDate(horizon.getUTCDate() + 21);
	const horizonKey = horizon.toISOString().slice(0, 10);
	const scored = new Set(
		results
			.filter((row) => asString(row.studentId) === studentId && asNumber(row.score) !== undefined)
			.map((row) => asString(row.assessmentId))
			.filter(Boolean),
	);
	const subjectsById = new Map(
		subjects.map((row) => [asString(row.id), row] as const).filter(([id]) => id),
	);
	const classSubjectsById = new Map(
		classSubjects.map((row) => [asString(row.id), row] as const).filter(([id]) => id),
	);
	const upcoming: UpcomingAssessment[] = [];
	for (const assessment of assessments) {
		const id = asString(assessment.id);
		if (!id || scored.has(id) || asString(assessment.completedAt)) continue;
		const rawDue = asString(assessment.dueAt) || asString(assessment.startsAt);
		const dueAt = rawDue.slice(0, 10);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(dueAt) || dueAt < today || dueAt > horizonKey) continue;
		const classSubject = classSubjectsById.get(asString(assessment.classSubjectId));
		const subject = subjectsById.get(asString(classSubject?.subjectId));
		upcoming.push({
			id,
			subject:
				asString(subject?.name)
				|| asString(subject?.code)
				|| asString(assessment.subject)
				|| "Matière",
			title: asString(assessment.title) || "Évaluation",
			kind: upcomingKind(asString(assessment.kind), asString(assessment.title)),
			dueAt,
		});
	}
	return upcoming.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
}

function upcomingKind(kind: string, title: string): UpcomingAssessmentKind {
	const folded = `${kind} ${title}`.toLowerCase();
	if (kind === "homework" || folded.includes("devoir")) return "homework";
	if (folded.includes("examen") || folded.includes("composition")) return "exam";
	if (kind === "quiz") return "quiz";
	if (kind === "project") return "project";
	return "other";
}

function pickBulletin(rows: JsonRecord[], studentId: string): JsonRecord | undefined {
	return rows
		.filter((row) => asString(row.studentId) === studentId)
		.at(-1);
}

function pickPeriod(periods: JsonRecord[], now: Date): JsonRecord | undefined {
	const containing = periods.find((row) => {
		const start = Date.parse(asString(row.startDate));
		const end = Date.parse(asString(row.endDate));
		if (Number.isNaN(start) || Number.isNaN(end)) return false;
		return now.getTime() >= start && now.getTime() <= end;
	});
	return containing ?? periods.at(-1) ?? periods[0];
}

const TIMETABLE_DAYS: TimetableDay[] = [
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
	"sunday",
];

function buildTimetable(rows: JsonRecord[], classGroupId: string): TimetableSlot[] {
	const slots: TimetableSlot[] = [];
	for (const row of rows) {
		if (classGroupId && asString(row.classGroupId) && asString(row.classGroupId) !== classGroupId) {
			continue;
		}
		if (row.isRecurring === false) continue;
		const dayOfWeek = asTimetableDay(row.dayOfWeek);
		const startTime = asTime(row.startTime);
		const endTime = asTime(row.endTime);
		if (!dayOfWeek || !startTime || !endTime) continue;
		slots.push({
			id: asString(row.id) || `${dayOfWeek}-${startTime}`,
			dayOfWeek,
			startTime,
			endTime,
			title: asString(row.title) || "Cours",
			kind: asString(row.scheduleKind) === "activity" ? "activity" : "lesson",
		});
	}
	return slots.sort((left, right) => {
		const dayDelta = TIMETABLE_DAYS.indexOf(left.dayOfWeek) - TIMETABLE_DAYS.indexOf(right.dayOfWeek);
		return dayDelta !== 0 ? dayDelta : left.startTime.localeCompare(right.startTime);
	});
}

function asTimetableDay(value: unknown): TimetableDay | undefined {
	const raw = asString(value).toLowerCase();
	return TIMETABLE_DAYS.find((day) => day === raw);
}

function asTime(value: unknown): string {
	const match = asString(value).match(/^(\d{1,2}):(\d{2})/);
	const hours = match?.[1];
	const minutes = match?.[2];
	if (!hours || !minutes) return "";
	return `${hours.padStart(2, "0")}:${minutes}`;
}

function summarizeAttendance(
	rows: JsonRecord[],
	studentId: string,
): { presentRate: number } | undefined {
	const mine = rows.filter((row) => asString(row.studentId) === studentId);
	if (mine.length === 0) return undefined;
	const present = mine.filter((row) => {
		const status = asString(row.status);
		return status === "present" || status === "late";
	}).length;
	return { presentRate: present / mine.length };
}

export function schoolGradeLevelFromEdaya(
	gradeLevel: JsonRecord | undefined,
	fallbackLabel = "",
): SchoolGradeLevel {
	const parsed = readOptionalGradeLevel(gradeLevel);
	if (parsed) return parsed;
	const label = fallbackLabel.trim() || "classe";
	return { id: label, name: label, label, order: 1 };
}

function readOptionalGradeLevel(value: unknown): SchoolGradeLevel | undefined {
	if (!isRecord(value)) return undefined;
	const label = asString(value.label);
	const name = asString(value.name);
	const id = asString(value.id);
	if (!id && !name && !label) return undefined;
	const order = asNumber(value.order);
	const cycle = asString(value.cycle);
	return {
		id: id || label || name,
		name: name || label || id,
		label: label || name || id,
		order: order !== undefined && order > 0 ? order : 1,
		...(cycle ? { cycle } : {}),
	};
}

function dateOnly(value: string): string {
	if (!value) return "2025-01-01";
	return value.slice(0, 10);
}

function asString(value: unknown): string {
	if (typeof value === "string") return value;
	if (typeof value === "number") return String(value);
	return "";
}

function asNumber(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return undefined;
}

function isRecord(value: unknown): value is JsonRecord {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
