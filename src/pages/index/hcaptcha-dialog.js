///<reference types="@hcaptcha/types"/>
import { $, PublicPromise } from "../../shared.js"
import { addIpcMessageHandler, handleIpcMessage } from "shared-ipc";
import { sendServerMessage } from "./game-state.js";

//let hCaptchaLoad = new PublicPromise();
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

// @ ts-expect-error Not defined on window
/*window.onloadHCaptcha = () => {
	hCaptchaLoad.resolve(undefined);
}*/

addIpcMessageHandler("handleHCaptcha", async (/**@type {[number,string]}*/[captchaId, siteKey]) => {
	//await hCaptchaLoad.promise;

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
