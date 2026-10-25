import { existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { type Subprocess } from "bun";
import {
	ACADEMIC_YEAR_ID,
	RESOLVE_SECRET,
	SCHOOL_ID,
	S2S_API_KEY,
} from "./edaya-contract.ts";
import { EDAYA_STAND_IN_ORIGIN, startEdayaDouble, type EdayaDouble } from "./edaya-double.ts";

const repoRoot = path.join(import.meta.dir, "../..");
const webRoot = path.join(repoRoot, "apps", "student-web");
const apiPort = process.env.EDAYA_SPARK_TEST_PORT ?? "18787";
const webPort = process.env.EDAYA_SPARK_WEB_PORT ?? "15175";
const webOrigin = `http://127.0.0.1:${webPort}`;
const CHROMIUM_NAMES = ["chrome-headless-shell.exe", "chrome-headless-shell", "chrome.exe", "chrome"];

const standIn: EdayaDouble = await startEdayaDouble();
const dataDir = mkdtempSync(path.join(tmpdir(), "edaya-spark-ui-"));
let api: Subprocess | undefined;
let web: Subprocess | undefined;

try {
	console.log("Starting Edaya Spark API");
	api = startApi(standIn.origin, dataDir, webOrigin);
	await waitForOk(`http://127.0.0.1:${apiPort}/health`, api, "Edaya Spark API");
	console.log("Starting student web");
	web = startWeb();
	await waitForOk(webOrigin, web, "student web");
	await ensureChromium();
	console.log("Opening Chromium");
	const journey = Bun.spawn({
		cmd: ["node", "tests/integration/ui-browser.mjs"],
		cwd: repoRoot,
		env: {
			...process.env,
			EDAYA_SPARK_WEB_ORIGIN: webOrigin,
			PLAYWRIGHT_BROWSERS_PATH: path.join(repoRoot, ".cache", "ms-playwright"),
		},
		stdout: "inherit",
		stderr: "inherit",
	});
	const code = await journey.exited;
	if (code !== 0) throw new Error(`Interface journey failed (${code})`);
} finally {
	await stop(web);
	await stop(api);
	await standIn.stop();
	rmSync(dataDir, { recursive: true, force: true });
}

function startApi(origin: string, databaseDir: string, webOrigin: string): Subprocess {
	const child = Bun.spawn({
		cmd: [process.execPath, "apps/api/src/main.ts"],
		cwd: repoRoot,
		env: {
			...process.env,
			PORT: apiPort,
			CORS_ORIGIN: webOrigin,
			RUNTIME: "local",
			PALIER: "local",
			DATABASE_URL: `pglite:${databaseDir}`,
			EDAYA_API_ORIGIN: origin,
			EDAYA_CONTEXT: "http",
			EDAYA_DEMO_SCHOOL_ID: SCHOOL_ID,
			EDAYA_DEMO_ACADEMIC_YEAR_ID: ACADEMIC_YEAR_ID,
			EDAYA_DEMO_API_KEY: S2S_API_KEY,
			EDAYA_SPARK_RESOLVE_SECRET: RESOLVE_SECRET,
			GENERATOR: "stub",
			FOCUS: "stub",
			GEMINI_API_KEY: "",
			FIXTURE_TODAY: "",
			PRACTICE_WEEKDAY: "",
		},
		stdout: "ignore",
		stderr: "inherit",
	});
	child.unref();
	return child;
}

function startWeb(): Subprocess {
	const child = Bun.spawn({
		cmd: [process.execPath, "x", "vite", "dev", "--host", "127.0.0.1", "--port", webPort, "--strictPort"],
		cwd: webRoot,
		env: {
			...process.env,
			PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`,
			PUBLIC_AUTH_URL: EDAYA_STAND_IN_ORIGIN,
			AUTH_URL: EDAYA_STAND_IN_ORIGIN,
			OTP_FLAG: "true",
		},
		stdout: "ignore",
		stderr: "inherit",
	});
	child.unref();
	return child;
}

async function waitForOk(url: string, child: Subprocess, name: string): Promise<void> {
	const deadline = Date.now() + 40_000;
	let last = "";
	while (Date.now() < deadline) {
		if (child.exitCode !== null) throw new Error(`${name} exited ${child.exitCode}`);
		try {
			const response = await fetch(url, { headers: { connection: "close" } });
			if (response.ok) return;
			last = `${response.status}`;
		} catch (error) {
			last = error instanceof Error ? error.message : String(error);
		}
		await Bun.sleep(250);
	}
	throw new Error(`${name} did not become ready. ${last}`);
}

function findChromium(dir: string): string | undefined {
	const found: string[] = [];
	collectChromium(dir, found);
	return found.find((file) => path.basename(file).startsWith("chrome-headless-shell")) ?? found[0];
}

function collectChromium(dir: string, found: string[]): void {
	if (!existsSync(dir)) return;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) collectChromium(full, found);
		else if (CHROMIUM_NAMES.includes(entry.name)) found.push(full);
	}
}

async function ensureChromium(): Promise<void> {
	const browsersPath = path.join(repoRoot, ".cache", "ms-playwright");
	mkdirSync(browsersPath, { recursive: true });
	process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;
	if (findChromium(browsersPath)) return;
	const install = Bun.spawn({
		cmd: [process.execPath, "x", "playwright", "install", "chromium"],
		cwd: repoRoot,
		env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: browsersPath },
		stdout: "inherit",
		stderr: "inherit",
	});
	const code = await install.exited;
	if (code !== 0) throw new Error(`Playwright Chromium install failed (${code})`);
	if (!findChromium(browsersPath)) {
		throw new Error(`Playwright Chromium was not found in ${browsersPath}`);
	}
}

async function stop(child: Subprocess | undefined): Promise<void> {
	if (!child) return;
	if (process.platform === "win32") {
		const killer = Bun.spawn({
			cmd: ["taskkill", "/F", "/T", "/PID", String(child.pid)],
			stdout: "ignore",
			stderr: "ignore",
		});
		killer.unref();
	} else {
		child.kill();
	}
	child.unref();
}
