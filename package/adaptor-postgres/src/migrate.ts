import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate as migrateNodePostgres } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";

export function getMigrationsFolder(): string {
	return join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
}

export async function runMigrations(
	db: unknown,
	driver: "pglite" | "node-postgres",
): Promise<void> {
	const migrationsFolder = getMigrationsFolder();
	const migrate = driver === "pglite" ? migratePglite : migrateNodePostgres;
	await migrate(db as never, { migrationsFolder });
}
