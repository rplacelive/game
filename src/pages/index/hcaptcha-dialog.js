///<reference types="@hcaptcha/types"/>
import { $, PublicPromise } from "../../shared.js"
import { addIpcMessageHandler, handleIpcMessage } from "shared-ipc";
import { sendServerMessage } from "./game-state.js";

//let hCaptchaLoad = new PublicPromise();
/**@type {string|null}*/let widgetId = null;

const hCaptchaMenu = /**@type {HTMLDialogElement}*/($("#hCaptchaMenu"));
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

// TODO: Investigate this
// @ ts-expect-error Not defined on window
//window.onloadHCaptcha = () => {
//	hCaptchaLoad.resolve(undefined);
//}

addIpcMessageHandler("handleHCaptcha", async (/**@type {[number,string]}*/[captchaId, siteKey]) => {
	//await hCaptchaLoad.promise;
	const siteVariant = document.documentElement.dataset.variant;
	const captchaTheme = siteVariant === "dark" ? "dark" : "light";

	// Remove previous
	const hcaptcha = /**@type {HCaptcha}*/(window.hcaptcha);
	if (widgetId !== null && widgetId !== undefined) {
		hcaptcha.remove(widgetId);
	}
	
	// Create new hCaptcha widget
	widgetId = hcaptcha.render("hCaptchaContainer", {
		sitekey: siteKey,
		theme: captchaTheme,
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

	hCaptchaMenu.setAttribute("open", "true");
});
addIpcMessageHandler("handleHCaptchaSuccess", () => {
	hCaptchaMenu.removeAttribute("open");
});
