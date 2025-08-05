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

// @ ts-expect-error Not defined on window
/*window.onloadHCaptcha = () => {
	hCaptchaLoad.resolve(undefined);
}*/

addIpcMessageHandler("handleHCaptcha", async (/**@type {[number,string]}*/[captchaId, siteKey]) => {
	//await hCaptchaLoad.promise;
	const siteVariant = document.documentElement.dataset.variant;
	const captchaTheme = siteVariant === "dark" ? "dark" : "light";

	const hcaptcha = /**@type {HCaptcha}*/(window.hcaptcha);
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
