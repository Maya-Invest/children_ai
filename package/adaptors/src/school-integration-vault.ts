import {
	CHILDREN_AI_SERVICE_ID,
	type EdayaCredentialsPort,
	type SchoolCredentials,
	type SchoolIntegration,
} from "@children-ai/domain";
import {
	assertChildrenAiApiKey,
	LOCAL_FIXTURE_KEY,
} from "./edaya-context-mode.ts";

export type SchoolIntegrationRecord = SchoolCredentials;

export class MemorySchoolIntegrationVault implements EdayaCredentialsPort {
	private readonly bySchool = new Map<string, SchoolIntegrationRecord>();

	put(record: SchoolIntegrationRecord): void {
		this.bySchool.set(record.integration.schoolId, record);
	}

	async getActive(schoolId: string): Promise<SchoolCredentials | null> {
		const record = this.bySchool.get(schoolId);
		if (!record || record.integration.status !== "active") return null;
		return record;
	}
}

export function keyPrefixOf(apiKey: string): string {
	return apiKey.slice(0, 16);
}

export function demoSchoolCredentials(input: {
	schoolId: string;
	edayaApiBaseUrl: string;
	academicYearId?: string;
	apiKey?: string;
}): SchoolCredentials {
	const apiKey = input.apiKey?.trim() || LOCAL_FIXTURE_KEY;
	assertChildrenAiApiKey(apiKey);
	const integration: SchoolIntegration = {
		schoolId: input.schoolId,
		edayaApiBaseUrl: input.edayaApiBaseUrl,
		academicYearId: input.academicYearId ?? "2025-ci",
		serviceId: CHILDREN_AI_SERVICE_ID,
		keyPrefix: keyPrefixOf(apiKey),
		status: "active",
	};
	return { integration, apiKey };
}

export { LOCAL_FIXTURE_KEY };
