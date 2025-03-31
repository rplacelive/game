import { defineConfig } from "vite"

export default defineConfig({
	root: ".",
	base: "./",
	server: {
		open: true,
	},
	build: {
		outDir: "dist",
		emptyOutDir: true,
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
	}
})
