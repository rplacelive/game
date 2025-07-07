import { DEFAULT_AUTH } from "./defaults.js";
import { createTopLevelFrame, makeRequest, removeTopLevelFrame } from "./shared.js";
import { addIpcMessageHandler } from "shared-ipc";

// Injects the iframe containing the account.html page into the DOM
export async function openAccountFrame(page=null, unauthed=null) { // TODO: Replace with the shared.js version 
	const accountFrame = await createTopLevelFrame("/src/account-dialog.html", "accountFrame");
	const loginPanel = /**@type {HTMLElement}*/(accountFrame.contentDocument?.querySelector("#loginPanel"));
	const unauthedPage = /**@type {HTMLElement}*/(accountFrame.contentDocument?.querySelector("#unauthedPage"));
	if (loginPanel && page) {
		loginPanel.dataset.page = page
	}
	if (unauthedPage && unauthed) {
		unauthedPage.dataset.page = unauthed
	}
}

// Removes the iframe containing the account.html page from the DOM
export function closeAccountFrame() {
	return removeTopLevelFrame("accountFrame");
}

// Fetches account details of the currently logged in account
export async function getAccount() {
	const result = await makeRequest(`${localStorage.auth || DEFAULT_AUTH}/accounts/me`)

	if (result.status === "success") {
		return result.data // Account details
	}
	else {
		const err = result.data
		if (typeof err === "object") {
			console.error("Couldn't get account:", err.message, err.metadata)
		}
		else {
			console.error("Couldn't get account:", err)
		}
		return null
	}
}

/**
 * Called by account dialog via cross frame IPC system
 * @param {string} eventName Name of account event, i.e account-login, account-logout
 * @param {object} detail Associated event metadata
 */
export function dispatchAccountEvent(eventName, detail = {}) {
	const event = new CustomEvent(eventName, {
		detail,
		bubbles: true,
		composed: true
	})
	window.dispatchEvent(event)
}

// Hook up cross frame / parent window IPC request handlers
addIpcMessageHandler("closeAccountFrame", closeAccountFrame);
addIpcMessageHandler("dispatchAccountEvent", dispatchAccountEvent);