import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	const authOrigin = env.AUTH_URL || env.PUBLIC_AUTH_URL || "http://localhost:9900";
	const authProxy = {
		"/auth": { target: authOrigin, changeOrigin: true },
	};

	return {
		plugins: [sveltekit()],
		server: {
			port: 5175,
			strictPort: true,
			proxy: authProxy,
		},
		preview: {
			proxy: authProxy,
		},
	};
});
