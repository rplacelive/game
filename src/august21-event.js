import { startCountDown, toCountdownString } from "./event-timer.js"

// Show game popup
function isTodayAugust21st() {
	const now = new Date()
	// August is month 7 (zero-based)
	return now.getMonth() === 7 && now.getDate() === 21
}

function getNextAugust21st() {
	const now = new Date()
	const year = now.getMonth() > 7 || (now.getMonth() === 7 && now.getDate() > 21) 
		? now.getFullYear() + 1 
		: now.getFullYear()

	// Get unix timestamp of August 21st of the current year
	const august21st = new Date(year, 7, 21)
	return august21st.getTime()
}

export function enableAugust21() {
	const eventDate = isTodayAugust21st() ? Date.now() : getNextAugust21st()
	
	const popup = /**@type {HTMLDialogElement}*/(document.getElementById("popup"));
	const august21PopupTimer = /**@type {HTMLElement}*/(document.getElementById("august21PopupTimer"));
	const august21PopupLabel = /**@type {HTMLElement}*/(document.getElementById("august21PopupLabel"));
	const august21PopupButton = /**@type {HTMLElement}*/(document.getElementById("august21PopupButton"));

	popup.showModal();

	setInterval(() => {
		august21PopupTimer.textContent = ` (${toCountdownString(eventDate)})`
	}, 1000)

	startCountDown(eventDate, false).then((async) => {
		august21PopupTimer.style.display = "none"

		// TODO: Reimplement on game release
		august21PopupLabel.style.display = "none"
		august21PopupButton.style.display = "flex"
	})	
}
