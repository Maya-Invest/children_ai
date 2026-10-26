import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	const authOrigin = env.AUTH_URL || env.PUBLIC_AUTH_URL || "http://localhost:9999";
	const authProxy = {
		"/auth": { target: authOrigin, changeOrigin: true },
	};

	return {
		plugins: [sveltekit()],
		// esbuild 0.28 cannot lower destructuring to Vite's default old-browser target.
		build: { target: "es2022" },
		optimizeDeps: { esbuildOptions: { target: "es2022" } },
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
