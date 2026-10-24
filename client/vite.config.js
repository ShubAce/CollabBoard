import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, import.meta.dirname, "");
	// In production Vercel rewrites /api to the backend (vercel.json); in dev, Vite does it.
	const apiTarget = env.DEV_API_TARGET || "http://localhost:5000";

	return {
		plugins: [react(), tailwindcss()],
		server: {
			host: true,
			proxy: {
				"/api": { target: apiTarget, changeOrigin: true },
				"/socket.io": { target: apiTarget, changeOrigin: true, ws: true },
			},
		},
	};
});
