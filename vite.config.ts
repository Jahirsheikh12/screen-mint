import fs from "node:fs/promises";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron/simple";

function builtInBackgroundMusicDevPlugin() {
	const audioRoot = path.resolve(__dirname, "src/assets/audio");

	return {
		name: "screenmint-built-in-background-music-dev",
		configureServer(server: {
			middlewares: {
				use: (
					route: string,
					handler: (
						req: { url?: string },
						res: {
							statusCode: number;
							setHeader: (name: string, value: string) => void;
							end: (body?: Uint8Array | string) => void;
						},
						next: () => void,
					) => void,
				) => void;
			};
		}) {
			server.middlewares.use("/background-music", (req, res, next) => {
				const rawPath = decodeURIComponent((req.url ?? "/").split("?")[0] || "/");
				const normalizedFileName = rawPath.replace(/^\/+/, "");
				const resolvedPath = path.resolve(audioRoot, normalizedFileName);

				if (!resolvedPath.startsWith(audioRoot)) {
					next();
					return;
				}

				void (async () => {
					try {
						const fileBytes = await fs.readFile(resolvedPath);
						res.statusCode = 200;
						res.setHeader("Content-Type", "audio/mpeg");
						res.setHeader("Cache-Control", "no-store");
						res.end(fileBytes);
					} catch {
						next();
					}
				})();
			});
		},
	};
}

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		react(),
		builtInBackgroundMusicDevPlugin(),
		electron({
			main: {
				// Shortcut of `build.lib.entry`.
				entry: "electron/main.ts",
				vite: {
					build: {
						rollupOptions: {
							external: ["ffmpeg-static", "uiohook-napi"],
						},
					},
				},
			},
			preload: {
				// Shortcut of `build.rollupOptions.input`.
				// Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
				input: path.join(__dirname, "electron/preload.ts"),
			},
			// Ployfill the Electron and Node.js API for Renderer process.
			// If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
			// See https://github.com/electron-vite/vite-plugin-electron-renderer
			renderer:
				process.env.NODE_ENV === "test"
					? // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
						undefined
					: {},
		}),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
	},
	optimizeDeps: {
		entries: ["index.html"],
		exclude: [
			"lucide-react",
			"react-icons/bs",
			"react-icons/fa",
			"react-icons/fa6",
			"react-icons/fi",
			"react-icons/md",
			"react-icons/rx",
		],
	},
	test: {
		include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}", "electron/**/*.test.ts"],
	},
	build: {
		target: "esnext",
		minify: "terser",
		terserOptions: {
			compress: {
				drop_console: true,
				drop_debugger: true,
				pure_funcs: ["console.log", "console.debug"],
			},
		},
		rollupOptions: {
			output: {
				manualChunks: {
					pixi: ["pixi.js"],
					"react-vendor": ["react", "react-dom"],
					"video-processing": ["mediabunny"],
				},
			},
		},
		chunkSizeWarningLimit: 1000,
	},
});
