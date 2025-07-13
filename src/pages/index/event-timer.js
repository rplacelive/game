/**@type {Timer|null}*/let cdInterval = null;

/**
 * @param {number} finDate 
 * @param {boolean} coverOnComplete 
 */
export async function startCountDown(finDate, coverOnComplete = true) {
	let tick = 0;
	const initialRemaining = finDate - Date.now();
	const body = document.body
	body.setAttribute("eventphase", "0");
	if (cdInterval) {
		clearInterval(cdInterval);
	}

	const eventCountdown = /**@type {HTMLElement}*/(document.getElementById("eventCountdown"));
	await new Promise((resolve) => {
		cdInterval = setInterval(() => {
			if (tick == 1) {
				body.setAttribute("eventphase", "1")
			}
			if (tick == 12) {
				body.setAttribute("eventphase", "2")
			}
			const remaining = finDate - Date.now();
			const percentLeft = remaining / initialRemaining * 100;

			// At less than 10% time left we go back to p1
			if (percentLeft < 10) {
				body.setAttribute("eventphase", "1");
			}
			if (remaining <= 0) {
				if (cdInterval) {
					clearInterval(cdInterval);
				}
				resolve(remaining);
			}

			const titleLabel = /**@type {HTMLElement}*/(eventCountdown.children[1]);
			titleLabel.innerHTML = `Event in ${toCountdownString(finDate)}`;
			const leftLabel = /**@type {HTMLElement}*/(eventCountdown.children[3]);
			leftLabel.style.width = percentLeft + "%";
			tick++;
		}, 500);//ms
	})

	// Start event
	if (coverOnComplete) {
		body.setAttribute("eventphase", "3");
	}
}

/**
 * @param {number} finishDate
 */
export function toCountdownString(finishDate) {
	const remaining = finishDate - Date.now()
	const days = Math.floor(remaining / (1000 * 60 * 60 * 24))
	const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24)
	const minutes = Math.floor((remaining / (1000 * 60)) % 60)
	const seconds = Math.floor((remaining / 1000) % 60)
	return days > 0
		? `${days}:${hours}:${minutes}:${seconds}`
		: `${hours}:${minutes}:${seconds}`
}
