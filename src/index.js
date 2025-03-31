import { ADS, AUDIOS, CHAT_COLOURS, COMMANDS, CUSTOM_EMOJIS, DEFAULT_HEIGHT, DEFAULT_PALETTE_KEYS, DEFAULT_THEMES, DEFAULT_WIDTH, EMOJIS, LANG_INFOS, MAX_CHANNEL_MESSAGES, MUTED_SVG, PUNISHMENT_STATE, UNMUTED_SVG } from "./defaults.js"
import { canvasLocked, cooldownEndDate, chatName, HEIGHT, initialConnect, intId, intIdNames, intIdPositions, PALETTE, PALETTE_USABLE_REGION, WIDTH } from "./game-state.js"
import { requestLoadChannelPrevious, requestPixelPlacers, wscapsule, tryPutPixel, sendLiveChatMsg, sendPlaceChatMsg } from "./wscapsule.js"
import { DEFAULT_BOARD, DEFAULT_SERVER, lang, PublicPromise, translate, translateAll, hash, $, $$, stringToHtml } from "./shared.js"
import { showLoadingScreen } from "./loading-screen.js"
import { enableDarkplace, disableDarkplace } from "./darkplace.js"
import { enableWinter, disableWinter } from "./snowplace.js"
import { clearCaptchaCanvas, updateImgCaptchaCanvas, updateImgCaptchaCanvasFallback } from "./captcha-canvas.js"

// Touch & mouse canvas event handling
let moved = 3
/**@type {Touch|null}*/let touch1 = null
/**@type {Touch|null}*/let touch2 = null
let touchMoveDistance = 15

// Bidirectional IPC, similar to server.ts - db-worker.ts communication
// Methods called by posts frame
const postsFrame = /**@type {HTMLIFrameElement}*/($("#postsFrame"));
function resizePostsFrame() {
	if (!postsFrame) {
		return;
	}
	const calcHeight = postsFrame.contentWindow?.document.body.scrollHeight || 0;
	postsFrame.height = String(calcHeight);
	postsFrame.style.minHeight = calcHeight + "px";
}
postsFrame.addEventListener("load", resizePostsFrame);

const overlayMenu = $("#overlayMenu");
function openOverlayMenu() {
	overlayMenu.setAttribute("opened", "true")
}
function scrollToPosts() {
	postsFrame.scrollIntoView({ behavior: "smooth", block: "start", inline: "start" })
}
let postsFrameReqId = 0
let postsFrameReqs = new Map()
/**
 * @param {any} messageCall
 */
async function makePostsFrameRequest(messageCall, args = undefined) {
	const handle = postsFrameReqId++
	const promise = new PublicPromise()
	const postCall = { call: messageCall, data: args, handle: handle }
	postsFrameReqs.set(handle, promise)
	postsFrame.contentWindow?.postMessage(postCall)
	return await promise.promise
}
/**
 * @param {string} messageCall
 * @param {any} args
 */
function sendPostsFrameMessage(messageCall, args = undefined) {
	postsFrame.contentWindow?.postMessage({ call: messageCall, data: args })
}

// Load more posts on scroll down
const more = $("#more");
const spaceFiller = /**@type {HTMLElement}*/($("#spaceFiller"));
more.addEventListener("scroll", function(/**@type {any}*/ e) {
	const moreMaxScroll = more.scrollHeight - more.clientHeight
	if (moreMaxScroll - more.scrollTop < 256) {
		sendPostsFrameMessage("tryLoadBottomPosts")
	}
	// Dialog positioning is messed up as it only sees iframe window, this is cursed but it works
	const dialogTopHeight = Math.max(more.scrollTop - spaceFiller.offsetHeight + window.innerHeight / 2,
		spaceFiller.offsetHeight / 2)
	sendPostsFrameMessage("updateDialogTop", dialogTopHeight)
}, { passive: true })

// Game input handling && overrides
const mainContent = /**@type {HTMLElement}*/($("#maincontent"));
mainContent.addEventListener("touchstart", function(/**@type {TouchEvent}*/ e) {
	e.preventDefault()
	for (let i = 0; i < e.changedTouches.length; i++) {
		const touch = e.changedTouches[i];
		if (!touch1) {
			touch1 = touch
			touchMoveDistance = 15
		}
		else if (!touch2) {
			touch2 = touch
		}
		else {
			[touch1, touch2] = [touch2, touch]
		}
	}
})
mainContent.addEventListener("touchend", function(/** @type {TouchEvent} */ e) {
	if (!e.isTrusted) {
		return;
	}

	for (let i = 0; i < e.changedTouches.length; i++) {
		const t = e.changedTouches[i];

		assign2: {
			// Clear touch2 if it matches the identifier
			if (touch2 && touch2.identifier === t.identifier) {
				touch2 = null;
			}

			// If touch1 matches, swap and reset touch2
			else if (touch1 && touch1.identifier === t.identifier) {
				[touch1, touch2] = [touch2, null];

				// Check touchMoveDistance and if target is inside canvParent2
				if (touchMoveDistance > 0 && e.target instanceof Node && canvParent2.contains(e.target)) {
					// Ensure target is valid
					if (e.target !== mainContent && !canvParent2.contains(e.target)) {
						break assign2;
					}
					clicked(t.clientX, t.clientY);
				}
			}
		}

		// Ensure target is an HTMLElement before proceeding
		let target = /** @type {HTMLElement|null} */(e.target);
		if (target && "value" in target) {
			target.focus();
		}

		// Traverse up to find a dispatchable target
		while (target && !target.dispatchEvent) {
			target = target.parentElement
		}

		// Handle click on target
		if (touchMoveDistance > 0 && target) {
			target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		}
	}
	e.preventDefault();
});
mainContent.addEventListener("mousedown", function(/** @type {{ button: number; }} */ e) {
	moved = 3
	mouseDown = e.button + 1
})

const canvParent1 = /**@type {HTMLElement}*/($("#canvparent1"));
const canvParent2 = /**@type {HTMLElement}*/($("#canvparent2"));
const canvSelect = /**@type {HTMLElement}*/($("#canvselect"));
mainContent.addEventListener("mouseup", function(/** @type {{ target: any; clientX: any; clientY: any; }} */ e) {
	if (e.target != mainContent && !canvParent2.contains(e.target)) {
		return (moved = 3, mouseDown = 0)
	}

	if (moved > 0 && canvParent2.contains(e.target)) {
		clicked(e.clientX, e.clientY)
	}

	moved = 3
	mouseDown = 0
})


let selX = 0
let selY = 0
const canvas = /**@type {HTMLCanvasElement}*/($("#canvas"));
const canvasCtx = canvas.getContext("2d");
function transform() {
	const scale = z * 50;
	const translateX = x * z * -50;
	const translateY = y * z * -50;
	const width = z * canvas.width * 50;
	const height = z * canvas.height * 50;

	canvParent1.style.transform = `translate(${translateX + innerWidth / 2}px, ${translateY + mainContent.offsetHeight / 2}px) scale(${scale})`;
	canvParent2.style.transform = canvParent1.style.transform;
	canvSelect.style.transform = `translate(${Math.floor(x)}px, ${Math.floor(y)}px) scale(0.01)`;
	canvas.style.width = `${width}px`;
	canvas.style.height = `${height}px`;
	canvas.style.transform = `translate(${translateX}px, ${translateY}px)`;
	canvas.style.imageRendering = z < 1 / 50 / devicePixelRatio ? "initial" : "";
}

// Essential game variable definitions
export let x = 0;
export let y = 0;
export let z = 0;
let minZoom = 0;
/**@type {Uint8Array|null}*/let board = null;

const colours = /**@type {HTMLElement}*/($("#colours"));
const modal = /**@type {HTMLDialogElement}*/($("#modal"));
const modalInstall = /**@type {HTMLButtonElement}*/($("#modalInstall"));

// Prompt user if they want to install site as PWA if they press the modal button
/**@type {Event|null}*/
let pwaPrompter = null
modalInstall.disabled = true
window.addEventListener("beforeinstallprompt", function(e) {
	e.preventDefault()
	pwaPrompter = e
	modalInstall.disabled = false
})
modalInstall.addEventListener("click", () => {
	pwaPrompter?.prompt();
});

// Keybinds
document.body.addEventListener("keydown", function(/**@type {KeyboardEvent}*/e) {
	if (!e.isTrusted) {
		return
	}

	// Handle keybindings
	if (!document.activeElement || !("value" in document.activeElement)) {
		//"Shift+O" to open overlay menu
		if (e.key === "O" && e.shiftKey) {
			e.preventDefault();
			overlayMenu.toggleAttribute("opened");
		}
		else if (e.key === "/") {
			e.preventDefault();
			openChatPanel();
			messageInput.focus();
		}
		else if (e.key === "Escape") {
			e.preventDefault();
			modal.showModal();
		}
		else if ((e.key === "=" || e.key == "+")) {
			e.preventDefault();
			z += 0.02;
			pos();
		}
		else if (e.key === "-") {
			e.preventDefault();
			z -= 0.02;
			pos();
		}

		// Move around with arrow keys
		let moveEaseI = 10;
		let arrowkeyDown = {
			left: false,
			right: false,
			up: false,
			down: false
		};
		let repeatFunc = setInterval(function() {
			// We use 55 because: 10/55+9/55+8/55+7/55+6/55+5/55+4/55+3/55+2/55+1/55 = 1
			switch (e.keyCode) {
			case 37:
				x -= moveEaseI / 55
				arrowkeyDown.right = true
				break //right
			case 38:
				y -= moveEaseI / 55
				arrowkeyDown.up = true
				break //up
			case 39:
				x += moveEaseI / 55
				arrowkeyDown.left = true
				break //left
			case 40:
				y += moveEaseI / 55
				arrowkeyDown.down = true
				break //down
			}
			pos()
			moveEaseI--
			if (moveEaseI <= 0) clearInterval(repeatFunc)
		}, 16);
	}

	//Begin palette commands
	if (onCooldown || canvasLocked) {
		return;
	}

	//"Enter" key to place selected block without using mouse
	if (e.key == "Enter" && (!document.activeElement || !("value" in document.activeElement))) {
		placeOkButton.click();
	}

	//Keyboard shortcuts for selecting palette colours
	let keyIndex = null
	if (document.activeElement != document.body) {
		return
	}
	keyIndex = (localStorage.paletteKeys || DEFAULT_PALETTE_KEYS).indexOf(e.key)
	if (keyIndex == -1) {
		return
	}
	if (palette.style.transform == "translateY(100%)") {
		showPalette()
	}
	for (let c = 0; c < colours.children.length; c++) {
		const indicator = /**@type {HTMLElement}*/(colours.children[c].firstChild);
		indicator.style.visibility = "visible"
	}
	let colourI = [...(colours.children)]
		.indexOf(colours.children[keyIndex])
	if (colourI < 0) return
	let el = colours.children[PEN]
	if (el) {
		el.classList.remove("sel")
	}
	PEN = keyIndex;
	AUDIOS.selectColour.run()
	canvSelect.style.background = colours.children[keyIndex].style.background
	colours.children[keyIndex].classList.add("sel")
	placeOkButton.classList.add("enabled")
	canvSelect.children[0].style.display = "none"
	canvSelect.style.outline= "8px white solid"
	canvSelect.style.boxShadow= "0px 2px 4px 0px rgb(0 0 0 / 50%)"
});

