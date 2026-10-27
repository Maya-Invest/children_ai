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

export type PostgresPoolConfig = {
	connectionString: string;
	max: 1;
	ssl?: false;
};

/** Worker-to-Hyperdrive is a local socket. TLS to Neon is Hyperdrive's job. */
export function isHyperdriveConnectionString(connectionString: string): boolean {
	const host = postgresHostname(connectionString);
	return host === "hyperdrive.local" || host.endsWith(".hyperdrive.local");
}

/**
 * Hyperdrive must be opened with `ssl: false`. `sslmode=require` makes node-postgres
 * read system CA files synchronously, which Workers cancel as a hung request.
 * Direct Neon URLs (CI migrate) keep their sslmode.
 */
export function postgresPoolConfig(connectionString: string): PostgresPoolConfig {
	if (!isHyperdriveConnectionString(connectionString)) {
		return { connectionString, max: 1 };
	}
	return {
		connectionString: stripSslMode(connectionString),
		max: 1,
		ssl: false,
	};
}

function postgresHostname(connectionString: string): string {
	const withoutProtocol = connectionString.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
	const at = withoutProtocol.lastIndexOf("@");
	const hostAndPath = at === -1 ? withoutProtocol : withoutProtocol.slice(at + 1);
	const hostport = hostAndPath.split("/")[0] ?? "";
	return hostport.replace(/:\d+$/, "").toLowerCase();
}

function stripSslMode(connectionString: string): string {
	const queryAt = connectionString.indexOf("?");
	if (queryAt === -1) return connectionString;
	const base = connectionString.slice(0, queryAt);
	const params = connectionString
		.slice(queryAt + 1)
		.split("&")
		.filter((part) => {
			const key = part.split("=")[0]?.toLowerCase();
			return key !== "sslmode" && key !== "ssl";
		});
	return params.length === 0 ? base : `${base}?${params.join("&")}`;
}
