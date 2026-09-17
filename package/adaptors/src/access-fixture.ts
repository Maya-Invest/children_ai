import type {
	GuardianChildrenListing,
	GuardianChildrenPort,
	GuardianChildrenQuery,
} from "@children-ai/domain";
import { FIXTURE_SCHOOL_ID, FIXTURE_STUDENT_ID } from "./edaya-fixture.ts";

export class FixtureGuardianChildrenPort implements GuardianChildrenPort {
	constructor(private readonly schoolId = FIXTURE_SCHOOL_ID) {}

	async listChildren(query: GuardianChildrenQuery): Promise<GuardianChildrenListing> {
		const local = query.email?.split("@")[0]?.replace(/[._]/g, " ") ?? "Parent";
		const displayName = titleCase(local);
		return {
			schoolId: this.schoolId,
			displayName,
			children: [
				{
					studentId: FIXTURE_STUDENT_ID,
					schoolId: this.schoolId,
					firstName: "Aminata",
					lastName: "Koné",
					classLabel: "6ème 1",
					grade: "6e",
				},
			],
		};
	}
}

export class EmptyGuardianChildrenPort implements GuardianChildrenPort {
	async listChildren(query: GuardianChildrenQuery): Promise<GuardianChildrenListing> {
		return {
			schoolId: "",
			displayName: query.email ?? "Parent",
			children: [],
		};
	}
}

function titleCase(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return "Parent";
	return trimmed.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