/**
 * @param {number} w
 * @param {number} h
 */
export function setSize(w, h = w) {
	canvas.width = w;
	canvas.height = h;
	canvParent1.style.width = w + "px";
	canvParent1.style.height = h + "px";
	canvParent2.style.width = w + "px";
	canvParent2.style.height = h + "px";
	board = new Uint8Array(w * h).fill(255);
	let i = board.length;
	x = +localStorage.x || WIDTH / 2;
	y = +localStorage.y || HEIGHT / 2;
	z = +localStorage.z || 0.2;

	for (let [key, value] of new URLSearchParams(location.search)) {
		switch (key) { // Only for numeric value params
			case "x": {
				x = parseInt(value, 10) || 0;
				pos();
				break;
			}
			case "y": {
				y = parseInt(value, 10) || 0;
				pos(); break;
			}
			case "z": {
				z = parseInt(value, 10) || 0;
				break;
			}
			case "err": {
				onerror = alert;
				break;
			}
			case "overlay":
				overlayInfo = JSON.parse(atob(value));
				const decoded = atob(overlayInfo.data);
				const data = new Uint8Array(new ArrayBuffer(decoded.length));
				for (let i = 0; i < decoded.length; i++) {
					data[i] = decoded.charCodeAt(i);
				}

				const templateImage = /**@type {HTMLImageElement}*/($("#templateImage"));
				templateImage.src = URL.createObjectURL(new Blob([data], { type: overlayInfo.type }));
				overlayInfo.x = overlayInfo.x || 0;
				overlayInfo.y = overlayInfo.y || 0;
				templateImage.style.transform = `translate(${overlayInfo.x}px, ${overlayInfo.y}px)`;
				templateImage.style.opacity = String(overlayInfo.opacity || 0.8);
				x = overlayInfo.x;
				y = overlayInfo.y;
				z = Math.min(Math.max(z, minZoom), 1);
				pos();

				const overlayMenu = /**@type {HTMLElement}*/($("#overlayMenu"));
				overlayMenu.setAttribute('opened', 'true');;
				break;
		}
	}
	onWindowResize();
}

function onWindowResize() {
	minZoom = Math.min(innerWidth / canvas.width, mainContent.offsetHeight / canvas.height) / 100
	pos()
}

window.addEventListener("resize", onWindowResize);

// Mouse input handling
export let lastMouseMove = 0
export let mouseDown = 0
export let mx = 0
export let my = 0

mainContent.addEventListener("mousemove", function(/** @type {{ target: any; clientX: number; clientY: number; }} */ e) {
	lastMouseMove = Date.now()
	if (e.target != mainContent && !canvParent2.contains(e.target)) {
		return
	}
	moved--
	let dx = -(mx - (mx = e.clientX - innerWidth / 2))
	let dy = -(my - (my = e.clientY - mainContent.offsetHeight / 2))
	if (dx != dx || dy != dy) {
		return
	}
	if (mouseDown) {
		x -= dx / (z * 50)
		y -= dy / (z * 50)
		pos()
		if (anim) {
			clearInterval(anim)
		}
	}
})

mainContent.addEventListener("wheel", function(/** @type {{ target: any; deltaY: number; }} */ e) {
	if (e.target != mainContent && !canvParent2.contains(e.target)) {
		return
	}
	let d = Math.max(minZoom / z, Math.min(3 ** Math.max(-0.5, Math.min(0.5, e.deltaY * -0.01)), 1 / z))
	z *= d
	x += mx * (d - 1) / z / 50
	y += my * (d - 1) / z / 50
	pos()
})

let idPositionDebounce = false
/**@type {Timer|null}*/let idPositionTimeout = null
let lastIntX = Math.floor(x)
let lastIntY = Math.floor(y)

const posEl = /**@type {HTMLElement}*/($("#posel"));
const idPosition = /**@type {HTMLElement}*/($("#idPosition"));

export function pos(newX=x, newY=y, newZ=z) {
	newX = x = Math.max(Math.min(newX, WIDTH - 1), 0)
	newY = y = Math.max(Math.min(newY, HEIGHT - 1), 0)
	newZ = z = Math.min(Math.max(newZ, minZoom), 1)

	const right = newX - canvas.width + 0.01
	const left = newX
	const up = newY - canvas.height + 0.01
	const down = newY

	if (right >= left) newX = 0
	else if (right > 0) newX -= right
	else if (left < 0) newX -= left
	if (up >= down) newY = 0
	else if (up > 0) newY -= up
	else if (down < 0) newY -= down
	posEl.textContent = `(${Math.floor(newX)},${Math.floor(newY)}) ${newZ > 0.02 ? Math.round(newZ*50)/10 : Math.ceil(newZ*500)/100}x`
	localStorage.x = Math.floor(newX) + 0.5
	localStorage.y = Math.floor(newY) + 0.5
	localStorage.z = newZ
	transform()

	const intX = Math.floor(newX), intY = Math.floor(newY)
	if (intX != lastIntX || intY != lastIntY) {
		if(idPositionTimeout) {
			clearTimeout(idPositionTimeout)
		}
		idPosition.style.display = "none"
		idPositionDebounce = false
	}
	lastIntX = intX
	lastIntY = intY

	if (!idPositionDebounce) {
		idPositionDebounce = true

		idPositionTimeout = setTimeout(() => {
			idPositionDebounce = false
			let id = intIdPositions.get(intX + intY * WIDTH)
			if (id === undefined || id === null) {
				// Request 16x16 region of pixel placers from server (fine tune if necessary)
				const placersRadius = 16
				if (requestPixelPlacers) {
					requestPixelPlacers(Math.max(intX - placersRadius / 2, 0), Math.max(intY - placersRadius / 2),
						Math.min(placersRadius, WIDTH - intX), Math.min(placersRadius, HEIGHT - intY))
				}
				return
			}
			idPosition.style.display = "flex"
			idPosition.style.left = intX + "px"
			idPosition.style.top = intY + "px"
			if (idPosition.children[1]) {
				/** @type {HTMLElement} */(idPosition.children[1]).style.color = CHAT_COLOURS[hash("" + id) & 7]
				idPosition.children[1].textContent = intIdNames.get(id) || ("#" + id)	
			}
		}, 1000)
	}
}

export let boardAlreadyRendered = false
export function renderAll() {
	const img = new ImageData(canvas.width, canvas.height)
	const data = new Uint32Array(img.data.buffer)
	if (board) {
		for (let i = 0; i < board.length; i++) {
			data[i] = PALETTE[board[i]]
		}	
	}

	if (canvasCtx) {
		canvasCtx.putImageData(img, 0, 0)
		// HACK: Workaround for blank-canvas bug on chrome on M1 chips
		canvasCtx.getImageData(0, 0, 1, 1)
		boardAlreadyRendered = true	
	}
}

const onlineCounter = /**@type {HTMLElement}*/($("#onlineCounter"));
export function setOnline(/**@type {Number}*/count) {
	onlineCounter.textContent = String(count);
	sendPostsFrameMessage("onlineCounter", count);
}

const canvasLock = /**@type {HTMLElement}*/($("#canvasLock"));
export function setCanvasLocked(/**@type {boolean}*/locked, /**@type {string|null}*/reason=null) {
	canvasLock.style.display = locked ? "flex" : "none";
	if (reason) {
		// TODO: Find a more elegant solution
		alert(reason);
	}
}

const namePanel = /**@type {HTMLElement}*/($("#namePanel"));
export function setChatName(/**@type {string}*/name) {
	namePanel.style.visibility = "hidden";
}

/**@type {Uint32Array}*/let xa = new Uint32Array(1)
/**@type {Uint8Array}*/let xb = new Uint8Array(xa.buffer)

/**
 * @param {number} x
 * @param {number} y
 * @param { number} colour
 */
export function set(x, y, colour) {
	if (!board) {
		return;
	}
	board[x % canvas.width + (y % canvas.height) * canvas.width] = colour
	xa[0] = PALETTE[colour]
	if (canvasCtx) {
		canvasCtx.fillStyle = "#" + (xb[0] < 16 ? "0" : "") + xb[0].toString(16) + (xb[1] < 16 ? "0" : "") + xb[1].toString(16) + (xb[2] < 16 ? "0" : "") + xb[2].toString(16) + (xb[3] < 16 ? "0" : "") + xb[3].toString(16)
		canvasCtx.clearRect(x, y, 1, 1)
		canvasCtx.fillRect(x, y, 1, 1)	
	}
}

