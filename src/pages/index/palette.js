"use strict";
import { DEFAULT_PALETTE_KEYS } from "../../defaults.js";
import { $ }  from "../../shared.js";
import { runAudio } from "./game-audio.js";
import { AUDIOS } from "./game-defaults.js";
import { PALETTE, PALETTE_USABLE_REGION } from "./game-state.js";

const palette = /**@type {HTMLElement}*/($("#palette"));
const colours = /**@type {HTMLElement}*/($("#colours"));

export function showPalette() {
	palette.style.transform = "";
	runAudio(AUDIOS.highlight);
}

export function generatePalette() {
	colours.innerHTML = "";
	for (let i = PALETTE_USABLE_REGION.start; i < PALETTE_USABLE_REGION.end; i++) {
		const colour = PALETTE[i] || 0;
		const colourEl = document.createElement("div");
		colourEl.dataset.index = String(i);
		colourEl.style.background = `rgba(${colour & 255},${(colour >> 8) & 255},${(colour >> 16) & 255}, 1)`;
		if (colour == 0xffffffff) {
			colourEl.style.outline = "1px #ddd solid";
			colourEl.style.outlineOffset = "-1px";
		}
		const indicatorSpan = document.createElement("span");
		indicatorSpan.contentEditable = "true";
		indicatorSpan.onkeydown = function(event) {
			rebindIndicator(event, i);
		}
		colourEl.appendChild(indicatorSpan);
		colours.appendChild(colourEl);
	}
}

export function hideIndicators() {
	// TODO: A CSS class on colours should handle this
	for (let c = 0; c < colours.children.length; c++) {
		const indicator = /**@type {HTMLElement}*/(colours.children[c]?.firstElementChild);
		if (indicator?.style.visibility !== "hidden") {
			indicator.style.visibility = "hidden";
		}
	}
}

/**
 * @param {KeyboardEvent} e
 * @param {string | number} i
 */
export function rebindIndicator(e, i) {
	const indicator = /**@type {HTMLElement}*/ (e.target);
	if (!e.key || e.key.length != 1 || !indicator){
		return;
	}
	indicator.innerText = e.key
	indicator.blur()

	let binds = (localStorage.paletteKeys || DEFAULT_PALETTE_KEYS).split("")
	const preExisting = binds.indexOf(e.key)
	if (preExisting != -1) {
		binds[preExisting] = "​"
	}
	binds[i] = e.key.charAt(0)
	localStorage.paletteKeys = binds.join("")
	generateIndicators(binds.join(""))
}

/**
 * @param {string} keybinds
 */
export function generateIndicators(keybinds) {
	for (let c = 0; c < colours.children.length; c++) {
		const indicator = /**@type {HTMLElement}*/(colours.children[c].firstChild);
		indicator.textContent = keybinds.charAt(c)
	}
}

function init() {
	generatePalette();
	generateIndicators(localStorage.paletteKeys || DEFAULT_PALETTE_KEYS)
}
if (document.readyState !== "loading") {
	init();
}
else {
	window.addEventListener("DOMContentLoaded", init);
}
