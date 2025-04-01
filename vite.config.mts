import { defineConfig } from "vite"
import circleDependency from "vite-plugin-circular-dependency"
import { serviceWorkerPlugin } from "@gautemo/vite-plugin-service-worker"

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
			input: {
				main: "index.html",
				posts: "posts.html",
				account: "account-dialog.html",
				instance: "instance.html",
				fakeapp: "fakeapp.html"
			},
			output: {
				assetFileNames: (assetInfo) => {
					const fileName =
						assetInfo.originalFileNames?.[0] || assetInfo.names?.[0] || 'asset'

					if (/\.(css|js|json|svg|png|woff2|mp3|webm)$/.test(fileName)) {
						return fileName
					}
					return "assets/[name]-[hash][extname]"
				}
			}
		}
	},
	esbuild: {
		exclude: [ "server/**/*" ]
	},
	plugins: [
		circleDependency({
			outputFilePath: "./.depends",
		}),
		serviceWorkerPlugin({
			filename: "src/sw.js",
		}),
	],
})
