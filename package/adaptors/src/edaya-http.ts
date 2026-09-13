import {
	EdayaContextFetchError,
	type AssessmentMark,
	type ClassProgressItem,
	type EdayaContextPort,
	type EdayaCredentialsPort,
	type GradeId,
	type GuardianChildrenListing,
	type GuardianChildrenPort,
	type GuardianChildrenQuery,
	type LearnerContext,
	type LearnerContextQuery,
	type SchoolCredentials,
} from "@children-ai/domain";
import { SchoolIntegrationMissingError } from "@children-ai/domain";

export type EdayaFetch = (
	input: string,
	init?: RequestInit,
) => Promise<Response>;

export type HttpEdayaContextOptions = {
	credentials: EdayaCredentialsPort;
	schoolId?: string;
	fetchImpl?: EdayaFetch;
	now?: () => Date;
};

type JsonRecord = Record<string, unknown>;

/**
 * Live EDAYA `/core/entities/{publicName}/list` adaptor.
 * Uses the school's children-ai S2S Bearer on this palier and filters to linked children.
 */
export class HttpEdayaContext implements EdayaContextPort, GuardianChildrenPort {
	private readonly fetchImpl: EdayaFetch;
	private readonly now: () => Date;

	constructor(private readonly options: HttpEdayaContextOptions) {
		this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
		this.now = options.now ?? (() => new Date());
	}

	async listChildren(query: GuardianChildrenQuery): Promise<GuardianChildrenListing> {
		const schoolId = this.options.schoolId?.trim() ?? "";
		if (!schoolId) {
			return { schoolId: "", displayName: query.email ?? "Parent", children: [] };
		}
		const credentials = await this.options.credentials.getActive(schoolId);
		if (!credentials) {
			return { schoolId, displayName: query.email ?? "Parent", children: [] };
		}

		let guardians = await this.listOptional(credentials, "guardians", {
			schoolId,
			subjectId: query.subjectId,
		});
		if (guardians.length === 0 && query.email) {
			guardians = await this.listOptional(credentials, "guardians", {
				schoolId,
				email: query.email,
			});
		}
		const guardian = guardians.find((row) => {
			if (query.subjectId && asString(row.subjectId) === query.subjectId) return true;
			if (query.email && asString(row.email).toLowerCase() === query.email.toLowerCase()) {
				return true;
			}
			return false;
		}) ?? guardians[0];

		const displayName = guardian
			? `${asString(guardian.firstName)} ${asString(guardian.lastName)}`.trim()
			: (query.email ?? "Parent");

		if (!guardian) {
			return { schoolId, displayName, children: [] };
		}

		const links = await this.listOptional(credentials, "guardian-links", {
			schoolId,
			guardianId: asString(guardian.id),
		});
		const studentIds = [
			...new Set(
				links
					.map((row) => asString(row.studentId))
					.filter(Boolean),
			),
		];
		const children = [];
		for (const studentId of studentIds) {
			const students = await this.listOptional(credentials, "students", { id: studentId });
			const student = students.find((row) => asString(row.id) === studentId);
			if (!student) continue;
			if (asString(student.schoolId) && asString(student.schoolId) !== schoolId) continue;
			children.push({
				studentId,
				schoolId,
				firstName: asString(student.firstName) || "Élève",
				lastName: asString(student.lastName),
			});
		}
		return { schoolId, displayName: displayName || "Parent", children };
	}

