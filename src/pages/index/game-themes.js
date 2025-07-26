import { DEFAULT_EFFECTS, DEFAULT_THEMES } from "../../defaults.js";
const effectModules = import.meta.glob("./effects/*.js");

/**
 * @param {string} forceTheme
 * @param {string|null} forceVariant
 */
export async function forceTheme(forceTheme, forceVariant = null) {
	const currentThemeSet = document.documentElement.dataset.theme
	const currentVariant = document.documentElement.dataset.variant
	if (currentThemeSet != forceTheme || currentVariant != forceVariant) {
		console.warn("Forcing site theme to", forceTheme, forceVariant)
		await theme(/**@type {import("../../defaults.js").ThemeInfo}*/(DEFAULT_THEMES.get(forceTheme)), forceVariant)
	}
}

/**@type {HTMLLinkElement|null}*/let styleElement = null;
/**@type {any}*/let effectsModule = null;
/**@type {import("../../defaults.js").ThemeInfo|null}*/let currentTheme = null;
/**@type {import("../../defaults.js").EffectInfo|null}*/let currentEffects = null;

/**
 * @param {import("../../defaults.js").ThemeInfo} themeSet
 * @param {string|null} variant
 * @param {string|null} effects
 */
export async function theme(themeSet, variant = null, effects = null) {
	variant ??= "";

	// Effects
	let effectInfo;
	if (currentEffects) {
		effectsModule?.disable?.();
	}
	if (effects && (effectInfo = DEFAULT_EFFECTS.get(effects)) !== undefined) {
		const importer = effectModules[effectInfo.modulePath];
		if (importer) {
			effectsModule = await importer();
			await effectsModule?.enable?.(forceTheme);
			currentEffects = effectInfo;
		}
	}

	if (currentTheme !== themeSet) {
		// Intermediate stylesheet handles giving a nice transition animation during theme change
		const intermediate = document.createElement("link");
		intermediate.rel = "stylesheet";
		intermediate.type = "text/css";
		intermediate.href = "/css/theme-switch.css";
		intermediate.setAttribute("intermediate-temp", "true");
		await (new Promise(resolve => {
			intermediate.onload = resolve;
			document.head.appendChild(intermediate);
		}))

		// Load in new CSS
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.type = "text/css";
		link.href = themeSet.css + "?v=" + themeSet.cssVersion;
		await (new Promise(async (resolve) => {
			link.onload = resolve;
			document.head.appendChild(link);
		}));
		setTimeout(() => document.head.removeChild(intermediate), 200);
		// Swap out intermediate and old stylesheet
		if (styleElement) {
			document.head.removeChild(styleElement);
		}
		styleElement = link;
		currentTheme = themeSet;

		document.querySelectorAll("[theme]").forEach((element) => {
			const themeKey = element.getAttribute("theme")
			if (!themeKey) {
				return
			}
			if (element.tagName == "IMG") {
				const imageElement = /**@type {HTMLImageElement}*/(element);
				imageElement.src = themeSet[themeKey] || imageElement.src
			}
			else {
				element.innerHTML = themeSet[themeKey] || element.innerHTML
			}
		})
		document.documentElement.dataset.theme = themeSet.id
	}
	document.documentElement.dataset.variant = variant
}
