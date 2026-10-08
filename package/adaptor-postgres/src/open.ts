import { mkdirSync } from "node:fs";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { resolveSparkDatabaseTarget, type SparkDatabaseTarget } from "./database-url.ts";
import { runMigrations } from "./migrate.ts";
import {
	PostgresExerciseSetRepository,
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
	if (target.kind === "ephemeral") return openTarget(target);
	const key = target.kind === "pglite" ? `pglite:${target.dataDir}` : `pg:${target.url}`;
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
	const { PGlite } = await import("@electric-sql/pglite");
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
	const pool = new pg.Pool({ connectionString: target.url, max: 1 });
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
		practiceSettings: new PostgresPracticeSettingsRepository(db),
		codes: new PostgresStudentAccessCodeRepository(db),
		sessions: new PostgresSessionStore(db),
		close,
	};
}
