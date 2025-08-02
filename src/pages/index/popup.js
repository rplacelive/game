import { $ } from "../../shared.js";

const popup = /**@type {HTMLDialogElement}*/($("#popup"));
const closeButton = /**@type {HTMLButtonElement}*/($("#popupCloseButton"));

closeButton.addEventListener("click", function() {
    localStorage.nopopup = Date.now();
    popup.close();
});