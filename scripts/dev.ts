import { join } from "node:path";

const root = join(import.meta.dir, "..");

const api = Bun.spawn(["bun", "run", "dev"], {
	cwd: join(root, "apps", "api"),
	stdout: "inherit",
	stderr: "inherit",
});

const web = Bun.spawn(["bun", "run", "dev"], {
	cwd: join(root, "apps", "student-web"),
	stdout: "inherit",
	stderr: "inherit",
});

const stop = () => {
	api.kill();
	web.kill();
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

await Promise.all([api.exited, web.exited]);
