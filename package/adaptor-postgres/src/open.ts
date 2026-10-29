import { postgresPoolConfig, resolveSparkDatabaseTarget, type SparkDatabaseTarget } from "./database-url.ts";
import { runMigrations } from "./migrate.ts";
import {
	PostgresExerciseSetRepository,
	PostgresPracticePlanRepository,
	PostgresPracticeSettingsRepository,
	PostgresSessionStore,
	PostgresSnapshotRepository,
	PostgresStudentAccessCodeRepository,
	type SparkDb,
} from "./repositories.ts";
import * as schema from "./schema.ts";

export type SparkPersistence = {
	target: SparkDatabaseTarget;
	db: SparkDb;
	snapshots: PostgresSnapshotRepository;
	sets: PostgresExerciseSetRepository;
	plans: PostgresPracticePlanRepository;
	practiceSettings: PostgresPracticeSettingsRepository;
	codes: PostgresStudentAccessCodeRepository;
	sessions: PostgresSessionStore;
	close(): Promise<void>;
};

const cache = new Map<string, Promise<SparkPersistence>>();

export async function openSparkDatabase(
	databaseUrl: string,
	options: { repoRoot?: string } = {},
): Promise<SparkPersistence> {
	const target = resolveSparkDatabaseTarget(databaseUrl, options);
	// A cached pg.Pool survives across Worker requests. The isolate freezes, the socket dies,
	// and the next query never settles. Hyperdrive already pools, so each request opens its own.
	if (target.kind === "ephemeral" || target.kind === "postgres") return openTarget(target);
	const key = `pglite:${target.dataDir}`;
	const existing = cache.get(key);
	if (existing) return existing;
	const opening = openTarget(target);
	cache.set(key, opening);
	opening.catch(() => {
		cache.delete(key);
	});
	return opening;
}

async function openTarget(target: SparkDatabaseTarget): Promise<SparkPersistence> {
	if (target.kind === "postgres") return openPostgres(target);
	return openPglite(target.kind === "pglite" ? target.dataDir : undefined, target);
}

async function openPglite(dataDir: string | undefined, target: SparkDatabaseTarget): Promise<SparkPersistence> {
	const { mkdirSync } = await import("node:fs");
	const { PGlite } = await import("@electric-sql/pglite");
	const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
	if (dataDir) mkdirSync(dataDir, { recursive: true });
	const client = dataDir ? new PGlite(dataDir) : new PGlite();
	const db = drizzlePglite(client, { schema }) as SparkDb;
	await runMigrations(db, "pglite");
	return bundle(db, target, async () => {
		await client.close();
	});
}

async function openPostgres(target: Extract<SparkDatabaseTarget, { kind: "postgres" }>): Promise<SparkPersistence> {
	const { drizzle } = await import("drizzle-orm/node-postgres");
	const { default: pg } = await import("pg");
	const pool = new pg.Pool(postgresPoolConfig(target.url));
	const db = drizzle(pool, { schema }) as unknown as SparkDb;
	return bundle(db, target, async () => {
		await pool.end();
	});
}

function bundle(
	db: SparkDb,
	target: SparkDatabaseTarget,
	close: () => Promise<void>,
): SparkPersistence {
	return {
		target,
		db,
		snapshots: new PostgresSnapshotRepository(db),
		sets: new PostgresExerciseSetRepository(db),
		plans: new PostgresPracticePlanRepository(db),
		practiceSettings: new PostgresPracticeSettingsRepository(db),
		codes: new PostgresStudentAccessCodeRepository(db),
		sessions: new PostgresSessionStore(db),
		close,
	};
}
