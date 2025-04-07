import { addMessageHandler, DEFAULT_AUTH, makeRequest } from "./shared.js"

// Injects the iframe containing the account.html page into the DOM
export function openAccountFrame(page=null, unauthed=null) {
	const topWindow = window.top
	if (!topWindow) {
		console.error("Couldn't open account frame: Unable to access top-level window")
		return false
	}
	if (topWindow.document.getElementById("accountFrame")) {
		return false
	}

	const iframe = topWindow.document.createElement("iframe")
	iframe.src = "/account-dialog.html"
	iframe.id = "accountFrame"
	iframe.classList.add("iframe-modal")
	iframe.addEventListener("load", () => {
		const loginPanel = /**@type {HTMLElement}*/iframe.contentDocument?.querySelector("#loginPanel")
		const unauthedPage = /**@type {HTMLElement}*/iframe.contentDocument?.querySelector("#unauthedPage")
		if (loginPanel && page) {
			loginPanel.dataset.page = page
		}
		if (unauthedPage && unauthed) {
			unauthedPage.dataset.page = unauthed
		}
	})
	topWindow.document.body.appendChild(iframe)
	return true
}

// Removes the iframe containing the account.html page from the DOM
export function closeAccountFrame() {
	const topWindow = window.top
	if (!topWindow) {
		console.error("Couldn't close account frame: Unable to access top-level window")
		return false
	}

	const iframe = topWindow.document.getElementById("accountFrame")
	if (iframe) {
		iframe.remove()
	}
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
addMessageHandler("closeAccountFrame", closeAccountFrame);
addMessageHandler("dispatchAccountEvent", dispatchAccountEvent);