mainContent.addEventListener("touchmove", function(/**@type {TouchEvent}*/ e) {
	if (!e.target) {
		return;
	}

	for (let i = 0; i < e.changedTouches.length; i++) {
		const touch = e.changedTouches[i];
		if (!touch) {
			continue;
		}
		if (anim) {
			clearInterval(anim);
		}
		const touchTarget = /**@type {HTMLElement}*/(e.target);

		// Single touch move
		if (!touch2 && touch1 && touch1.identifier == touch.identifier) {
			touchMoveDistance -= Math.abs(touch.clientY - touch1.clientY) + Math.abs(touch.clientX - touch1.clientX)
			if (e.target != mainContent && !canvParent2.contains(touchTarget)) {
				break
			}
			x -= (touch.clientX - touch1.clientX) / (z * 50)
			y -= (touch.clientY - touch1.clientY) / (z * 50)
			pos()
		}

		// Multi-touch move
		else if (touch1 && touch2) {
			if (e.target != mainContent && !canvParent2.contains(touchTarget)) {
				break
			}
			let currentTouch = touch1.identifier == touch.identifier ? touch1 : (touch2.identifier == touch.identifier ? touch2 : null)
			if (!currentTouch) {
				break
			}
			const otherTouch = currentTouch == touch1 ? touch2 : touch1
			x -= (touch.clientX - currentTouch.clientX) / (z * 50)
			y -= (touch.clientY - currentTouch.clientY) / (z * 50)
			touchMoveDistance -= Math.abs(touch.clientY - currentTouch.clientY) + Math.abs(touch.clientX - currentTouch.clientX)
			let dx = currentTouch.clientX - otherTouch.clientX
			let dy = currentTouch.clientY - otherTouch.clientY
			let initialDistance = dx * dx + dy * dy
			dx = touch.clientX - otherTouch.clientX
			dy = touch.clientY - otherTouch.clientY
			const scale = Math.sqrt((dx * dx + dy * dy) / initialDistance)
			z *= scale
			pos()
		}
		// Update touch points
		if (touch1 && touch1.identifier == touch.identifier) touch1 = touch
		else if (touch2 && touch2.identifier == touch.identifier) touch2 = touch
	}
})

// Blank default render and canvas size init before we have loaded board
setSize(DEFAULT_WIDTH, DEFAULT_HEIGHT)
renderAll()
/**@type {Timer|null}*/let anim = null

/**
 * @param {number} clientX
 * @param {number} clientY
 */
function clicked(clientX, clientY) {
	if (anim) {
		clearInterval(anim)
	}

	clientX = Math.floor(x + (clientX - innerWidth / 2) / z / 50) + 0.5
	clientY = Math.floor(y + (clientY - mainContent.offsetHeight / 2) / z / 50) + 0.5
	if (clientX == Math.floor(x) + 0.5 && clientY == Math.floor(y) + 0.5) {
		clientX -= 0.5;
		clientY -= 0.5
		if ((cooldownEndDate||0) < Date.now()) {
			zoomIn()
			showPalette()
		}
		else {
			AUDIOS.invalid.run()
		}
		return
	}
	((cooldownEndDate||0) > Date.now() ? AUDIOS.invalid : AUDIOS.highlight).run()
	anim = setInterval(function() {
		x += (clientX - x) / 10
		y += (clientY - y) / 10
		pos()
		if (Math.abs(clientX - x) + Math.abs(clientY - y) < 0.1) clearInterval(anim)
	}, 15)
}

function zoomIn() {
	if (z >= 0.4) return
	if (anim) {
		clearInterval(anim)
	}
	let dz = 0.005
	anim = setInterval(function() {
		if (dz < 0.2) dz *= 1.1
		z *= 1 + dz
		pos()
		if (anim && z >= 0.4) {
			clearInterval(anim)
		}
	}, 15)
}

HTMLAudioElement.prototype.run = Audio.prototype.run = async function() {
	if (muted) {
		return
	}
	this.currentTime = 0
	this.play().catch((/** @type {any} */ e) => e)
}

// Necessary because of rolling updates
if (localStorage.muted !== "true") { // Prefer false
	localStorage.muted = "false";
}
if (localStorage.placeChat !== "false") { // Prefer true
	localStorage.placeChat = "true";
}
let muted = localStorage.muted === "true";
let placeChat = localStorage.placeChat === "true";
let onCooldown = false;
let PEN = -1;

$("#mutesvg").innerHTML = muted ? MUTED_SVG : UNMUTED_SVG
$("#placeChatButton").children[0].style.opacity = placeChat ? '1' : '0.6'

let focused = true;
window.addEventListener("blur", () => {
	focused = false
});
window.addEventListener("focus", () => {
	focused = true
});

const placeButton = /**@type {HTMLButtonElement}*/($("#place")); 
const placeOkButton = /**@type {HTMLButtonElement}*/($("#pok"));
const placeCancelButton = /**@type {HTMLButtonElement}*/($("#pcancel"));

placeOkButton.addEventListener("click", function(e) {
	// If cooldownEndDate is null but we have already made that initial connection, we have likely ghost disconnected from the WS
	if (!e.isTrusted || !focused || !initialConnect
		|| (cooldownEndDate === null && initialConnect)
		|| (cooldownEndDate && cooldownEndDate > Date.now())) {
		return
	}
	if (!placeOkButton.classList.contains("enabled")) {
		return
	}
	if (!tryPutPixel || !tryPutPixel(e, x, y, PEN)) {
		console.error("Failed to place pixel at", x, y, "with colour", PEN)
		return
	}

	// Place success - apply on clientside
	hideIndicators();
	set(Math.floor(x), Math.floor(y), PEN)
	placeOkButton.classList.remove("enabled")
	canvSelect.style.background = ""
	canvSelect.children[0].style.display = "block"
	canvSelect.style.outline = ""
	canvSelect.style.boxShadow = ""
	palette.style.transform = "translateY(100%)"
	AUDIOS.cooldownStart.run()

	if (!mobile) {
		colours.children[PEN].classList.remove("sel")
		PEN = -1
	}
});

placeButton.addEventListener("click", function(e) {
	if (!e.isTrusted) {
		return;
	}

	if (initialConnect && cooldownEndDate < Date.now()) {
		zoomIn()
		showPalette()
	
		// Persistent colours on mobile platforms
		if (PEN != -1) {
			placeOkButton.classList.add("enabled")
			canvSelect.style.background = colours.children[PEN].style.background
			canvSelect.children[0].style.display = 'none'
			canvSelect.style.outline = '8px white solid'
			canvSelect.style.boxShadow = '0px 2px 4px 0px rgb(0 0 0 / 50%)'
		}
	}
	else {
		AUDIOS.invalid.run()
	}
});

placeCancelButton.addEventListener("click", function(e) {
	if (!e.isTrusted) {
		return;
	}

	AUDIOS.closePalette.run()
	canvSelect.style.background = ''
	palette.style.transform = 'translateY(100%)'
	if (PEN != -1) {
		colours.children[PEN].classList.remove('sel')
		PEN = -1
	}
	placeOkButton.classList.remove('enabled')
	canvSelect.children[0].style.display = 'block'
	canvSelect.style.outline = ''
	canvSelect.style.boxShadow = ''
	hideIndicators()
})

setInterval(async () => {
	let left = Math.floor((cooldownEndDate - Date.now()) / 1000)
	placeButton.innerHTML = initialConnect
		? cooldownEndDate === null // They have made initial connect
			? `<span style="color:#f50; white-space: nowrap;">${await translate("connectingFail")}</span>` // They connected but now have disconnected
			: left > 0
				? `<svg xmlns="http://www.w3.org/2000/svg" data-name="icons final" viewBox="0 0 20 20" style="height: 1.1rem;vertical-align:top"><path d="M13.558 14.442l-4.183-4.183V4h1.25v5.741l3.817 3.817-.884.884z"></path><path d="M10 19.625A9.625 9.625 0 1119.625 10 9.636 9.636 0 0110 19.625zm0-18A8.375 8.375 0 1018.375 10 8.384 8.384 0 0010 1.625z"></path></svg> ${
						("" + Math.floor(left/3600)).padStart(2, "0")}:${("" + Math.floor((left / 60)) % 60).padStart(2, "0")}:${("" + left % 60).padStart(2, "0")}` // They are connected + still connected but in cooldown
				: await translate("placeTile") // They are connected + still connected + after cooldown
		: await translate("connecting") // They are yet to connect

	if (cooldownEndDate > Date.now() && !onCooldown) {
		onCooldown = true
	}
	if (cooldownEndDate < Date.now() && onCooldown) {
		onCooldown = false
		if (!document.hasFocus()) AUDIOS.cooldownEnd.run()
	}
}, 200)

const palette = /**@type {HTMLElement}*/($("#palette"));
function showPalette() {
	palette.style.transform = "";
	AUDIOS.highlight.run();
}

export function generatePalette() {
	colours.innerHTML = ""
	for (let i = PALETTE_USABLE_REGION.start; i < PALETTE_USABLE_REGION.end; i++) {
		const colour = PALETTE[i] || 0
		const colourEl = document.createElement("div")
		colourEl.dataset.index = String(i)
		colourEl.style.background = `rgba(${colour & 255},${(colour >> 8) & 255},${(colour >> 16) & 255}, 1)`
		if (colour == 0xffffffff) {
			colourEl.style.outline = "1px #ddd solid"
			colourEl.style.outlineOffset = "-1px"
		}
		const indicatorSpan = document.createElement("span")
		indicatorSpan.contentEditable = "true"
		indicatorSpan.onkeydown = function(event) {
			rebindIndicator(event, i)
		}
		colourEl.appendChild(indicatorSpan)
		colours.appendChild(colourEl)
	}
}
generatePalette()

colours.onclick = (/**@type {MouseEvent}*/e) => {
	const clickedColour = /**@type {HTMLElement}*/(e.target);
	if (!clickedColour || !clickedColour.dataset.index) {
		return
	}
	const i = parseInt(clickedColour.dataset.index)
	if (Number.isNaN(i) || i < PALETTE_USABLE_REGION.start || i >= PALETTE_USABLE_REGION.end) {
		return
	}
	for (let i = 0; i < colours.children.length; i++) {
		const colour = colours.children[i];
		colour.classList.remove("sel")
	}
	PEN = i
	canvSelect.style.background = clickedColour.style.background
	clickedColour.classList.add("sel")
	placeOkButton.classList.add("enabled")
	canvSelect.children[0].style.display = "none"
	canvSelect.style.outline = "8px white solid"
	canvSelect.style.boxShadow = "0px 2px 4px 0px rgb(0 0 0 / 50%)"
	hideIndicators()
	AUDIOS.selectColour.run()
}

