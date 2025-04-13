import { $ } from "./shared.js"

const overlayMenu = /**@type {HTMLDialogElement}*/($("#overlayMenu"));


export function openOverlayMenu() {
	overlayMenu.showModal();
}

export function closeOverlayMenu() {
	overlayMenu.close();
}