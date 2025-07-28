import { $ } from "../../shared.js";

const muteButton = /**@type {HTMLButtonElement}*/($("#muteButton"));
const muteButtonImage = /**@type {HTMLImageElement}*/($("#muteButtonImage"));
const placeChatButton = /**@type {HTMLButtonElement}*/($("#placeChatButton"));
const placeChatButtonImage = /**@type {HTMLImageElement}*/($("#placeChatButtonImage"));

export let muted = localStorage.muted === "true";
export let placeChat = localStorage.placeChat === "true";

// Modal settings (mute, place chat)
if (localStorage.muted !== "true") { // Prefer false
	localStorage.muted = "false";
}
if (localStorage.placeChat !== "false") { // Prefer true
	localStorage.placeChat = "true";
}
window.addEventListener("DOMContentLoaded", function() {
	muteButtonImage.src = muted ? "/svg/muted.svg" : "/svg/unmuted.svg";
	placeChatButtonImage.style.opacity = placeChat ? "1" : "0.6";
});
muteButton.addEventListener("click", function() {
	muted = !muted;
	localStorage.muted = String(muted);
	muteButtonImage.src = muted ? "/svg/muted.svg" : "/svg/unmuted.svg";
});
placeChatButton.addEventListener("click", function() {
	placeChat = !placeChat
	localStorage.placeChat = String(placeChat)
	placeChatButtonImage.style.opacity = placeChat ? "1" : "0.6"
});