/**
 * @param {{ getUint32: (arg0: number) => number; byteLength: number; getUint8: (arg0: number) => number; getUint16: (arg0: number) => number; }} data
 * @param {any} buffer
 */
export function runLengthChanges(data, buffer) {
	let i = 9,
	boardI = 0
	let w = data.getUint32(1), h = data.getUint32(5)
	if (w != WIDTH || h != HEIGHT) setSize(w, h)
	board = new Uint8Array(buffer)
	while (i < data.byteLength) {
		let cell = data.getUint8(i++)
		let c = cell >> 6
		if (c == 1) c = data.getUint8(i++)
		else if (c == 2) c = data.getUint16(i++), i++
		else if (c == 3) c = data.getUint32(i++), i += 3
		boardI += c
		board[boardI++] = cell & 63
	}
	renderAll()
}

// The new server's equivalent for run length changes, based upon run length encoding
/**
 * @param {ArrayBuffer} data
 * @param {number} length
 */
export function runLengthDecodeBoard(data, length) {
	const dataArr = new Uint8Array(data)
	board = new Uint8Array(length)
	let boardI = 0
	let colour = 0

	for (let i = 0; i < data.byteLength; i++) {
		// Then it is a palette value
		if (i % 2 == 0) {
			colour = dataArr[i]
			continue
		}
		// After colour, loop until we unpack all repeats, byte can only hold max 255,
		// so we add one to repeated data[i], and treat it as if 0 = 1 (+1)
		for (let j = 0; j < dataArr[i] + 1; j++) {
			board[boardI] = colour
			boardI++
		}
	}
	renderAll()
}

const allowed = ["rplace.tk", "rplace.live", "google.com", "wikipedia.org", "pxls.space"]
const webGLSupported = (() => {
	let supported = true
	const glTestCanvas = document.createElement("canvas")
	try { supported = glTestCanvas.getContext("webgl2") !== null }
	catch(e) { supported = false }
	return supported
})();
if (!webGLSupported) {
	console.error("Client doesn't support WebGL! Some site features may break!")
}

const mobile = window.matchMedia("(orientation: portrait)").matches

let extraLanguage = (lang == "en" ? "tr" : lang);
/** @type {Map<string, import("./live-chat-elements.js").LiveChatMessage[]>} */export const cMessages = new Map([
	[extraLanguage, []],
	["en", []]
]);
let chatPreviousLoadDebounce = false;
let chatPreviousAutoLoad = false;
export let currentChannel = lang;
let fetchCooldown = 50;
/**@type {Timer|null}*/let fetchFailTimeout = null;
extraChannel(extraLanguage);
initChannelDrop();
switchLanguageChannel(currentChannel);

async function fetchBoard() {
	// Override browser cache with ?v= param, may incur longer loading times
	// TODO: investigate optimisations to only do a hard reload when necessary
	const response = await fetch((localStorage.board || DEFAULT_BOARD) + "?v=" + Date.now())
	if (!response.ok) {
		showLoadingScreen();
		fetchFailTimeout = setTimeout(fetchBoard, fetchCooldown *= 2);
		if (fetchCooldown > 8000) {
			showLoadingScreen("timeout");
			clearTimeout(fetchFailTimeout);
		}

		return null;
	}

	if (fetchFailTimeout) {
		clearTimeout(fetchFailTimeout);
	}

	return await response.arrayBuffer();
}

// We don't await this yet, when the changes (old server) / canvas width & height (new server) packet
// comes through, it will await this unawaited state until it is fulfilled, so we are sure we have all the data
/**@type {Promise<ArrayBuffer|null>}*/export let preloadedBoard = fetchBoard()

/**
 * @param {number} i
 * @param {number} b
 */
export function seti(i, b) {
	if (!board) {
		return;
	}

	board[i] = b
	xa[0] = PALETTE[b]
	if (canvasCtx) {
		canvasCtx.fillStyle = "#" + (xb[0] < 16 ? "0" : "") + xb[0].toString(16) + (xb[1] < 16 ? "0" : "") + xb[1].toString(16) + (xb[2] < 16 ? "0" : "") + xb[2].toString(16) + (xb[3] < 16 ? "0" : "") + xb[3].toString(16)
		canvasCtx.fillRect(i % WIDTH, Math.floor(i / WIDTH), 1, 1)	
	}
}

function hideIndicators() {
	for (let c = 0; c < colours.children.length; c++) {
		const indicator = /**@type {HTMLElement}*/(colours.children[c]?.firstChild);
		if (indicator) {
			indicator.style.visibility = "hidden";
		}
	}
}

/**
 * @param {KeyboardEvent} e
 * @param {string | number} i
 */
function rebindIndicator(e, i) {
	const indicator = /**@type {HTMLElement}*/ (e.target);
	if (!e.key || e.key.length != 1 || !indicator){
		return;
	}
	indicator.innerText = e.key
	indicator.blur()

	let binds = (localStorage.paletteKeys || DEFAULT_PALETTE_KEYS).split("")
	let preExisting = binds.indexOf(e.key)
	if (preExisting != -1) {
		binds[preExisting] = "​"
	}
	binds[i] = e.key.charAt(0)
	localStorage.paletteKeys = binds.join("")
	generateIndicators(binds.join(""))
}
/**
 * @param {string} keybinds
 */
export function generateIndicators(keybinds) {
	for (let c = 0; c < colours.children.length; c++) {
		const indicator = /**@type {HTMLElement}*/(colours.children[c].firstChild);
		indicator.textContent = keybinds.charAt(c)
	}
}
generateIndicators(localStorage.paletteKeys || DEFAULT_PALETTE_KEYS)

if (chatName) {
	namePanel.style.visibility = "hidden"
}

const channelDrop = /**@type {HTMLElement}*/($("#channelDrop"));
function initChannelDrop() {
	let containsMy = false

	channelDrop.children[0].innerHTML = ""
	for (let [code, info] of LANG_INFOS) {
		if (code == lang) containsMy = true
		let el = document.createElement("li")
		el.innerHTML = `<span>${info.name}</span> <img src="${info.flag}" style="height: 24px;">`
		el["lang"] = code
		channelDrop.children[0].appendChild(el)
	}

	if (!containsMy) {
		let el = document.createElement("li")
		el.innerHTML = `<span>${lang}</span>`
		el["lang"] = lang
		channelDrop.children[0].appendChild(el)
	}
}

const channelEn = /**@type {HTMLElement}*/($("#channelEn"));
const channelMine = /**@type {HTMLElement}*/($("#channelMine"));
const channelMineName = /**@type {HTMLElement}*/($("#channelMineName"));
const channelMineImg = /**@type {HTMLImageElement}*/($("#channelMineImg"));
/**
 * @param {string} code
 */
function extraChannel(code) {
	let info = LANG_INFOS.get(code)
	channelMineName.innerText = code.toUpperCase()
	channelMineImg.src = info?.flag || "svg/flag-unknown.svg";
	channelMineImg.style.display = ((info?.flag) ? "inline" : "none")
	extraLanguage = code
	cMessages.set(code, cMessages.get(code) || [])
}

const chatMessages = /**@type {HTMLElement}*/($("#chatMessages"));

/**
 * @param {string} selected
 */
function switchLanguageChannel(selected) {
	channelMine.style.opacity = "0.5"
	channelEn.style.opacity = "0.5"
	if (currentChannel != selected) {
		chatCancelReplies()
	}
	currentChannel = selected
	chatMessages.style.direction = (LANG_INFOS.get(selected)?.rtl) ? "rtl" : "ltr"

	if (selected == "en") {
		channelEn.style.opacity = "1"
	}
	else if (selected == extraLanguage) {
		channelMine.style.opacity = "1"
	}
	chatMessages.innerHTML = ""
	// User must ask to load previous at least once for each channel before site
	// will start auto loading previous chat messages
	chatPreviousAutoLoad = false
	const messageRenderPromises = []

	if (cMessages.get(selected)?.length) {
		for (const messageEl of cMessages.get(selected) ?? []) {
			messageRenderPromises.push(messageEl.updateComplete)
			chatMessages.appendChild(messageEl)
		}
		Promise.all(messageRenderPromises).then(() => {
			chatMessages.scrollTo(0, chatMessages.scrollHeight)
		})
	}
	else if (requestLoadChannelPrevious) {
		// If we don't have any cached messages for this channel, try pre-populate with a few
		const oldestMessage = /**@type {import("./live-chat-elements.js").LiveChatMessage|null}*/(chatMessages.children[0])
		requestLoadChannelPrevious(oldestMessage?.messageId || 0, 32)
	}
}

/**
 * @param {number} messageId
 * @param {string} txt
 * @param {number} senderId
 * @param {string|null} name
 * @param {number} sendDate
 * @param {number|null} repliesTo
 * @param {Map<string, Set<number>>|null} reactions
 * @returns {import("./live-chat-elements.js").LiveChatMessage}
 */
export function createLiveChatMessage(messageId, txt, senderId, name, sendDate, repliesTo = null, reactions = null) {
	const message = /**@type {import("./live-chat-elements.js").LiveChatMessage}*/(document.createElement("r-live-chat-message"));
	message.messageId = messageId;
	message.content = txt;
	message.senderId = senderId;
	message.name = name;
	message.sendDate = sendDate;
	message.repliesTo = repliesTo;
	message.reactions = reactions;
	return message;
}

const chatPreviousButton = /**@type {HTMLButtonElement}*/($("#chatPreviousButton"));

/**
 * @param {string} command 
 * @param {string} message 
 */
