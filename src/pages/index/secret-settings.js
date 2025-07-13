import { $ } from "../../shared.js";
import { EditList } from "../../shared-elements.js";
import { setSelectColourSample, getDefaultSample } from "./game-audio.js";

export let enableWebglCanvas = localStorage.enableWebglCanvas === "true";
export let enableNewOverlayMenu = localStorage.enableNewOverlayMenu === "true";
export let enableMelodicPalette = localStorage.enableMelodicPalette === "true";

// Experimental settings
const enableWebglCanvasCheckbox = /**@type {HTMLInputElement}*/($("#enableWebglCanvasCheckbox"));
enableWebglCanvasCheckbox.checked = enableWebglCanvas;
enableWebglCanvasCheckbox.addEventListener("change", function() {
	enableWebglCanvas = !enableWebglCanvas;
	localStorage.enableWebglCanvas = String(enableWebglCanvas);
});

const enableNewOverlayMenuCheckbox = /**@type {HTMLInputElement}*/($("#enableNewOverlayMenuCheckbox"));
enableNewOverlayMenuCheckbox.checked = enableNewOverlayMenu;
enableNewOverlayMenuCheckbox.addEventListener("change", function() {
	enableNewOverlayMenu = !enableNewOverlayMenu;
	localStorage.enableNewOverlayMenu = String(enableNewOverlayMenu);
});

// Secret settings
const enableMelodicPaletteCheckbox = /**@type {HTMLInputElement}*/($("#enableMelodicPaletteCheckbox"));
enableMelodicPaletteCheckbox.checked = enableMelodicPalette;
enableMelodicPaletteCheckbox.addEventListener("change", async function() {
	enableMelodicPalette = !enableMelodicPalette;
	localStorage.enableMelodicPalette = String(enableMelodicPalette);
});

const paletteSoundSelect = /**@type {HTMLSelectElement}*/($("#paletteSoundSelect"));
/** @param {string} value */
async function handlePaletteSoundChange(value) {
	const sample = await getDefaultSample(value);
	if (sample) {
		setSelectColourSample(sample);
		localStorage.paletteSelectSound = value;
	}
}
async function initPaletteSoundSelect() {
	const selectSound = localStorage.paletteSelectSound;
	if (selectSound) {
		paletteSoundSelect.value = selectSound;
		handlePaletteSoundChange(selectSound);
	}
}
initPaletteSoundSelect();
paletteSoundSelect.addEventListener("change", function() {
	handlePaletteSoundChange(paletteSoundSelect.value);
});

// Local storage editor
const editLocalStorageList = /**@type {EditList}*/($("#editLocalStorageList"));
editLocalStorageList.data = window.localStorage;
editLocalStorageList.addEventListener("itemchange", (/**@type {any}*/e) => {
	const { key, value } = e.detail;
	localStorage.setItem(key, value);
});
editLocalStorageList.addEventListener("itemremove", (/**@type {any}*/e) => {
	const { key } = e.detail;
	localStorage.removeItem(key);
});
editLocalStorageList.addEventListener("itemadd", (/**@type {any}*/e) => {
	const { key, value } = e.detail;
	localStorage.setItem(key, value);
});
