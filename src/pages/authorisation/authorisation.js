import { DEFAULT_AUTH } from "../../defaults.js";
import { getAccount } from "../../services/account-manager.js";
import { $, createTopLevelFrame } from "../../shared.js";
import { addIpcMessageHandler, handleIpcMessage } from "shared-ipc";

/**
 * @param {{ responseType: string, clientId: string, redirectUri: string|null, scope: string, state: string }} param 
 */
async function oAuthAuthorise({ responseType, clientId, redirectUri, scope, state }) {
	const main = /**@type {HTMLElement}*/($("#main"));
	const clientLabel =  /**@type {HTMLElement}*/($("#clientLabel"));
	const loadingLabel = /**@type {HTMLElement}*/($("#loadingLabel"));
	const scopesList = /**@type {HTMLElement}*/($("#scopesList"));
	const redirectLabel = /**@type {HTMLElement}*/($("#redirectLabel"));
	const redirectUriLabel = /**@type {HTMLElement}*/($("#redirectUriLabel"));
	const expiryDateLabel = /**@type {HTMLElement}*/($("#expiryDateLabel"));

	// Initialise UI
	clientLabel.textContent = clientId;
	for (const scopeKey of scope.split(" ")) {
		const li = document.createElement("li");
		li.textContent = scopeKey;
		scopesList.appendChild(li);
	}
	if (redirectUri) {
		redirectLabel.style.display = "block";
		redirectUriLabel.textContent = redirectUri;
	}
	else  {
		redirectLabel.style.display = "none";
	}
	expiryDateLabel.textContent = new Date(Date.now()).toLocaleString(); // TODO: Implement this

	// Log in / authorise
	const account = await getAccount();
	if (!account) {
		// We need to log in
		loadingLabel.textContent = "You are not logged in: opening account login dialog";
		const accountFrame = await createTopLevelFrame("/account.html", "accountFrame");
		return;
	}

	// Begin OAuth authorisation process
	main.dataset.page = "authorisation";
	const authParams = new URLSearchParams({
		"response_type": responseType,
		"client_id": clientId,
		"scope": scope,
		"state": state
	});
	const res = await fetch(`${localStorage.auth || DEFAULT_AUTH}/oauth/authorize?${authParams}`, {
		method: "GET",
		headers: {
			"Content-Type": "application/json"
		},
		credentials: "include",
	});
	if (!res.ok) {
		return;
	}

	return "AUTHORISATION-CODE";
}
addIpcMessageHandler("oAuthAuthorise", oAuthAuthorise);

window.addEventListener("message", handleIpcMessage);
