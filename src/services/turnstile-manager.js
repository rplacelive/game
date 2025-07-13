// Service source code inspired by react-turnstile
// https://github.com/Le0Developer/react-turnstile

const globalNamespace = (
	typeof globalThis !== "undefined" ? globalThis : window
);

let turnstileState = 
	typeof globalNamespace.turnstile !== "undefined" ? "ready" : "unloaded";
/**@type {Function}*/let ensureTurnstile;

/**@type {{ resolve: Function, reject: Function }}*/let turnstileLoad;
const turnstileLoadPromise = new Promise((resolve, reject) => {
	turnstileLoad = { resolve, reject };
	if (turnstileState === "ready") {
		resolve(undefined);
	}
});

{
	const TURNSTILE_LOAD_FUNCTION = "cf__turnstileOnLoad";
	const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

	ensureTurnstile = () => {
		if (turnstileState === "unloaded") {
			turnstileState = "loading";
			globalNamespace[TURNSTILE_LOAD_FUNCTION] = () => {
				turnstileLoad.resolve();
				turnstileState = "ready";
				delete globalNamespace[TURNSTILE_LOAD_FUNCTION];
			};
			const url = `${TURNSTILE_SRC}?onload=${TURNSTILE_LOAD_FUNCTION}&render=explicit`;
			const script = document.createElement("script");
			script.src = url;
			script.async = true;
			script.addEventListener("error", () => {
				turnstileLoad.reject("Failed to load Turnstile.");
				delete globalNamespace[TURNSTILE_LOAD_FUNCTION];
			});
			document.head.appendChild(script);
		}
		return turnstileLoadPromise;
	};
}

function createBoundTurnstileObject(widgetId) {
	return {
		execute: (options) => window.turnstile.execute(widgetId, options),
		reset: () => window.turnstile.reset(widgetId),
		getResponse: () => window.turnstile.getResponse(widgetId),
		isExpired: () => window.turnstile.isExpired(widgetId),
	};
}

export class TurnstileWidget {
	constructor(element, options = {}) {
		this.element = element;
		this.options = options;
		this.widgetId = null;
		this.boundTurnstileObject = null;
		this.destroyed = false;
		
		this.#setupStyles();
		this.#init();
	}

	#setupStyles() {
		if (this.options.fixedSize) {
			const size = this.options.size || "normal";
			const width = size === "compact" ? "130px" : size === "flexible" ? "100%" : "300px";
			const height = size === "compact" ? "120px" : "65px";
			
			this.element.style.width = width;
			this.element.style.height = height;
		}
		
		if (this.options.style) {
			Object.assign(this.element.style, this.options.style);
		}
	}

	async #init() {
		if (this.destroyed) return;
		
		try {
			if (turnstileState !== "ready") {
				await ensureTurnstile();
			}
			
			if (this.destroyed) return;
			
			this.#render();
		} catch (error) {
			this.options.onError?.(error);
		}
	}

	#render() {
		const turnstileOptions = {
			sitekey: this.options.sitekey,
			action: this.options.action,
			cData: this.options.cData,
			theme: this.options.theme,
			language: this.options.language,
			tabindex: this.options.tabIndex,
			"response-field": this.options.responseField,
			"response-field-name": this.options.responseFieldName,
			size: this.options.size,
			retry: this.options.retry,
			"retry-interval": this.options.retryInterval,
			"refresh-expired": this.options.refreshExpired,
			appearance: this.options.appearance,
			execution: this.options.execution,
			callback: (token, preClearanceObtained) => {
				this.options.onVerify?.(token, this.boundTurnstileObject);
				this.options.onSuccess?.(token, preClearanceObtained, this.boundTurnstileObject);
			},
			"error-callback": (error) => 
				this.options.onError?.(error, this.boundTurnstileObject),
			"expired-callback": (token) =>
				this.options.onExpire?.(token, this.boundTurnstileObject),
			"timeout-callback": () =>
				this.options.onTimeout?.(this.boundTurnstileObject),
			"after-interactive-callback": () =>
				this.options.onAfterInteractive?.(this.boundTurnstileObject),
			"before-interactive-callback": () =>
				this.options.onBeforeInteractive?.(this.boundTurnstileObject),
			"unsupported-callback": () =>
				this.options.onUnsupported?.(this.boundTurnstileObject),
		};

		this.widgetId = window.turnstile.render(this.element, turnstileOptions);
		this.boundTurnstileObject = createBoundTurnstileObject(this.widgetId);
		this.options.onLoad?.(this.widgetId, this.boundTurnstileObject);
	}

	destroy() {
		this.destroyed = true;
		if (this.widgetId) {
			window.turnstile.remove(this.widgetId);
			this.widgetId = null;
			this.boundTurnstileObject = null;
		}
	}

	reset() {
		this.boundTurnstileObject?.reset();
	}

	execute(options) {
		this.boundTurnstileObject?.execute(options);
	}

	getResponse() {
		return this.boundTurnstileObject?.getResponse();
	}

	isExpired() {
		return this.boundTurnstileObject?.isExpired();
	}
}

export function getTurnstileAPI() {
	return globalNamespace.turnstile;
}

export async function ensureTurnstileLoaded() {
	if (turnstileState !== "ready") {
		await ensureTurnstile();
	}
	return globalNamespace.turnstile;
}