import { createCloudflareRuntime, type CloudflareAdaptorEnv } from "./compose-cloudflare.ts";
import { corsPreflight, createHttpApp } from "./http.ts";

export default {
	async fetch(request: Request, env: CloudflareAdaptorEnv) {
		const extraOrigins = (env.CORS_ORIGIN ?? "")
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean);
		if (request.method === "OPTIONS") return corsPreflight(request, extraOrigins);

		const runtime = await createCloudflareRuntime(env);
		try {
			const http = createHttpApp(runtime.app, {
				sessions: runtime.sessions,
				identity: runtime.identity,
				corsOrigins: runtime.corsOrigins,
				generatorName: runtime.generatorName,
				focusName: runtime.focusName,
				palier: runtime.palier,
				contextMode: runtime.contextMode,
			});
			return await http.fetch(request);
		} finally {
			await runtime.close();
		}
	},
};
