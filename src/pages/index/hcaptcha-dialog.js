///<reference types="@hcaptcha/types"/>
import { $ } from "../../shared.js"
import { addIpcMessageHandler, handleIpcMessage } from "shared-ipc";
import { sendServerMessage } from "./game-state.js";

/**@type {string|null}*/let widgetId = null;

const hCaptchaDialog = /**@type {HTMLDialogElement}*/($("#hCaptchaDialog"));
const hCaptchaSubmitButton = /**@type {HTMLDialogElement}*/($("#hCaptchaSubmitButton"));

hCaptchaSubmitButton.addEventListener("click", (e) => {
	if (!(e instanceof Event) || !e.isTrusted) {
		return;
	}

	e.preventDefault();
	if (widgetId === null) {
		console.error("Couldn't submit hCaptcha result: hCaptcha not yet initialized");
	}
	else if (typeof widgetId === "number") {
		hcaptcha.execute(widgetId, { async: false });
	}
});

addIpcMessageHandler("handleHCaptcha", /**@type {[number,string]}*/([captchaId, siteKey]) => {
	const hcaptcha = /**@type {HCaptcha}*/(window.hcaptcha);
	widgetId = hcaptcha.render("hCaptchaContainer", {
		sitekey: siteKey,
		size: "invisible",
		callback: (token) => {
			sendServerMessage("sendHCaptchaResult", { captchaId, result: token });
		},
		"error-callback": (err) => {
      		console.error("hCaptcha error:", err);
		},
		"expired-callback": () => {
      		console.warn("hCaptcha token expired");
		}
	});
	hCaptchaDialog.showModal()
});
addIpcMessageHandler("handleHCaptchaSuccess", () => {
	hCaptchaDialog.close()
});
