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

/** Must match Edaya `localChildrenAiS2sApiKey` (onboarding mint on palier local). */
export function deriveLocalChildrenAiApiKey(schoolId: string): string {
	return `s2s_live_local_${schoolId.replaceAll("-", "")}_children_ai01`;
}

type MutableCredentialsPort = EdayaCredentialsPort & {
	put(record: SchoolCredentials): void | Promise<void>;
};

export class LocalDerivingCredentialsPort implements EdayaCredentialsPort {
	constructor(
		private readonly inner: MutableCredentialsPort,
		private readonly options: {
			edayaApiBaseUrl: string;
			academicYearId?: string;
		},
	) {}

	put(record: SchoolCredentials): void | Promise<void> {
		return this.inner.put(record);
	}

	async getActive(schoolId: string): Promise<SchoolCredentials | null> {
		const existing = await this.inner.getActive(schoolId);
		if (existing) return existing;
		const trimmed = schoolId.trim();
		if (!trimmed) return null;
		const record = demoSchoolCredentials({
			schoolId: trimmed,
			edayaApiBaseUrl: this.options.edayaApiBaseUrl,
			academicYearId: this.options.academicYearId,
			apiKey: deriveLocalChildrenAiApiKey(trimmed),
		});
		await this.inner.put(record);
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
