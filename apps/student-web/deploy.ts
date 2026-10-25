const publicKeys = ["PUBLIC_API_URL", "PUBLIC_AUTH_URL"] as const;

function selectedEnv(argv: readonly string[]): string | undefined {
	const index = argv.indexOf("--env");
	if (index === -1) return undefined;
	const name = argv[index + 1];
	if (!name || name.startsWith("-")) throw new Error("deploy expects --env staging or --env prod");
	return name;
}

function parseJsonc(text: string): {
	vars?: Record<string, string>;
	env?: Record<string, { vars?: Record<string, string> }>;
} {
	const withoutBlocks = text.replace(/\/\*[\s\S]*?\*\//g, "");
	const withoutLines = withoutBlocks.replace(/^\s*\/\/.*$/gm, "");
	return JSON.parse(withoutLines);
}

async function publicVars(environment: string | undefined): Promise<Record<string, string>> {
	const text = await Bun.file(new URL("./wrangler.jsonc", import.meta.url)).text();
	const config = parseJsonc(text);
	const source = environment ? config.env?.[environment]?.vars : config.vars;
	if (!source) throw new Error(`wrangler.jsonc has no vars for ${environment ?? "the top-level config"}`);
	const vars: Record<string, string> = {};
	for (const key of publicKeys) {
		const value = source[key]?.trim();
		if (!value) throw new Error(`${key} is missing from wrangler.jsonc${environment ? ` env.${environment}` : ""}`);
		vars[key] = value;
	}
	return vars;
}

async function run(command: string[], env: Record<string, string | undefined>): Promise<number> {
	const child = Bun.spawn(command, {
		cwd: import.meta.dir,
		env,
		stdout: "inherit",
		stderr: "inherit",
	});
	return child.exited;
}

const environment = selectedEnv(process.argv.slice(2));
const env = { ...process.env, ...await publicVars(environment) };
const buildCode = await run(["bun", "x", "vite", "build"], env);
if (buildCode !== 0) process.exit(buildCode);
const deployArgs = ["bun", "x", "wrangler", "deploy", ...(environment ? ["--env", environment] : [])];
process.exit(await run(deployArgs, env));