	async pullLearnerContext(query: LearnerContextQuery): Promise<LearnerContext> {
		const credentials = await this.options.credentials.getActive(query.schoolId);
		if (!credentials) throw new SchoolIntegrationMissingError(query.schoolId);

		const student = await this.requireStudent(credentials, query);
		const enrollments = await this.list(credentials, "enrollments", {
			studentId: query.studentId,
		});
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
		const gradeLevels = classGroup
			? await this.list(credentials, "grade-levels", {
					id: asString(classGroup.gradeLevelId),
				})
			: [];
		const gradeLevel =
			gradeLevels.find(
				(row) => asString(row.id) === asString(classGroup?.gradeLevelId),
			) ?? gradeLevels[0];

		const [subjects, assessments, results, notes, attendances, years, periods] =
			await Promise.all([
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
			]);

		const mathSubjectIds = new Set(
			subjects
				.filter((row) => isMathSubject(row))
				.map((row) => asString(row.id))
				.filter(Boolean),
		);
		const classSubjects = classGroupId
			? (await this.listOptional(credentials, "class-subjects", { classGroupId }))
					.filter((row) => mathSubjectIds.has(asString(row.subjectId)))
			: [];
		const mathClassSubjectIds = new Set(
			classSubjects.map((row) => asString(row.id)).filter(Boolean),
		);

		const marks = buildMarks(assessments, results, query.studentId, mathClassSubjectIds);
		const classProgress = await this.loadClassProgress(
			credentials,
			classSubjects,
		);
		const reportCards = await this.listOptional(credentials, "results", {
			studentId: query.studentId,
		});
		const bulletin = pickBulletin(reportCards, query.studentId);
		const period = pickPeriod(periods, this.now());

		return {
			student: {
				edayaStudentId: query.studentId,
				firstName: asString(student.firstName) || "Élève",
				lastName: asString(student.lastName),
				grade: mapGrade(gradeLevel),
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
			attendance: summarizeAttendance(attendances, query.studentId),
			observations: notes
				.filter(
					(row) =>
						asString(row.studentId) === query.studentId
						&& asString(row.visibility) !== "admin_only",
				)
				.map((row) => asString(row.body) || asString(row.title))
				.filter(Boolean),
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
	): Promise<ClassProgressItem[]> {
		const items: ClassProgressItem[] = [];
		for (const classSubject of classSubjects) {
			const matters = await this.listOptional(credentials, "class-subject-matters", {
				classSubjectId: asString(classSubject.id),
			});
			for (const matter of matters) {
				const subjectMatters = await this.listOptional(credentials, "subject-matters", {
					id: asString(matter.subjectMatterId),
				});
				const name =
					asString(subjectMatters[0]?.name) || asString(matter.notes) || "Chapitre";
				const progressRows = await this.listOptional(
					credentials,
					"class-subject-progress",
					{ classSubjectMatterId: asString(matter.id) },
				);
				const latest = progressRows.at(-1);
				const completed =
					asNumber(latest?.completedPercentage)
					?? asNumber(matter.completedPercentage)
					?? 0;
				items.push({ subjectMatter: name, completedPercentage: completed });
			}
		}
		return items;
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
	mathClassSubjectIds: Set<string>,
): AssessmentMark[] {
	const byId = new Map(assessments.map((row) => [asString(row.id), row]));
	const marks: AssessmentMark[] = [];
	for (const result of results) {
		if (asString(result.studentId) !== studentId) continue;
		const assessment = byId.get(asString(result.assessmentId));
		if (!assessment) continue;
		if (
			mathClassSubjectIds.size > 0
			&& !mathClassSubjectIds.has(asString(assessment.classSubjectId))
		) {
			continue;
		}
		const score = asNumber(result.score);
		if (score === undefined) continue;
		marks.push({
			id: asString(result.id) || asString(assessment.id),
			subject: "MATH",
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

function isMathSubject(row: JsonRecord): boolean {
	const code = asString(row.code).toUpperCase();
	const name = asString(row.name).toLowerCase();
	return code === "MATH" || name.includes("math");
}

function mapGrade(gradeLevel: JsonRecord | undefined): GradeId {
	const haystack = `${asString(gradeLevel?.label)} ${asString(gradeLevel?.name)} ${asString(gradeLevel?.id)}`.toLowerCase();
	if (haystack.includes("3") || haystack.includes("trois")) return "3e";
	if (haystack.includes("4") || haystack.includes("quatr")) return "4e";
	if (haystack.includes("5") || haystack.includes("cinq")) return "5e";
	return "6e";
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
