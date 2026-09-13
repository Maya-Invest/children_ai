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
			a.subjectMatter.localeCompare(b.subjectMatter),
		),
		attendance: context.attendance ?? null,
		observations: [...context.observations].sort(),
	};

	return createHash("sha256").update(JSON.stringify(picture)).digest("hex");
}
