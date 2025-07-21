import { BoardRenderer } from "./board-renderer.js";
import { DEFAULT_PALETTE } from "../../defaults.js";
import { $ } from "../../shared.js"

const overlayMenu = /**@type {HTMLDialogElement}*/($("#overlayMenu"));
const overlayMenuCanvas = /**@type {HTMLCanvasElement}*/($("#overlayMenuCanvas"));
const renderer = new BoardRenderer(overlayMenuCanvas);

function initOverlayMenu() {
	const defaultBoard = new Uint8Array(16384);
	const defaultPalette = new Uint32Array(DEFAULT_PALETTE);
	//renderer.setSources(defaultBoard, defaultPalette, 128, 128);
}
if (document.readyState !== "loading") {
	initOverlayMenu();
}
else {
	document.addEventListener("DOMContentLoaded", initOverlayMenu);
}

export function openOverlayMenu() {
	overlayMenu.showModal();
}

export function closeOverlayMenu() {
	overlayMenu.close();
}