export function handleLiveChatCommand(command, message) {
	switch (command) {
		case "name": {
			const namePanel = /**@type {HTMLElement}*/(document.getElementById("namePanel"));
			const nameInput = /**@type {HTMLInputElement}*/(document.getElementById("nameInput"));
			namePanel.style.visibility = "visible";
			nameInput.value = message.slice(5).trim();
			break;
		}
		case "message": {
			const key = message.slice(4).trim();
			localStorage.vip = key;
			window.location.reload();
			break;
		}
		case "getid": {
			const targetName = message.slice(6).trim().toLowerCase();
			if (!targetName) {
				alert("Your User ID is: #" + intId);
			}
			else {
				let foundUsers = `Found Users with name '${targetName}:'\n`;
				for (const pair of intIdNames) {
					if (pair[1] === targetName) {
						foundUsers += `${pair[1]}, #${pair[0]}\n`;
					}
				}
				alert(foundUsers);
			}
			break;
		}
		case "whoplaced": {
			const id = intIdPositions.get(Math.floor(x) + Math.floor(y) * WIDTH);
			if (id === undefined) {
				alert("Could not find details of who placed pixel at current location...");
				return;
			}
			let name = intIdNames.get(id);
			alert(`Details of who placed at ${
				Math.floor(x)}, ${
				Math.floor(y)}:\nName: ${
				name || 'anon'}\nUser ID: #${
				id}`);
			break;
		}
		case "help": {
			const newMessage = createLiveChatMessage(0, `
# Chat Styling Guide ✨
Text in rplace chat can be styled using a simplified version of markdown:
**bold**, *italic*, ||spoilers||, __underline__, \`code\` & ~strikethrough~.

## Text Formatting:
- \`**bold me**\` → **"I didn't skip leg day"**
- \`*italize me*\` → *"whispering sweet nothings"*  
- \`__underline me__\` → __"the terms no one read"__  
- \`~strike me out~\` → ~~pineapple pizza is actually ok~~  
- \`||spoil the plot||\` → ||"Bruce Willis was dead the whole time"||  
- \`sudo rm -fr /\` → "Remove french translations for a faster PC"  

### Headers:
Use # for a large header, ## for medium, and ### for small. Don’t forget to add a space between the leading heading character and your text!

### Separators:
To create a separator, create a blank line (Shift + Enter on keyboard) and insert a triple dash \`---\`.

### Extras:
1. You can make a list by placing a dash (\`-\`) or star (\`*\`) before what you want to say.
2. > "Block quotes (\`>\`) solve arguments"  
>> \\- Confucius, probably (\`>>\`)

---

# Chat commands:
\`\`\`
:vip        :name       :lookup
:getid      :whoplaced
\`\`\`

## Usage:
\`\`\`
:command arg1 arg2 arg3
\`\`\`

## Example:
\`\`\`
:name zekiah
\`\`\`
(^ Will set your username to 'zekiah')`, 0, ":HELP@RPLACE.LIVE", Date.now());
			chatMessages.insertAdjacentElement("beforeend", newMessage);
			break;
		}
	}
}

/**
 * Adds chat messages to the UI
 * @param {import("./wscapsule.js").LiveChatMessage[]} messages 
 * @param {boolean} before 
 */
export function addChatMessages(messages, before) {
	/** @type {HTMLElement|null} */
	const chatMessages = document.getElementById('chatMessages');
	if (!chatMessages) throw new Error('Chat messages container not found');
	
	const newChatScroll = chatMessages.scrollTop;
	/** @type {Promise<void>[]} */
	const messageRenderPromises = [];

	messages.forEach(msgData => {
		const name = intIdNames.get(msgData.senderIntId) || 'Unknown';
		/** @type {import("./live-chat-elements.js").LiveChatMessage}*/
		const newMessage = createLiveChatMessage(
			msgData.messageId,
			msgData.txt,
			msgData.senderIntId,
			name,
			msgData.sendDate,
			msgData.repliesTo,
			msgData.reactions
		);

		const channelMessages = cMessages.get(currentChannel);
		if (before) {
			chatMessages.prepend(newMessage);
			channelMessages?.unshift(newMessage);
		}
		else {
			chatMessages.append(newMessage);
			channelMessages?.push(newMessage);
		}
		messageRenderPromises.push(
			newMessage.updateComplete.then(() => {
				chatMessages.scrollTop += newMessage.offsetHeight;
			})
		);
	});

	Promise.all(messageRenderPromises).then(() => {
		if (before) {
			chatMessages.scrollTop = chatMessages.scrollTop - chatPreviousButton.offsetHeight;
		}
		chatPreviousLoadDebounce = false;
	});
}
chatMessages.addEventListener("scroll", () => {
	if (chatMessages.scrollTop < 64) {
		if (chatPreviousAutoLoad === true && chatPreviousLoadDebounce === false && requestLoadChannelPrevious) {
			const oldestMessage = /**@type {import("./live-chat-elements.js").LiveChatMessage|null}*/(chatMessages.children[0]);
			requestLoadChannelPrevious(oldestMessage?.messageId || 0);
			chatPreviousLoadDebounce = true;
		}
		else {
			chatPreviousButton.dataset.hidden = "false"
		}
	}
	else {
		chatPreviousButton.dataset.hidden = "true"
	}
})
chatPreviousButton.addEventListener("click", () => {
	if (requestLoadChannelPrevious) {
		const oldestMessage = /**@type {import("./live-chat-elements.js").LiveChatMessage|null}*/(chatMessages.children[0]);
		requestLoadChannelPrevious(oldestMessage?.messageId || 0);
		chatPreviousLoadDebounce = true;
		// Keep loading previous for this channel as they scroll up
		chatPreviousAutoLoad = true	;
	}
})

/**
 * @param {import("./wscapsule.js").LiveChatMessage} message 
 * @param {string} channel 
 */
export function addLiveChatMessage(message, channel) {
	if (!cMessages.has(channel)) {
		cMessages.set(channel, []);
	}

	const newMessage = createLiveChatMessage(
		message.messageId,
		message.txt,
		message.senderIntId,
		message.name,
		message.sendDate,
		message.repliesTo,
		message.reactions
	);

	// Apply user blocking
	if (message.senderIntId !== 0 && blockedUsers.includes(message.senderIntId)) {
		newMessage.style.color = "transparent";
		newMessage.style.textShadow = "0px 0px 6px black";
	}

	// Handle mentions
	if (message.txt.includes("@" + chatName) || 
		message.txt.includes("@#" + intId) || 
		message.txt.includes("@everyone")) {
		newMessage.setAttribute("mention", "true");
		if (channel === currentChannel) {
			AUDIOS.closePalette.run();
		}
	}

	const atScrollBottom = chatMessages.scrollTop + chatMessages.offsetHeight + 64 >= chatMessages.scrollHeight;

	// Update message storage
	const channelMessages = cMessages.get(channel);
	if (channelMessages) {
		channelMessages.push(newMessage);
		if (channelMessages.length > MAX_CHANNEL_MESSAGES) {
			channelMessages.shift();
		}	
	}

	// Update UI if current channel
	if (channel === currentChannel) {
		if (chatMessages.children.length > MAX_CHANNEL_MESSAGES) {
			chatMessages.children[0].remove();
		}
		chatMessages.insertAdjacentElement("beforeend", newMessage);
		newMessage.updateComplete.then(() => {
			if (atScrollBottom) {
				chatMessages.scrollTo(0, chatMessages.scrollHeight);
			}
		});
	}
}

/**
 * @param {import("./wscapsule.js").PlaceChatMessage} message
 */
export function addPlaceChatMessage(message) {
	if (!placeChat) {
		return
	}

	// Create message
	const placeMessage = document.createElement("placechat")
	placeMessage.innerHTML = `<span title="${(new Date()).toLocaleString()}" style="color: ${CHAT_COLOURS[hash("" + message.senderIntId) & 7]};">[${name}]</span><span>${message.txt}</span>`
	placeMessage.style.left = (message.msgPos % WIDTH) + "px"
	placeMessage.style.top = (Math.floor(message.msgPos / WIDTH) + 0.5) + "px"
	canvParent2.appendChild(placeMessage)

	//Remove message after given time
	setTimeout(() => {
		placeMessage.remove();
	}, localStorage.placeChatTime || 7e3)
}

const captchaOptions = /**@type {HTMLElement}*/($("#captchaOptions"));

/**
 * 
 * @param {string[]} options 
 * @param {Uint8Array} imageData 
 * @param {(answer:string) => void} answerCallback
 */
export function handleTextCaptcha(options, imageData, answerCallback) {
	captchaOptions.innerHTML = ""

	let captchaSubmitted = false
	for (const text of options) {
		const button = document.createElement("button")
		button.textContent = text
		captchaOptions.appendChild(button)

		button.addEventListener("click", (event) => {
			if (captchaSubmitted || !text) {
				return console.error("Could not send captcha response. No text?")
			}
			captchaSubmitted = true
			answerCallback(text);
			captchaOptions.style.pointerEvents = "none";	
		})
	}
	captchaPopup.style.display = "flex";
	captchaOptions.style.pointerEvents = "all";

	const imageBlob = new Blob([imageData], { type: "image/png" });
	if (webGLSupported) {
		updateImgCaptchaCanvas(imageBlob)
	}
	else {
		updateImgCaptchaCanvasFallback(imageBlob)
	}
}

/**
 * @param {string[]} options 
 * @param {Uint8Array} imageData 
 * @param {(answer:string) => void} answerCallback
 */
export function handleEmojiCaptcha(options, imageData, answerCallback) {
	captchaOptions.innerHTML = ""

	let captchaSubmitted = false
	for (const emoji of options) {
		let buttonParent = document.createElement("button")
		buttonParent.classList.add("captcha-options-button")
		buttonParent.setAttribute("value", emoji)
		let emojiImg = document.createElement("img")
		emojiImg.src = `./tweemoji/${emoji.codePointAt(0)?.toString(16)}.png`
		emojiImg.alt = emoji
		emojiImg.title = emoji
		emojiImg.fetchPriority = "high"
		emojiImg.addEventListener("load", (event) => {
			buttonParent.classList.add("loaded")
		})
		buttonParent.appendChild(emojiImg)
		captchaOptions.appendChild(buttonParent)

		function submitCaptcha() {
			if (captchaSubmitted || !emoji) {
				return console.error("Could not send captcha response. No emoji?")
			}
			captchaSubmitted = true
			answerCallback(emoji)
			captchaOptions.style.pointerEvents = "none";	
			clearCaptchaCanvas();
		}
		buttonParent.addEventListener("click", submitCaptcha)
		emojiImg.addEventListener("click", submitCaptcha)
		buttonParent.addEventListener("touchend", submitCaptcha)
		emojiImg.addEventListener("touchend", submitCaptcha)
	}

	captchaPopup.style.display = "flex"
	captchaOptions.style.pointerEvents = "all"
	const imageBlob = new Blob([imageData], { type: "image/png" })
	if (webGLSupported) {
		updateImgCaptchaCanvas(imageBlob)
	}
	else {
		updateImgCaptchaCanvasFallback(imageBlob)
	}
}

