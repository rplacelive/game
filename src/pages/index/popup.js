import { $ } from "../../shared.js";

const popup = /**@type {HTMLDialogElement}*/($("#popup"));
const closeButton = /**@type {HTMLButtonElement}*/($("#popupCloseButton"));
const popupEmbed = /**@type {HTMLIFrameElement}*/($("#popupEmbed"));
const popupTitle = /**@type {HTMLElement}*/($("#popupTitle"));

closeButton.addEventListener("click", function() {
	if (popupCancellable) {
		localStorage.nopopup = Date.now();
	}
	popup.close();
});

/**
 * @param {string} url 
 * @param {string} title 
 */
function initPopup(url, title) {
	if (localStorage.nopopup && Date.now() - localStorage.nopopup < 1000 * 60 * 60 * 24) {
		popup.close();
	}
	else {
		popupEmbed.addEventListener("load", function() {
			popup.showModal();
			popupEmbed.style.height = `${popupEmbed.contentWindow?.document.body.scrollHeight ?? 800}px`;
		});
		popupEmbed.src = url;
		popupTitle.textContent = title ?? "Information";
	}
}

const popupEnabled = false;
const popupUrl = "august21st-embed.html";
const popupTitleText = "Special Event - August 21st";
const popupCancellable = true;

if (popupEnabled) {
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => initPopup(popupUrl, popupTitleText));
	}
	else {
		initPopup(popupUrl, popupTitleText);
	}
}
