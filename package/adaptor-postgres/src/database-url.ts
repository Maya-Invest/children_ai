import path from "node:path";

const EPHEMERAL_DATABASE_URLS = new Set(["memory", "pglite", "memory://"]);

export type SparkDatabaseTarget =
	| { kind: "ephemeral" }
	| { kind: "pglite"; dataDir: string }
	| { kind: "postgres"; url: string };

export function isEphemeralDatabase(databaseUrl: string): boolean {
	return EPHEMERAL_DATABASE_URLS.has(databaseUrl.trim());
}

export function isPgliteDatabase(databaseUrl: string): boolean {
	const trimmed = databaseUrl.trim();
	return isEphemeralDatabase(trimmed) || trimmed.startsWith("pglite:") || trimmed.startsWith("file://");
}

export function resolvePgliteDataDir(databaseUrl: string): string | undefined {
	const trimmed = databaseUrl.trim();
	if (!isPgliteDatabase(trimmed) || isEphemeralDatabase(trimmed)) return undefined;
	const prefix = trimmed.startsWith("file://") ? "file://" : "pglite:";
	const dataDir = trimmed.slice(prefix.length).trim();
	if (!dataDir) {
		throw new Error(`DATABASE_URL ${prefix} requires a data directory path`);
	}
	return dataDir;
}

export function resolvePersistedPgliteDataDir(
	databaseUrl: string,
	options: { repoRoot?: string } = {},
): string | undefined {
	const dataDir = resolvePgliteDataDir(databaseUrl);
	if (!dataDir) return undefined;
	if (path.isAbsolute(dataDir)) return dataDir;
	const normalized = dataDir.replace(/^\.\//, "");
	if (options.repoRoot && (normalized === ".data" || normalized.startsWith(".data/"))) {
		return path.resolve(options.repoRoot, normalized);
	}
	return dataDir;
}

export function resolveSparkDatabaseTarget(
	databaseUrl: string,
	options: { repoRoot?: string } = {},
): SparkDatabaseTarget {
	const trimmed = databaseUrl.trim();
	if (!trimmed) {
		throw new Error("DATABASE_URL is required");
	}
	if (isEphemeralDatabase(trimmed)) return { kind: "ephemeral" };
	if (isPgliteDatabase(trimmed)) {
		const dataDir = resolvePersistedPgliteDataDir(trimmed, options);
		if (!dataDir) {
			throw new Error("DATABASE_URL pglite: prefix requires a data directory path");
		}
		return { kind: "pglite", dataDir };
	}
	return { kind: "postgres", url: trimmed };
}
