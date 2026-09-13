const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

async function importAesKey(masterKey: string): Promise<CryptoKey> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		textEncoder.encode(masterKey),
	);
	return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
		"encrypt",
		"decrypt",
	]);
}

function bytesToB64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function b64ToBytes(value: string): Uint8Array<ArrayBuffer> {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

export async function encryptVaultSecret(
	masterKey: string,
	plaintext: string,
): Promise<{ iv: string; ciphertext: string }> {
	const key = await importAesKey(masterKey);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encrypted = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		textEncoder.encode(plaintext),
	);
	return {
		iv: bytesToB64(iv),
		ciphertext: bytesToB64(new Uint8Array(encrypted)),
	};
}

export async function decryptVaultSecret(
	masterKey: string,
	payload: { iv: string; ciphertext: string },
): Promise<string> {
	const key = await importAesKey(masterKey);
	const decrypted = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: b64ToBytes(payload.iv) },
		key,
		b64ToBytes(payload.ciphertext),
	);
	return textDecoder.decode(decrypted);
}
