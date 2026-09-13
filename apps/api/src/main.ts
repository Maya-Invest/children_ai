import { createLocalRuntime } from "./compose.ts";
import { createHttpApp } from "./http.ts";

const port = Number(process.env.PORT ?? 8787);
const runtime = createLocalRuntime();
const http = createHttpApp(runtime.app, {
	sessions: runtime.sessions,
	identity: runtime.identity,
	generatorName: runtime.generatorName,
	palier: runtime.palier,
	contextMode: runtime.contextMode,
	corsOrigins: (process.env.CORS_ORIGIN ?? "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean),
});

export default {
	port,
	fetch: http.fetch,
};

console.log(
	`Children AI API (Hono) palier=${runtime.palier} school=${runtime.schoolId} context=${runtime.contextMode} on http://localhost:${port} — generator=${runtime.generatorName}`,
);
