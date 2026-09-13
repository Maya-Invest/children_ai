import {
	CHILDREN_AI_SERVICE_ID,
	type EdayaCredentialsPort,
	type SchoolCredentials,
	type SchoolIntegration,
} from "@children-ai/domain";
import { decryptVaultSecret, encryptVaultSecret } from "@children-ai/adaptors";
import type { KvNamespaceLike } from "./kv-store.ts";

type VaultRecord = {
	v: 1;
	integration: Omit<SchoolIntegration, "serviceId"> & {
		serviceId: typeof CHILDREN_AI_SERVICE_ID;
	};
	iv: string;
	ciphertext: string;
};

function vaultKey(schoolId: string): string {
	return `vault:school:${schoolId}`;
}

export class KvSchoolIntegrationVault implements EdayaCredentialsPort {
	constructor(
		private readonly kv: KvNamespaceLike,
		private readonly masterKey: string,
	) {}

	async put(record: SchoolCredentials): Promise<void> {
		const sealed = await encryptVaultSecret(this.masterKey, record.apiKey);
		const stored: VaultRecord = {
			v: 1,
			integration: record.integration,
			iv: sealed.iv,
			ciphertext: sealed.ciphertext,
		};
		await this.kv.put(vaultKey(record.integration.schoolId), JSON.stringify(stored));
	}

	async getActive(schoolId: string): Promise<SchoolCredentials | null> {
		const raw = await this.kv.get(vaultKey(schoolId));
		if (!raw) return null;
		const stored = JSON.parse(raw) as VaultRecord;
		if (stored.integration.status !== "active") return null;
		const apiKey = await decryptVaultSecret(this.masterKey, {
			iv: stored.iv,
			ciphertext: stored.ciphertext,
		});
		return { integration: stored.integration, apiKey };
	}
}
