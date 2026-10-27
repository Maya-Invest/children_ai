import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function getMigrationsFolder(): string {
	return join(dirname(fileURLToPath(import.meta.url)), "../drizzle");
}

export async function runMigrations(
	db: unknown,
	driver: "pglite" | "node-postgres",
): Promise<void> {
	const migrationsFolder = getMigrationsFolder();
	const { migrate } = driver === "pglite"
		? await import("drizzle-orm/pglite/migrator")
		: await import("drizzle-orm/node-postgres/migrator");
	await migrate(db as never, { migrationsFolder });
}