const turnstileMenu = /**@type {HTMLElement}*/($("#turnstileMenu"));

/**
 * @param {string} siteKey
 * @param {(token: string) => void} turnstileCallback
 */
export function handleTurnstile(siteKey, turnstileCallback) {
	const siteVariant = document.documentElement.dataset.variant
	const turnstileTheme = siteVariant === "dark" ? "dark" : "light"

	turnstileMenu.setAttribute("opened", "true")
	
	// @ts-expect-error
	if (window.turnstile) {
		// @ts-expect-error
		window.turnstile.ready(function () {
			// @ts-expect-error
			window.turnstile.render("#turnstileContainer", {
				sitekey: siteKey,
				theme: turnstileTheme,
				language: lang,
				callback: turnstileCallback
			})
		})	
	}
}

export function handleTurnstileSuccess() {
	turnstileMenu.removeAttribute("opened")
}

const messageInput = /**@type {HTMLInputElement}*/($("#messageInput"));
messageInput.addEventListener("keydown", function(/**@type {KeyboardEvent}*/ e) {
	if (!e.isTrusted) {
		return
	}

	if (e.key == "Enter" && !e.shiftKey) {
		// ctrl + enter send as place chat, enter send as normal live chat
		if (e.ctrlKey && sendPlaceChatMsg) {
			sendPlaceChatMsg(messageInput.value)
		}
		else if (sendLiveChatMsg) {
			sendLiveChatMsg(messageInput.value)
		}
		e.preventDefault()
		messageInput.value = ""
		updateMessageInputHeight()
	}
});

/**
 * @param {string} text
 */
export function chatInsertText(text) {
	const [ start, end ] = [ messageInput.selectionStart, messageInput.selectionEnd ]
	messageInput.setRangeText(text, start || 0, end || 0, "end")
	messageInput.focus()
}

/**
 * @param {number} senderId
 */
export function chatMentionUser(senderId) {
	let mentionText = "@"
	const identifier = intIdNames.get(senderId) || ("#" + senderId)
	if (typeof identifier === "string") {
		mentionText += identifier
	}
	else if (typeof identifier === "number") {
		mentionText += "#" + identifier
	}
	chatInsertText(mentionText)
}

const messageTypePanel = /**@type {HTMLElement}*/($("#messageTypePanel"));
messageTypePanel.children[0].addEventListener("click", function (/**@type {Event}*/e) {
	if (!e.isTrusted) {
		return;
	}

	if (sendPlaceChatMsg) {
		sendPlaceChatMsg(messageInput.value);
		messageInput.value = "";
	}
});
messageTypePanel.children[1].addEventListener("click", function(/**@type {Event}*/e) {
	if (!e.isTrusted) {
		return;
	}

	if (sendLiveChatMsg) {
		sendLiveChatMsg(messageInput.value);
		messageInput.value = "";	
	}
});

const messageInputGifPanel = /**@type {HTMLElement}*/($("#messageInputGifPanel"));
// @ts-expect-error
messageInputGifPanel.addEventListener("gifselection", function(/**@type {CustomEvent}*/ e) {
	const gif = e.detail;
	if (!gif) {
		return;
	}
	messageInputGifPanel.removeAttribute("open")
	if (sendLiveChatMsg) {
		sendLiveChatMsg(`[gif:${gif.id}:tenor]`);
	}
});

const messageReplyPanel = /**@type {HTMLElement}*/($("#messageReplyPanel"));
const messageReplyLabel = /**@type {HTMLElement}*/($("#messageReplyLabel"));

/**
 * @param {any} messageId
 * @param {number} senderId
 */
export async function chatReply(messageId, senderId) {
	for (const messageEl of cMessages.get(currentChannel) || []) {
		messageEl.removeAttribute("reply")
	}
	currentReply = messageId

	// HACK: Ensure no overlap between reply and send features
	messageTypePanel.style.height = "calc(var(--message-input-height) + 92px)"
	messageInput.focus()
	messageReplyPanel.removeAttribute("closed")
	messageReplyLabel.innerText = await translate("replyTo") + ": " + (intIdNames.get(senderId) || ("#" + senderId))
	for (const m of cMessages.get(currentChannel) || []) {
		if (m["messageId"] == messageId) {
			m.setAttribute("reply", "true")
			break
		}
	}
}

export function chatCancelReplies() {
	for (const messageEl of cMessages.get(currentChannel) || []) {
		messageEl.removeAttribute("reply")
	}
	currentReply = null
	// HACK: Ensure no overlap between reply and send features
	messageTypePanel.style.height = "calc(var(--message-input-height) + 62px)"
	messageReplyPanel.setAttribute('closed', 'true')
}

const punishmentNote = /** @type {HTMLElement}*/($("#punishmentNote"));
const punishmentUserId = /** @type {HTMLElement}*/($("#punishmentUserId"));
const punishmentStartDate = /** @type {HTMLElement}*/($("#punishmentStartDate"));
const punishmentEndDate = /** @type {HTMLElement}*/($("#punishmentEndDate"));
const punishmentReason = /** @type {HTMLElement}*/($("#punishmentReason"));
const punishmentAppeal = /** @type {HTMLElement}*/($("#punishmentAppeal"));
const punishmentMenu = /** @type {HTMLElement}*/($("#punishmentMenu"));

/**
 * @param {import("./wscapsule.js").ModerationPacket} packet 
 * @param {number} intId
 */
export function applyPunishment(packet, intId) {
	messageInput.disabled = true;
	if (packet.state === PUNISHMENT_STATE.mute) {
		punishmentNote.innerHTML = "You have been <strong>muted</strong>, you cannot send messages in live chat.";
	} 
	else if (packet.state === PUNISHMENT_STATE.ban) {
		canvasLock.style.display = "flex";
		punishmentNote.innerHTML = "You have been <strong>banned</strong> from placing on the canvas or sending messages in live chat.";
	}

	punishmentUserId.textContent = `Your User ID: #${intId}`;
	punishmentStartDate.textContent = `Started on: ${new Date(packet.startDate).toLocaleString()}`;
	punishmentEndDate.textContent = `Ending on: ${new Date(packet.endDate).toLocaleString()}`;
	punishmentReason.textContent = `Reason: ${packet.reason}`;
	punishmentAppeal.textContent = `Appeal status: ${(packet.appeal && packet.appeal !== "null") ? packet.appeal : 'Unappealable'}`;
	punishmentMenu.setAttribute("opened", "true");
}

const moderationMenu = /**@type {HTMLInputElement}*/($("#moderationMenu"));
const modMemberId = /**@type {HTMLInputElement}*/($("#modMemberId"));
const modMessageId = /**@type {HTMLInputElement}*/($("#modMessageId"));
const modMessagePreview = /**@type {HTMLInputElement}*/($("#modMessagePreview"));
const modDurationH = /**@type {HTMLInputElement}*/($("#modDurationH"));
const modDurationM = /**@type {HTMLInputElement}*/($("#modDurationM"));
const modDurationS = /**@type {HTMLInputElement}*/($("#modDurationS"));
const modAffectsAll = /**@type {HTMLInputElement}*/($("#modAffectsAll"));
const modReason = /**@type {HTMLInputElement}*/($("#modReason"));

function clearChatModerate() {
	modMessageId.value = ""
	modMessagePreview.innerHTML = ""
	modDurationH.value = "0"
	modDurationM.value = "0"
	modDurationS.value = "0"
	modAffectsAll.checked = false
	modReason.value = ""
}

function closeChatModerate() {
	moderationMenu.removeAttribute('opened')
	clearChatModerate()
}
$("#modCloseButton").addEventListener("click", closeChatModerate);
$("#modCancelButton").addEventListener("click", closeChatModerate);

const captchaPopup = /**@type {HTMLElement}*/($("#captchaPopup"));
export function handleCaptchaSuccess() {
	captchaPopup.style.display = "none";
}

const modActionDelete = /**@type {HTMLInputElement}*/($("#modActionDelete"));
const modActionKick = /**@type {HTMLInputElement}*/($("#modActionKick"));
const modActionMute = /**@type {HTMLInputElement}*/($("#modActionMute"));
const modActionBan = /**@type {HTMLInputElement}*/($("#modActionBan"));
const modActionCaptcha = /**@type {HTMLInputElement}*/($("#modActionCaptcha"));

/**
 * @param {"delete"|"kick"|"mute"|"ban"|"captcha"} mode
 * @param {number|null} senderId
 * @param {import("./live-chat-elements.js").LiveChatMessage|null} messageElement
 */
export function chatModerate(mode, senderId, messageId = null, messageElement = null) {
	clearChatModerate()
	modMemberId.value = String(senderId)
	modMessageId.value = String(messageId)
	moderationMenu.setAttribute("opened", "true")
	moderationMenu.setAttribute("mode", mode)
	modMessagePreview.innerHTML = messageElement?.innerHTML || ""

	switch(mode) {
		case "delete":
			modActionDelete.checked = true
			break
		case "kick":
			modActionKick.checked = true
			break
		case "mute":
			modActionMute.checked = true
			break
		case "ban":
			modActionBan.checked = true
			break
		case "captcha":
			modActionCaptcha.checked = true
			break
	}
}

const chatPanel = /**@type {HTMLElement}*/($("#chatPanel"));
const messageEmojisPanel = /**@type {HTMLElement}*/($("#messageEmojisPanel"));

function closeMessageEmojisPanel() {
	messageEmojisPanel.setAttribute("closed", "true")
	messageInput.setAttribute("state", "default")
}

