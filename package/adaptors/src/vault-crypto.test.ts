import { describe, expect, test } from "bun:test";
import { decryptVaultSecret, encryptVaultSecret } from "./vault-crypto.ts";

describe("vault crypto", () => {
	test("round-trips a school API key", async () => {
		const master = "staging-vault-master-key-example";
		const sealed = await encryptVaultSecret(master, "sk_live_demo_edaya_spark_key01");
		expect(sealed.iv).toBeTruthy();
		expect(sealed.ciphertext).not.toContain("sk_live");
		expect(await decryptVaultSecret(master, sealed)).toBe(
			"sk_live_demo_edaya_spark_key01",
		);
	});
});
