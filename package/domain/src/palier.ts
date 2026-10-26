import { DomainError } from "./types.ts";

export const PALIERS = ["in-memory", "local", "staging", "prod"] as const;

export type Palier = (typeof PALIERS)[number];

/** Allowed EDAYA API origins per palier. Keys never cross these hosts. */
export const PALIER_EDAYA_ORIGINS: Record<Palier, readonly string[]> = {
	"in-memory": [
		"http://edaya.fixture",
		"http://localhost:9999",
		"http://127.0.0.1:9999",
	],
	local: ["http://localhost:9999", "http://127.0.0.1:9999"],
	staging: ["https://staging.api.edayaplus.com"],
	prod: ["https://api.edayaplus.com"],
};

export function isPalier(value: string): value is Palier {
	return (PALIERS as readonly string[]).includes(value);
}

export function parsePalier(
	value: string | undefined,
	fallback: Palier = "local",
): Palier {
	if (!value?.trim()) return fallback;
	const trimmed = value.trim();
	if (!isPalier(trimmed)) {
		throw new Error(`Unknown palier "${trimmed}". Use ${PALIERS.join(", ")}.`);
	}
	return trimmed;
}

export function normalizeEdayaOrigin(origin: string): string {
	return origin.trim().replace(/\/+$/, "");
}

export function palierAllowsEdayaOrigin(palier: Palier, origin: string): boolean {
	const normalized = normalizeEdayaOrigin(origin);
	return PALIER_EDAYA_ORIGINS[palier].some(
		(allowed) => normalizeEdayaOrigin(allowed) === normalized,
	);
}

export function assertEdayaOriginAllowed(palier: Palier, origin: string): void {
	if (!palierAllowsEdayaOrigin(palier, origin)) {
		throw new PalierOriginMismatchError(palier, origin);
	}
}

export class PalierOriginMismatchError extends DomainError {
	constructor(palier: Palier, origin: string) {
		super(
			"PALIER_ORIGIN_MISMATCH",
			`L'origine EDAYA "${origin}" n'est pas autorisée sur le palier ${palier}.`,
		);
	}
}

export class SchoolIntegrationMissingError extends DomainError {
	constructor(schoolId: string) {
		super(
			"SCHOOL_INTEGRATION_MISSING",
			`Aucune intégration EDAYA active pour l'école ${schoolId}.`,
		);
	}
}

const LOCAL_VAULT_MASTER = "edaya-spark-local-vault-master-not-for-prod";

/** Staging/prod require a real master key. Local/in-memory may use a fixed non-prod default. */
export function resolveVaultMasterKey(
	palier: Palier,
	key: string | undefined,
): string {
	const trimmed = key?.trim() ?? "";
	if (palier === "staging" || palier === "prod") {
		if (!trimmed || trimmed === LOCAL_VAULT_MASTER) {
			throw new Error(
				`VAULT_MASTER_KEY is required on palier ${palier} and must not be the local default.`,
			);
		}
		return trimmed;
	}
	return trimmed || LOCAL_VAULT_MASTER;
}

export function resolvePalierEdayaOrigin(
	palier: Palier,
	configuredOrigin: string | undefined,
): string {
	const origin = normalizeEdayaOrigin(
		configuredOrigin?.trim() || PALIER_EDAYA_ORIGINS[palier][0]!,
	);
	assertEdayaOriginAllowed(palier, origin);
	return origin;
}
