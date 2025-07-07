import { makeIpcRequest, sendIpcMessage } from "shared-ipc";
import { createTopLevelFrame } from "./shared.js";

async function initOAuth() {
	const params = new URLSearchParams(location.search);
	const action = params.get("action");

	if (action === "authorise") {
		// responseType: string, clientId: string, scope: string, state: string
		const responseType = params.get("state");
		const clientId = params.get("client_id");
		const redirectUri = params.get("redirect_uri");
		const scope = params.get("scope");
		const state = params.get("state");
		if (!responseType || !clientId || !state) {
			console.error("Invalid authorise request: Missing required parameters");
			return;
		}

		// Construct an authorisation dialog that will handle making the /oauth/authorize request to AuthServer
		const authorisationFrame = await createTopLevelFrame("/authorisation-dialog.html", "authorisationFrame");
		// Tell authorisation frame to authorize our credentials
		const authorisationCode = await makeIpcRequest(authorisationFrame, "oAuthAuthorise", {
			responseType,
			clientId,
			redirectUri,
			scope,
			state
		});
		if (!authorisationCode) {
			console.error("Failed to authorise")
			return;
		}
		// Redirect to redirectUri with the authorisation code 
		const redirectParams = new URLSearchParams({
			"authorization_code": authorisationCode
		});
		window.location.replace(`${redirectUri}/?${redirectParams.toString()}`);
	}
}
if (document.readyState !== "loading") {
	initOAuth();
}
else {
	document.addEventListener("DOMContentLoaded", initOAuth);
}