let messageInputHeight = messageInput.scrollHeight
function updateMessageInputHeight() {
	messageInput.style.height = "0px"
	const oldHeight = messageInputHeight
	messageInputHeight = Math.min(messageInput.scrollHeight, 256)
	chatPanel.style.setProperty("--message-input-height", messageInputHeight + "px")
	messageInput.style.height = "" // unset
	const diffHeight = messageInputHeight - oldHeight
	chatMessages.scrollBy(0, diffHeight)
}
window.addEventListener("DOMContentLoaded", () => {
	updateMessageInputHeight()
})

messageInput.oninput = (/** @type {{ isTrusted: any; }} */ e) => {
	if (!e.isTrusted) return
	updateMessageInputHeight()

	messageEmojisPanel.innerHTML = ""
	let comp = ""
	let search = true
	let count = 0
	for (let i = messageInput.value.length - 1; i >= 0; i--) {
		// No emoji code will ever have a space before we reach the opening : (going backwards
		// through string) so we can guess to just stop if seen as we backtrack
		if (messageInput.value[i] == " " && search) {
			comp = ""
			break
		}
		else if (messageInput.value[i] == ":") {
			count++
			search = false
		}
		if (search) {
			comp = messageInput.value[i] + comp
		}
	}
	// All : already closed, they are probably not trying to do an emoji so we ignore
	if (count % 2 == 0) comp = ""

	if (comp) {
		messageInput.setAttribute("state", "command")
	}
	else {
		closeMessageEmojisPanel()
	}

	/**
	 * @param {any} emojiCode
	 */
	function createEmojiEntry(emojiCode) {
		const entryElement = document.createElement("button")
		entryElement.classList.add("message-emojis-suggestion")
		entryElement.title = `Send this emoji in chat with :${emojiCode}:`
		const entryLabel = document.createElement("span")
		entryLabel.textContent = `:${emojiCode}:`
		entryElement.appendChild(entryLabel)
		return entryElement
	}

	let handled = false
	for (const [emojiCode, value] of EMOJIS) {
		if (comp && emojiCode.startsWith(comp)) {
			const entryElement = createEmojiEntry(emojiCode)
			const entryValueText = document.createTextNode(value)
			entryElement.appendChild(entryValueText)
			entryElement.addEventListener("click", function() {
				for (let i = messageInput.value.length - 1; i >= 0; i--) {
					if (messageInput.value[i] == ":") {
						messageInput.value = messageInput.value.slice(0, i) + value
						closeMessageEmojisPanel()
						break
					}
				}
			})
			messageEmojisPanel.appendChild(entryElement)
			messageEmojisPanel.removeAttribute("closed")
		}

		if (messageInput.value.includes(":" + emojiCode + ":")) {
			messageInput.value = messageInput.value.replace(":" + emojiCode + ":", value)
			messageInput.setAttribute("state", "default")
			handled = true
		}
	}
	if (!handled) for (const [emojiCode, value] of CUSTOM_EMOJIS) {
		if (comp && emojiCode.startsWith(comp)) {
			const entryElement = createEmojiEntry(emojiCode)
			entryElement.appendChild(stringToHtml(value))
			entryElement.addEventListener("click", function() {
				for (let i = messageInput.value.length - 1; i >= 0; i--) {
					if (messageInput.value[i] == ":") {
						messageInput.value = messageInput.value.slice(0, i) + ":" + emojiCode + ":"
						closeMessageEmojisPanel()
						break
					}
				}
			})
			messageEmojisPanel.appendChild(entryElement)
			messageEmojisPanel.removeAttribute("closed")
		}

		if (messageInput.value.includes(":" + emojiCode + ":")) {
			messageInput.setAttribute("state", "default")
			handled = true
		}
	}
	if (!handled) for (const [commandCode, value] of COMMANDS) {
		if (comp && commandCode.startsWith(comp)) {
			const entryElement = document.createElement("button")
			entryElement.classList.add("message-emojis-suggestion")
			entryElement.title = `Use this command in chat :${commandCode} [ARGUMENTS]`
			const entryLabel = document.createElement("span")
			entryLabel.textContent = `:${commandCode}`
			entryElement.appendChild(entryLabel)
			entryElement.addEventListener("click", function() {
				messageInput.value = ":" + commandCode
				closeMessageEmojisPanel()
			})
			entryElement.appendChild(stringToHtml(value))
			messageEmojisPanel.appendChild(entryElement)
			messageEmojisPanel.removeAttribute("closed")
		}

		if (messageInput.value.includes(":" + commandCode)) {
			messageInput.setAttribute("state", "default")
			handled = true
		}
	}
}

const messageInputEmojiPanel = /**@type {HTMLElement}*/($("#messageInputEmojiPanel"));
// @ts-expect-error
messageInputEmojiPanel.addEventListener("emojiselection", (/**@type {CustomEvent}*/ e) => {
	messageInputEmojiPanel.removeAttribute("open")
	if (CUSTOM_EMOJIS.has(e.detail.key)) {
		chatInsertText(`:${e.detail.key}:`)
	}
	else {
		chatInsertText(e.detail.value)
	}
})

/**
 * @param {string} serverAddress
 */
function switchGameServer(serverAddress) {
	if (serverAddress) {
		let [a, b] = serverAddress.split(" ").reverse()
		if (!b)[b, a] = [a + '/place', 'server.' + a]
		a = "wss://" + a
		b = "https://" + b
		server(a, b)
	}
	else {
		delete localStorage.board
		delete localStorage.server
	}
	let queries = location.toString().split('?')
	if (queries.length > 1) {
		location.replace(location.toString().split('?')[0]);
	}
	else {
		location.reload();
	}
}

/**
 * @param {any} serverAddress
 * @param {any} boardAddress
 */
function server(serverAddress, boardAddress, vip = "", storage = localStorage) {
	if (!serverAddress) {
		storage.vip = storage.vip2
		delete storage.vip2
		delete storage.server
		delete storage.board
		return
	}

	storage.vip2 = storage.vip2 || storage.vip
	storage.vip = vip
	storage.server = serverAddress
	storage.board = boardAddress
}

/**
 * @param {string} forceTheme
 * @param {string|null} forceVariant
 * @param {string|null} forceEffects 
 */
export async function forceTheme(forceTheme, forceVariant = null , forceEffects = null) {
	const currentThemeSet = document.documentElement.dataset.theme
	const currentVariant = document.documentElement.dataset.variant
	if (currentThemeSet != forceTheme || currentVariant != forceVariant) {
		console.warn("Forcing site theme to", forceTheme, forceVariant)
		await theme(DEFAULT_THEMES.get(forceTheme), forceVariant, forceEffects)
	}
}

/**@type {HTMLLinkElement|null}*/let styleElement = null;
/**@type {import("./defaults.js").ThemeInfo|null}*/let currentTheme = null;

/**
 * @param {import("./defaults.js").ThemeInfo} themeSet
 * @param {string|null} variant
 * @param {string|null} effects 
 */
async function theme(themeSet, variant = null, effects = null) {
	variant ??= "";

	// Effects
	disableDarkplace();
	disableWinter();
	switch (effects) {
		case "darkplace":
			enableDarkplace();
			break;
		case "winter":
			enableWinter();
			break;
	}

	if (currentTheme !== themeSet) {
		// Intermediate stylesheet handles giving a nice transition animation during theme change
		const intermediate = document.createElement("link");
		intermediate.rel = "stylesheet";
		intermediate.type = "text/css";
		intermediate.href = "theme-switch.css";
		intermediate.setAttribute("intermediate-temp", "true");
		await (new Promise(resolve => {
			intermediate.onload = resolve;
			document.head.appendChild(intermediate);
		}))

		// Load in new CSS
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.type = "text/css";
		link.href = themeSet.css + "?v=" + themeSet.cssVersion;
		await (new Promise(async (resolve) => {
			link.onload = resolve;
			document.head.appendChild(link);
		}));
		setTimeout(() => document.head.removeChild(intermediate), 200)
;
		// Swap out intermediate and old stylesheet
		if (styleElement) {
			document.head.removeChild(styleElement);
		}
		styleElement = link;
		currentTheme = themeSet;

		document.querySelectorAll("[theme]").forEach((element) => {
			const themeKey = element.getAttribute("theme")
			if (!themeKey) {
				return
			}
			if (element.tagName == "IMG") {
				const imageElement = /**@type {HTMLImageElement}*/(element);
				imageElement.src = themeSet[themeKey] || imageElement.src
			}
			else {
				element.innerHTML = themeSet[themeKey] || element.innerHTML
			}
		})
		document.documentElement.dataset.theme = themeSet.id
	}
	document.documentElement.dataset.variant = variant
}
const startupThemeSet = /**@type {import("./defaults.js").ThemeInfo}*/(DEFAULT_THEMES.get(localStorage.theme || "r/place 2022"));
theme(startupThemeSet, localStorage.variant, localStorage.effects);
themeDropName.textContent = "🖌️ " + (localStorage.theme || "r/place 2022");

/**
 * @param {number} num
 * @param {number} min
 * @param {number} max
 */
function clamp(num, min, max) {
	return Math.min(Math.max(num, min), max);
}

const tlSelect = /**@type {HTMLElement}*/($("#tlSelect"));
const tlImage = /**@type {HTMLImageElement}*/($("#tlImage"));
const timelapsePanel = /**@type {HTMLElement}*/($("#timelapsePanel"));
const tlConfirm = /**@type {HTMLButtonElement}*/($("#tlConfirm"));
const tlStartSel = /**@type {HTMLSelectElement}*/($("#tlStartSel"));
const tlEndSel = /**@type {HTMLSelectElement}*/($("#tlEndSel"));
const tlTimer = /**@type {HTMLElement}*/($("#tlTimer"));
const tlFps = /**@type {HTMLInputElement}*/($("#tlFps"));
const tlPlayDir = /**@type {HTMLInputElement}*/($("#tlPlayDir"));

/**
 * @param {MouseEvent} e
 */
