/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_APP_TITLE: string
	readonly VITE_API_URL: string
	readonly VITE_ENABLE_FEATURE_X: boolean
	// Add other environment variables here...
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
