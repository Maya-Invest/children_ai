import { openSparkDatabase } from "./open.ts";
import { runMigrations } from "./migrate.ts";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
if (!databaseUrl || databaseUrl.startsWith("pglite")) {
	throw new Error("db:migrate expects a postgres DATABASE_URL. PGlite migrates when the API opens it.");
}

const persistence = await openSparkDatabase(databaseUrl);
await runMigrations(persistence.db, "node-postgres");
await persistence.close();
console.log("Spark migrations applied.");
