import { createCloudflareRuntime, type CloudflareAdaptorEnv } from "./compose-cloudflare.ts";
import { createHttpApp } from "./http.ts";

type WorkerCtx = {
	waitUntil(promise: Promise<unknown>): void;
};

export default {
	async fetch(request: Request, env: CloudflareAdaptorEnv) {
		const runtime = await createCloudflareRuntime(env);
		const http = createHttpApp(runtime.app, {
			sessions: runtime.sessions,
			identity: runtime.identity,
			corsOrigins: runtime.corsOrigins,
			generatorName: runtime.generatorName,
			focusName: runtime.focusName,
			palier: runtime.palier,
			contextMode: runtime.contextMode,
		});
		return http.fetch(request);
	},
	async scheduled(_controller: { cron: string }, env: CloudflareAdaptorEnv, ctx: WorkerCtx) {
		const runtime = await createCloudflareRuntime(env);
		ctx.waitUntil(runtime.app.syncLinkedSnapshots());
	},
};
