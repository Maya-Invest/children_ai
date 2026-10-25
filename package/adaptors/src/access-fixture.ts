import {
	demoFamilyChildren,
	type GuardianChildrenListing,
	type GuardianChildrenPort,
	type GuardianChildrenQuery,
} from "@edaya-spark/domain";
import { FIXTURE_SCHOOL_ID } from "./edaya-fixture.ts";

export class FixtureGuardianChildrenPort implements GuardianChildrenPort {
	constructor(private readonly schoolId = FIXTURE_SCHOOL_ID) {}

	async listChildren(query: GuardianChildrenQuery): Promise<GuardianChildrenListing> {
		const local = query.email?.split("@")[0]?.replace(/[._]/g, " ") ?? "Parent";
		const displayName = titleCase(local);
		return {
			schoolId: this.schoolId,
			displayName,
			children: demoFamilyChildren().map((child) => ({
				...child,
				schoolId: this.schoolId,
			})),
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
