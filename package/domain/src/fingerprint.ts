import { createHash } from "node:crypto";
import type { LearnerContext } from "./types.ts";

export function snapshotFingerprint(
	context: LearnerContext,
	packVersion: string,
): string {
	const picture = {
		packVersion,
		academicYearId: context.academicYearId,
		periodId: context.periodId,
		grade: context.student.grade,
		classLabel: context.student.classLabel,
		marks: [...context.marks].sort((a, b) => a.id.localeCompare(b.id)),
		rank: context.rank ?? null,
		classProgress: [...context.classProgress].sort((a, b) =>
			`${a.subject ?? ""}\0${a.subjectMatter}`.localeCompare(
				`${b.subject ?? ""}\0${b.subjectMatter}`,
			),
		),
		timetable: [...(context.timetable ?? [])]
			.map((slot) => ({
				id: slot.id,
				dayOfWeek: slot.dayOfWeek,
				startTime: slot.startTime,
				endTime: slot.endTime,
				title: slot.title,
				kind: slot.kind,
			}))
			.sort((a, b) => a.id.localeCompare(b.id)),
		attendance: context.attendance ?? null,
		observations: [...context.observations].sort(),
		upcomingAssessments: [...(context.upcomingAssessments ?? [])]
			.map((item) => ({
				id: item.id,
				subject: item.subject,
				title: item.title,
				kind: item.kind,
				dueAt: item.dueAt,
			}))
			.sort((a, b) => a.id.localeCompare(b.id)),
	};

	return createHash("sha256").update(JSON.stringify(picture)).digest("hex");
}