function tlMouseMove(e) {
	if (tlSelect.getAttribute("dragging") == "true") {
		tlSelect.style.cursor = "default"
		return
	}
	tlSelect.style.left = clamp(e.clientX - tlImage.getBoundingClientRect().left, 0, WIDTH - tlSelect.offsetWidth) + "px"
	tlSelect.style.top = clamp(e.clientY - tlImage.getBoundingClientRect().top, 0, HEIGHT - tlSelect.offsetHeight) + "px"
	tlSelect.style.cursor = "all-scroll"
}

function toggleTlPanel() {
	timelapsePanel.style.display = timelapsePanel.style.display == 'none' ? 'block' : 'none'
	tlImage.src = canvas.toDataURL("image/png")
	tlSelect.style.width = WIDTH + "px"
	tlSelect.style.height = HEIGHT + "px"

	let backups = []
	fetch(localStorage.board + '/backuplist')
		.then((response) => response.text())
		.then((data) => {
			for (let b of data.split("\n")) backups.push(b)
		})
}

/**@type {number}*/let tlTimerStart = 0

function confirmTlCreate() {
	tlConfirm.value = "Timelapse loading. Hang tight! ⏳"
	tlConfirm.style.pointerEvents = "none"
	tlTimerStart = Date.now()
	let tlTimerInterval = setInterval(updateTlTimer, 100)

	fetch(`https://${localStorage.server || DEFAULT_SERVER}/timelapse/`, {
			method: "POST",
			body: JSON.stringify({
				"backupStart": tlStartSel.value,
				"backupEnd": tlEndSel.value,
				"fps": Number(tlFps.value),
				"startX": 0,
				"startY": 0,
				"endX": WIDTH,
				"endY": HEIGHT,
				"reverse": tlPlayDir.getAttribute("reverse") == "true"
			}),
			headers: { 'Content-type': 'application/json; charset=UTF-8' }
		})
		.then(resp => resp.blob())
		.then(blob => {
			const url = window.URL.createObjectURL(blob)
			const a = document.createElement('a')
			a.style.display = 'none'
			a.href = url
			a.download = 'place_timelapse.gif'
			document.body.appendChild(a)
			a.click()
			tlConfirm.value = "Create"
			tlConfirm.style.pointerEvents = "auto"
			clearInterval(tlTimerInterval)
			tlTimer.innerText = "0.0s"
		})
		.catch((e) => {
			console.error("Timelapse failed, " + e)
			tlConfirm.value = "Create"
			tlConfirm.style.pointerEvents = "auto"
			clearInterval(tlTimerInterval)
			tlTimer.innerText = "0.0s"
		})
}
function updateTlTimer() {
	const elapsedTime = Date.now() - tlTimerStart
	tlTimer.innerText = ((elapsedTime / 1000).toFixed(3)) + "s"
}

const overlayInput = /**@type {HTMLInputElement}*/($("#overlayInput"));
const templateImage = /**@type {HTMLImageElement}*/($("#templateImage"));
/**
 * @typedef {Object} OverlayInfo
 * @property {number} x - The x-coordinate of the overlay.
 * @property {number} y - The y-coordinate of the overlay.
 * @property {number} w - The width of the overlay.
 * @property {number} h - The height of the overlay.
 * @property {number} opacity - The opacity level of the overlay (0 to 1).
 * @property {string} type - The type of the overlay.
 * @property {any} data - Additional data associated with the overlay.
 */
/**@type {OverlayInfo}*/var overlayInfo = { x: 0, y: 0, w: 0, h: 0, opacity: 0.8, type: "", data: null }
overlayInput.onchange = function() {
	if (!overlayInput.files || !overlayInput.files[0]) return
	templateImage.src = URL.createObjectURL(overlayInput.files[0])
	templateImage.style.opacity = "0.8"
}
async function generateOverlayUrl() {
	if (!overlayInput.files) {
		return;
	}

	overlayInfo["type"] = overlayInput.files[0].type
	overlayInfo["data"] = btoa(String.fromCharCode(...new Uint8Array(await overlayInput.files[0].arrayBuffer())))
	return `${location.origin}/?server=${localStorage.server || DEFAULT_SERVER}&board=${localStorage.board || DEFAULT_BOARD}&overlay=${btoa(JSON.stringify(overlayInfo))}`
}

let blockedUsers = localStorage.blocked?.split(",") || []
let targetedIntId = null
let targetedMsgId = null
export let currentReply = null
let openedChat = false

function openChatPanel() {
	chatPanel.setAttribute("open", "true")
	if (!openedChat) {
		openedChat = true
	}
	chatPanel.inert = false
}

function closeChatPanel() {
	messageInput.blur()
	messageInputEmojiPanel.removeAttribute("open")
	messageInputGifPanel.removeAttribute("open")
	chatPanel.removeAttribute("open")
	chatPanel.inert = true
}
closeChatPanel()

const chatContext = /**@type {HTMLElement}*/($("#chatContext"));
const userNote = /**@type {HTMLElement}*/($("#userNote"));
const mentionUser = /**@type {HTMLElement}*/($("#mentionUser"));
const replyUser = /**@type {HTMLElement}*/($("#replyUser"));
const blockUser = /**@type {HTMLElement}*/($("#blockUser"));
const changeMyName = /**@type {HTMLElement}*/($("#changeMyName"));

/**
 * @param {MouseEvent} e
 * @param {number} senderId
 * @param {any} msgId
 */
export async function onChatContext(e, senderId, msgId) {
	e.preventDefault();

	if (chatContext.style.display == "block") {
		chatContext.style.display = "none";
	}
	else {
		let msgName = intIdNames.get(senderId);
		const identifier = msgName || ("#" + senderId);
		if (msgName) {
			if (msgName[msgName.length - 1] === "~") {
				msgName = msgName.slice(0, -1);
				userNote.style.display = "block";
				userNote.textContent = "This user is likely impersonating @" + msgName;
			}
			else if (msgName[msgName.length - 1] === "✓") {
				msgName = msgName.slice(0, -1);
				userNote.style.display = "block";
				userNote.textContent = "This user is verified as @" + msgName;
			}
			else {
				userNote.style.display = "none";
			}
		}

		targetedMsgId = msgId;
		targetedIntId = senderId;
		chatContext.style.display = "block";
		mentionUser.children[0].textContent = `${await translate("mention")} ${identifier}`;
		replyUser.children[0].textContent = `${await translate("replyTo")} ${identifier}`;
		blockUser.children[0].textContent =
			`${await translate(blockedUsers.includes(senderId) ? "unblock" : "block")} ${identifier}`;

		// TODO: Do this in CSS instead
		const blockUserText = /**@type {HTMLElement}*/(blockUser.children[0]);
		if (senderId == intId) {
			blockUser.style.pointerEvents = "none";
			blockUserText.style.color = "grey";
			changeMyName.style.display = "";
		}
		else  {
			blockUser.style.pointerEvents = "all";
			blockUserText.style.color = "black";
			changeMyName.style.display = "none";
		}

		chatContext.style.left = e.pageX - chatPanel.offsetLeft + "px"
		chatContext.style.top = e.pageY - chatPanel.offsetTop + "px"
	}
}

const verifiedAppHash = "f255e4c294a5413cce887407b91062ac162faec4cb1e6e21cdd6e4492fb270f8"
async function checkVerifiedAppStatus() {
	const urlParams = new URLSearchParams(window.location.search);
	const verifyAppValue = urlParams.get("verify-app")
	if (!verifyAppValue) {
		return "none"
	}
	const hashedValue = await sha256(verifyAppValue)
	return hashedValue === verifiedAppHash ?  "valid" : "invalid"
}
/**
 * @param {string} str
 */
function sha256(str) {
	const encoder = new TextEncoder()
	const data = encoder.encode(str)
	return crypto.subtle.digest("SHA-256", data).then(hashBuffer => {
		const hashArray = Array.from(new Uint8Array(hashBuffer))
		return hashArray.map(byte => byte.toString(16).padStart(2, "0")).join("")
	})
}
checkVerifiedAppStatus().then(status => {
	if (status === "valid") {
		console.log("Successfully verified rplace.live app");
	}
	else {
		if (window.location !== window.parent.location
				|| typeof window.Android !== "undefined"
				|| typeof window.Kodular !== "undefined"
				|| status == "invalid") {
			window.location.replace("fakeapp.html")

			// Block interaction if page redirect was overidden
			document.body.style.opacity = "0.6"
			document.body.style.pointerEvents = "none"
			alert("Error: App failed verification - game is being accessed via an unofficial or unauthorised site or app\n" +
				"Please report to developers or visit the game online at https://rplace.live")
		}
	}
})

// Cancel context menu
window.addEventListener("contextmenu", function(e) {
	e.preventDefault()
})

// Cancel touchpad page zooming that interferes with canvas zooming
if (!mobile) {
	/**
	 * @param {{ preventDefault: () => void; }} e
	 */
	function cancelZoomGesture(e) {
		e.preventDefault()
	}
	window.addEventListener("wheel", function(e) {
		const targetElement = /**@type {HTMLElement}*/(e.target);
		if (e.target == mainContent || canvParent2.contains(targetElement)) {
			e.preventDefault()
		}
	}, { passive: false })
	window.addEventListener("gesturestart", cancelZoomGesture)
	window.addEventListener("gesturechange", cancelZoomGesture)
	window.addEventListener("gestureend", cancelZoomGesture)
}

// Server connection timeout message
setTimeout(() => {
	const connProblems = /**@type {HTMLElement}*/($("#connproblems"));
	if (connProblems) {
		connProblems.style.opacity = "1";
	}
}, 5000)

// Ads
const chatAd = /**@type {HTMLAnchorElement}*/($("#chatAd"));
if (localStorage.noad && Date.now() - localStorage.noad < 1.21e9) { // 14 days
	chatAd.style.display = "none"
}
else {
	let adI = Math.floor(Math.random() * ADS.length)
	function cycleAd() {
		const currentAd = ADS[adI % ADS.length]
		const langBanners = /**@type {Record<string, string>}*/(currentAd.banners);
		chatAd.style.setProperty("--adurl", `url(${langBanners[lang] || langBanners["en"]})`)
		chatAd.href = currentAd.url
		adI++
	}
	setInterval(cycleAd, 12e4) // 2 mins
	cycleAd()
}

// Final initialisation
translateAll();
showLoadingScreen();
wscapsule();