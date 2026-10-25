import { eq } from "drizzle-orm";
import {
	decryptVaultSecret,
	encryptVaultSecret,
} from "@children-ai/adaptors";
import type { EdayaCredentialsPort, SchoolCredentials, SchoolIntegration } from "@children-ai/domain";
import type { SparkDb } from "./repositories.ts";
import { schoolIntegrations } from "./schema.ts";

function readIntegration(value: unknown): SchoolIntegration {
	if (typeof value === "string") return JSON.parse(value) as SchoolIntegration;
	return value as SchoolIntegration;
}

export class PostgresSchoolIntegrationVault implements EdayaCredentialsPort {
	constructor(
		private readonly db: SparkDb,
		private readonly masterKey: string,
	) {}

	async put(record: SchoolCredentials): Promise<void> {
		const sealed = await encryptVaultSecret(this.masterKey, record.apiKey);
		await this.db
			.insert(schoolIntegrations)
			.values({
				schoolId: record.integration.schoolId,
				status: record.integration.status,
				integration: record.integration,
				secretIv: sealed.iv,
				secretCiphertext: sealed.ciphertext,
			})
			.onConflictDoUpdate({
				target: schoolIntegrations.schoolId,
				set: {
					status: record.integration.status,
					integration: record.integration,
					secretIv: sealed.iv,
					secretCiphertext: sealed.ciphertext,
				},
			});
	}

	async getActive(schoolId: string): Promise<SchoolCredentials | null> {
		const rows = await this.db
			.select()
			.from(schoolIntegrations)
			.where(eq(schoolIntegrations.schoolId, schoolId))
			.limit(1);
		const row = rows[0];
		if (!row || row.status !== "active") return null;
		const integration = readIntegration(row.integration);
		if (integration.status !== "active") return null;
		const apiKey = await decryptVaultSecret(this.masterKey, {
			iv: row.secretIv,
			ciphertext: row.secretCiphertext,
		});
		return { integration, apiKey };
	}
}
