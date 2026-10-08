export const RUNTIMES = ["in-memory", "local", "worker"] as const;

export type RuntimeKind = (typeof RUNTIMES)[number];

export function parseRuntime(value: string | undefined, fallback: RuntimeKind = "local"): RuntimeKind {
	const raw = value?.trim() || fallback;
	if (!RUNTIMES.includes(raw as RuntimeKind)) {
		throw new Error(`Unknown RUNTIME "${raw}". Use ${RUNTIMES.join(", ")}.`);
	}
	return raw as RuntimeKind;
}

export function assertPersistedPgliteUrl(databaseUrl: string | undefined): string {
	const trimmed = databaseUrl?.trim() ?? "";
	const persisted = trimmed.startsWith("pglite:") || trimmed.startsWith("file://");
	const prefix = trimmed.startsWith("file://") ? "file://" : "pglite:";
	const dataDir = persisted ? trimmed.slice(prefix.length).trim() : "";
	if (!persisted || !dataDir || dataDir === "pglite") {
		throw new Error(
			"RUNTIME=local requires a persisted PGlite DATABASE_URL (e.g. pglite:.data/spark).",
		);
	}
	return trimmed;
}

export function assertWorkerHyperdrive(connectionString: string | undefined): string {
	const trimmed = connectionString?.trim() ?? "";
	if (!trimmed) {
		throw new Error("RUNTIME=worker requires a HYPERDRIVE binding with connectionString.");
	}
	return trimmed;
}
