"use strict";
import { $, lerp, hash } from "../../shared.js";
import { CHAT_COLOURS, VIEWPORT_MODE } from "../../defaults.js";
import { BoardRenderer } from "./board-renderer.js";
import { enableWebglCanvas } from "./secret-settings.js";
import { runAudio } from "./game-audio.js";
import { AUDIOS } from "./game-defaults.js";
import { connectStatus, cooldownEndDate, HEIGHT, intIdNames, intIdPositions, WIDTH, wsCapsule } from "./game-state.js";
import { sendIpcMessage } from "shared-ipc";
import { showPalette } from "./palette.js";

const viewport = /**@type {HTMLElement}*/($("#viewport"));
const canvParent1 = /**@type {HTMLElement}*/($("#canvparent1"));
const canvParent2 = /**@type {HTMLElement}*/($("#canvparent2"));
const canvas = /**@type {HTMLCanvasElement}*/($("#canvas"));
const viewportCanvas = /**@type {HTMLCanvasElement}*/($("#viewportCanvas"));
const placeContext = /**@type {HTMLElement}*/($("#placeContext"));
const canvSelect = /**@type {HTMLElement}*/($("#canvselect"));
const placeChatMessages = /**@type {HTMLElement}*/($("#placeChatMessages"));
const positionIndicator = /**@type {import("./game-elements.js").PositionIndicator}*/($("#positionIndicator"));
const idPosition = /**@type {HTMLElement}*/($("#idPosition"));
const idPositionPlacer = /**@type {HTMLElement}*/($("#idPositionPlacer"));

// Essential board state
/**@type {import("../../defaults.js").VIEWPORT_MODE}*/ export let viewportMode = VIEWPORT_MODE.placePixels;
/**@type {BoardRenderer|null}*/ export let boardRenderer = null;
/**@type {CanvasRenderingContext2D|null}*/export let canvasCtx = canvas.getContext("2d");

// Initialise
if (enableWebglCanvas) {
	try {
		boardRenderer = new BoardRenderer(viewportCanvas);
		canvas.style.opacity = "0";			
	}
	catch (e) {
		console.error(e);
	}
}

// Essential positioning state
export let x = 0;
export let y = 0;
export let z = 0;
export let minZoom = 0;

// Touch & mouse canvas event handling
let moved = 3;
/**@type {Touch|null}*/let touch1 = null;
/**@type {Touch|null}*/let touch2 = null;
let touchMoveDistance = 15;

viewport.addEventListener("touchstart", function(/**@type {TouchEvent}*/ e) {
	if (!(e instanceof Event) || !e.isTrusted) {
		return;
	}

	e.preventDefault()
	for (let i = 0; i < e.changedTouches.length; i++) {
		const touch = e.changedTouches[i];
		if (!touch1) {
			touch1 = touch;
			touchMoveDistance = 15;
		}
		else if (!touch2) {
			touch2 = touch;
		}
		else {
			[touch1, touch2] = [touch2, touch];
		}
	}
});

viewport.addEventListener("touchend", function(/**@type {TouchEvent}*/ e) {
	if (!(e instanceof Event) || !e.isTrusted || !(e.target instanceof HTMLElement)) {
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
					if (!isCanvasDragRegion(e.target)) {
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
			target = target.parentElement;
		}

		// Handle click on target
		if (touchMoveDistance > 0 && target) {
			// NOTE: Any button within viewport that requires e.isTrusted to be true will cause a problem on
			// mobile due to mobile inputs emitting fake events - remember to bind use touchstart too when
			// trust is required
			target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		}
	}
	e.preventDefault();
});

