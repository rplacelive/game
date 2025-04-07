import { defineConfig } from "vite"
import { serviceWorkerPlugin } from "@gautemo/vite-plugin-service-worker"
import { glob } from "glob"

const htmlFiles = await glob("*.html");

export default defineConfig({
	base: "/",
	server: {
		open: true,
		strictPort: true
	},
	build: {
		outDir: "dist",
		target: "esnext",
		rollupOptions: {
			input: Object.fromEntries(
				htmlFiles.map(file => [
					file.replace(/\.html$/, ""),
					file
				])
			),
			output: {
				assetFileNames: (assetInfo) => {
					const fileName = assetInfo.names[0] || assetInfo.originalFileNames[0] || 'asset';
					const ext = fileName.split('.').pop();
					const keepOriginal = [
						"css", "js", "json", "svg", "png", "woff2", "mp3", "webm",
						"ico", "gif", 'html'
					];
					if (ext && keepOriginal.includes(ext)) {
						// For HTML files in subdirectories maintain structure
						if (ext === "html" && assetInfo.originalFileNames[0].includes("/")) {
							return assetInfo.originalFileNames[0];
						}
						return fileName;
					}
					return "assets/[name]-[hash][extname]";
				}
			}
		},
	},
	esbuild: {
		exclude: ["server/**/*"]
	},
	plugins: [
		serviceWorkerPlugin({
			filename: "src/sw.js",
		}),
	],
})