const ACCESS_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const STUDENT_ACCESS_CODE_LENGTH = 16;

export function normalizeStudentAccessCode(raw: string): string {
	return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatStudentAccessCode(raw: string): string {
	const normalized = normalizeStudentAccessCode(raw);
	return normalized.match(/.{1,4}/g)?.join("-") ?? normalized;
}

export function studentAccessCodeHint(raw: string): string {
	return normalizeStudentAccessCode(raw).slice(-4);
}

export function isCompleteStudentAccessCode(raw: string): boolean {
	return normalizeStudentAccessCode(raw).length === STUDENT_ACCESS_CODE_LENGTH;
}

export function generateStudentAccessCode(
	random: Uint8Array = crypto.getRandomValues(new Uint8Array(STUDENT_ACCESS_CODE_LENGTH)),
): string {
	let normalized = "";
	for (let index = 0; index < STUDENT_ACCESS_CODE_LENGTH; index += 1) {
		const byte = random[index % random.length] ?? 0;
		normalized += ACCESS_CODE_ALPHABET[byte % ACCESS_CODE_ALPHABET.length];
	}
	return formatStudentAccessCode(normalized);
}

export async function hashStudentAccessCode(raw: string): Promise<string> {
	const normalized = normalizeStudentAccessCode(raw);
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(normalized),
	);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}