viewport.addEventListener("touchmove", function(/**@type {TouchEvent}*/ e) {
	if (!(e instanceof Event) || !e.isTrusted || !(e.target instanceof HTMLElement)) {
		return;
	}

	for (let i = 0; i < e.changedTouches.length; i++) {
		const touch = e.changedTouches[i];
		if (!touch) {
			continue;
		}
		if (zoomAnim) {
			clearInterval(zoomAnim);
		}
		const touchTarget = /**@type {HTMLElement}*/(e.target);

		// Single touch move
		if (!touch2 && touch1 && touch1.identifier == touch.identifier) {
			touchMoveDistance -= Math.abs(touch.clientY - touch1.clientY) + Math.abs(touch.clientX - touch1.clientX)
			if (e.target != viewport && !canvParent2.contains(touchTarget)) {
				break
			}
			x -= (touch.clientX - touch1.clientX) / (z * 50)
			y -= (touch.clientY - touch1.clientY) / (z * 50)
			pos()
		}

		// Multi-touch move
		else if (touch1 && touch2) {
			if (e.target != viewport && !canvParent2.contains(touchTarget)) {
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

// Mouse input handling
let lastMouseMove = 0
let mouseDown = 0
let mx = 0
let my = 0

viewport.addEventListener("mousemove", function(/** @type {MouseEvent} */ e) {
	if (!(e instanceof Event) || !e.isTrusted || !(e.target instanceof HTMLElement)) {
		return;
	}
	if (!isCanvasDragRegion(e.target)) {
		return;
	}

	lastMouseMove = Date.now();
	moved--;
	let dx = -(mx - (mx = e.clientX - innerWidth / 2));
	let dy = -(my - (my = e.clientY - viewport.offsetHeight / 2));
	if (dx != dx || dy != dy) {
		return;
	}
	if (mouseDown) {
		x -= dx / (z * 50);
		y -= dy / (z * 50);
		pos();
		if (zoomAnim) {
			clearInterval(zoomAnim);
		}
	}
})

viewport.addEventListener("wheel", function(/**@type {WheelEvent}*/e) {
	if (!(e instanceof Event) || !e.isTrusted || !(e.target instanceof HTMLElement)) {
		return;
	}
	if (!isCanvasDragRegion(e.target)) {
		return
	}
	const d = Math.max(minZoom / z, Math.min(3 ** Math.max(-0.5, Math.min(0.5, e.deltaY * -0.01)), 1 / z));
	z *= d;
	x += mx * (d - 1) / z / 50;
	y += my * (d - 1) / z / 50;
	pos();
})

viewport.addEventListener("mousedown", function(/**@type {MouseEvent}*/ e) {
	if (!(e instanceof Event) || !e.isTrusted) {
		return;
	}

	moved = 3;
	mouseDown = e.button + 1;

	if (placeContext.style.display == "block") {
		placeContext.style.display = "none";
	}
});
viewport.addEventListener("mouseup", function(/**@type {MouseEvent}*/ e) {
	if (!(e instanceof Event) || !e.isTrusted || !(e.target instanceof HTMLElement)) {
		return;
	}

	if (!isCanvasDragRegion(e.target)) {
		moved = 3;
		mouseDown = 0;
		return;
	}

	if (moved > 0 && canvParent2.contains(e.target)) {
		clicked(e.clientX, e.clientY);
	}

	moved = 3;
	mouseDown = 0;
});

// Extra event handlers
viewport.addEventListener("contextmenu", function(e) {
	if (!(e instanceof Event) || !e.isTrusted || !(e.target instanceof HTMLElement)) {
		return;
	}

	placeContext.style.display = "block";
	const { x, y } = screenToCanvas(e.clientX, e.clientY);
	setPlaceContextPosition(x, y);
});

// Miscellaneous positioning handling
/**@type {Timer|null}*/let zoomAnim = null

/**
 * @param {number} clientX
 * @param {number} clientY
 */
function clicked(clientX, clientY) {
	if (zoomAnim) {
		clearInterval(zoomAnim);
	}

	clientX = Math.floor(x + (clientX - innerWidth / 2) / z / 50) + 0.5;
	clientY = Math.floor(y + (clientY - viewport.offsetHeight / 2) / z / 50) + 0.5;
	if (clientX == Math.floor(x) + 0.5 && clientY == Math.floor(y) + 0.5) {
		clientX -= 0.5;
		clientY -= 0.5;
		if ((cooldownEndDate ?? 0) < Date.now()) {
			zoomIn();
			showPalette();
		}
		else {
			runAudio(AUDIOS.invalid);
		}
		return;
	}
	runAudio((cooldownEndDate ?? 0) > Date.now() ? AUDIOS.invalid : AUDIOS.highlight);
	zoomAnim = setInterval(function() {
		x += (clientX - x) / 10;
		y += (clientY - y) / 10;
		pos();

		if (zoomAnim && Math.abs(clientX - x) + Math.abs(clientY - y) < 0.1) {
			clearInterval(zoomAnim);
		}
	}, 15);
}

function transform() {
	const scale = z * 50;
	const translateX = x * z * -50;
	const translateY = y * z * -50;
	const width = z * canvas.width * 50;
	const height = z * canvas.height * 50;

	canvParent1.style.transform = `translate(${translateX + innerWidth / 2}px, ${translateY + viewport.offsetHeight / 2}px) scale(${scale})`;
	canvParent2.style.transform = canvParent1.style.transform;
	canvSelect.style.transform = `translate(${Math.floor(x)}px, ${Math.floor(y)}px) scale(0.01)`;
	placeChatMessages.style.transform = `translate(${translateX + innerWidth / 2}px, ${translateY + viewport.offsetHeight / 2}px) scale(${z * 5})`; 
	canvas.style.width = `${width}px`;
	canvas.style.height = `${height}px`;
	canvas.style.transform = `translate(${translateX}px, ${translateY}px)`;
	canvas.style.imageRendering = z < 1 / 50 / devicePixelRatio ? "initial" : "";
}

/**
 * @param {HTMLElement} element
 */
function isCanvasDragRegion(element) {
	return (element === viewport
		|| canvParent2.contains(element)
		|| placeChatMessages.contains(element));
}

/**
 * @param {number} clientX
 * @param {number} clientY
 * @returns {{ x: number, y: number }}
 */
function screenToCanvas(clientX, clientY) {
	const scale = z * 50;
	const translateX = x * z * -50;
	const translateY = y * z * -50;

	const canvasX = (clientX - innerWidth / 2 - translateX) / scale;
	const canvasY = (clientY - viewport.offsetHeight / 2 - translateY) / scale;

	return { x: canvasX, y: canvasY };
}

/**
 * @param {HTMLElement} element
 * @param {number} px 
 * @param {number} py 
 * @param {number} z 
 */
function setCanvasAttachmentPosition(element, px, py, z) {
	const scale = z * 50;
	const translateX = x * z * -50;
	const translateY = y * z * -50;
	const screenX = (px * scale) + translateX + viewport.offsetWidth / 2;
	const screenY = (py * scale) + translateY + viewport.offsetHeight / 2;
	element.style.left = `${screenX}px`;
	element.style.top = `${screenY}px`;
}
/**
 * @param {number} canvX 
 * @param {number} canvY 
 */
function setPlaceContextPosition(canvX, canvY) {
	if (placeContext.style.display === "block") {
		placeContext.dataset.x = String(canvX);
		placeContext.dataset.y = String(canvY);
		setCanvasAttachmentPosition(placeContext, canvX, canvY, z);
	}
}
/**
 * @param {HTMLElement} element 
 * @param {number} posX 
 * @param {number} posY 
 */
export function setPlaceChatPosition(element, posX, posY) {
	element.style.left = `${posX * 10}px`;
	element.style.top = `${posY * 10}px`;
}

/**@type {boolean}*/let idPositionDebounce = false;
/**@type {Timer|null}*/let idPositionTimeout = null;
/**@type {number}*/let lastIntX = Math.floor(x);
/**@type {number}*/let lastIntY = Math.floor(y);

/**
 * @param {number} newX 
 * @param {number} newY 
 * @param {number} newZ 
 */
export function pos(newX=x, newY=y, newZ=z) {
	newX = x = Math.max(Math.min(newX, WIDTH - 1), 0);
	newY = y = Math.max(Math.min(newY, HEIGHT - 1), 0);
	newZ = z = Math.min(Math.max(newZ, minZoom), 1);

	const right = newX - canvas.width + 0.01;
	const left = newX;
	const up = newY - canvas.height + 0.01;
	const down = newY;

	if (right >= left) {
		newX = 0;
	}
	else if (right > 0) {
		newX -= right;
	}
	else if (left < 0) {
		newX -= left;
	}
	if (up >= down) {
		newY = 0;
	}
	else if (up > 0) {
		newY -= up;
	}
	else if (down < 0) {
		newY -= down;
	}
	localStorage.x = Math.floor(newX) + 0.5;
	localStorage.y = Math.floor(newY) + 0.5;
	localStorage.z = newZ;
	transform();
	boardRenderer?.setPosition(x, y, z);

	// Place context
	const canvX = Number(placeContext.dataset.x);
	const canvY = Number(placeContext.dataset.y);
	setPlaceContextPosition(canvX, canvY);

	// Update position indicator
	if (positionIndicator.setPosition) {
		positionIndicator.setPosition(x, y, z);
	}

	// Placer info
	const intX = Math.floor(newX), intY = Math.floor(newY);
	if (intX != lastIntX || intY != lastIntY) {
		if (idPositionTimeout) {
			clearTimeout(idPositionTimeout);
		}
		idPosition.style.display = "none";
		idPositionDebounce = false;
	}
	lastIntX = intX;
	lastIntY = intY;

	if (!idPositionDebounce) {
		idPositionDebounce = true;

		idPositionTimeout = setTimeout(() => {
			idPositionDebounce = false;
			let id = intIdPositions.get(intX + intY * WIDTH);
			if (id === undefined || id === null) {
				// Request 15x15 region of pixel placers from server (fine tune if necessary)
				const placersRadius = 15;
				const centreX = Math.floor(Math.max(intX - placersRadius / 2, 0));
				const centreY = Math.floor(Math.max(intY - placersRadius / 2, 0));
				const width = Math.min(placersRadius, WIDTH - intX);
				const height = Math.min(placersRadius, HEIGHT - intY);
				const position = centreX + centreY * WIDTH;

				if (connectStatus === "connected") {
					sendIpcMessage(wsCapsule, "requestPixelPlacers", { position, width, height });
				}
				return;
			}

			idPosition.style.display = "flex";
			setPlaceChatPosition(idPosition, intX, intY);
			/** @type {HTMLElement} */idPositionPlacer.style.color = CHAT_COLOURS[hash("" + id) & 7];
			idPositionPlacer.textContent = intIdNames.get(id) || ("#" + id);
		}, 1000);
	}
}

export function zoomIn() {
	if (z >= 0.4) {
		return
	}
	if (zoomAnim) {
		clearInterval(zoomAnim)
	}
	let dz = 0.005
	zoomAnim = setInterval(function() {
		if (dz < 0.2) dz *= 1.1
		z *= 1 + dz
		pos()
		if (zoomAnim && z >= 0.4) {
			clearInterval(zoomAnim)
		}
	}, 15)
}

export function moveTo(newX = x, newY = y, newZ = z, durationMs = 300) {
	const startX = x;
	const startY = y;
	const startZ = z;
	const startTime = Date.now();

	const easeFunc = setInterval(() => {
		const elapsed = Date.now() - startTime;
		let t = elapsed / durationMs;
		if (t >= 1) {
			t = 1;
		}

		const currentX = lerp(startX, newX, t);
		const currentY = lerp(startY, newY, t);
		const currentZ = lerp(startZ, newZ, t);
		pos(currentX, currentY, currentZ);

		if (t >= 1) {
			clearInterval(easeFunc);
			x = newX;
			y = newY;
			z = newZ;
		}
	}, 16);
}

/**
 * @param {number} value
 */
export function setMinZoom(value) {
	minZoom = value;
	pos();
}

/**
 * @param {number} value 
 */
export function setX(value) {
	x = value;
}

/**
 * @param {number} value 
 */
export function setY(value) {
	y = value;
}

/**
 * @param {number} value 
 */
export function setZ(value) {
	z = value;
}

/**
 * @param {import("../../defaults.js").VIEWPORT_MODE} mode 
 */
export function setViewportMode(mode) {
	viewportMode = mode;
}