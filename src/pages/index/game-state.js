"use strict";
import { DEFAULT_BOARD, DEFAULT_COOLDOWN, DEFAULT_HEIGHT, DEFAULT_PALETTE, DEFAULT_PALETTE_USABLE_REGION, DEFAULT_SERVER, DEFAULT_WIDTH, PLACEMENT_MODE } from "../../defaults";
import { addIpcMessageHandler, handleIpcMessage, sendIpcMessage } from "shared-ipc";

// Types
/**
 * @typedef {Object} LiveChatMessage
 * @property {number} messageId
 * @property {string} content
 * @property {number} senderIntId
 * @property {string} senderChatName
 * @property {number} sendDate
 * @property {Map<string, Set<number>>} reactions
 * @property {string} channel
 * @property {number|null} repliesTo
 */
/**
 * @typedef {Object} PlaceChatMessage
 * @property {number} positionIndex
 * @property {string} content
 * @property {number} senderIntId
 * @property {string} senderChatName
 */
/**
 * @typedef {Object} ChatInfo
 * @property {"live"|"place"} type
 * @property {LiveChatMessage|PlaceChatMessage} message
 * @property {string} [channel] - Only present for live chat
 */
/**
 * @typedef {Object} LiveChatHistoryInfo
 * @property {number} fromMessageId
 * @property {number} count
 * @property {boolean} before
 * @property {string} channel
 * @property {LiveChatMessage[]} messages
 */
/**
 * @typedef {Object} ModerationInfo
 * @property {number} state - The punishment state (mute/ban)
 * @property {number} startDate - Timestamp in milliseconds
 * @property {number} endDate - Timestamp in milliseconds
 * @property {string} reason - Reason for punishment
 * @property {string} appeal - Appeal status text
 */

// Readonly WS-derived state
// Composited board with changes and socket pixels
/**@type {Uint8Array|null}*/export let BOARD = null;
// Raw board, changes and socket pixels layers
/**@type {Uint8Array|null}*/export let CHANGES = null;
/**@type {Uint8Array|null}*/export let RAW_BOARD = null;
/**@type {Uint8Array|null}*/export let SOCKET_PIXELS = null;
export let PALETTE_USABLE_REGION = DEFAULT_PALETTE_USABLE_REGION;
export let PALETTE = DEFAULT_PALETTE;
export let WIDTH = DEFAULT_WIDTH;
export let HEIGHT = DEFAULT_HEIGHT;
export let COOLDOWN = DEFAULT_COOLDOWN;

// Additional WS-derived state
/**@type {Map<number, string>}*/export const intIdNames = new Map(); // intId : name
/**@type {Map<number, number>}*/export let intIdPositions = new Map(); // position : intId
/**@type {any|null}*/export let account = null;
/**@type {number|null}*/export let intId = null;
/**@type {string|null}*/export let chatName = null;
/**@type {"connecting"|"connected"|"disconnected"}*/export let connectStatus = "connecting";
/**@type {boolean}*/export let canvasLocked = false;
/**@type {PLACEMENT_MODE}*/export let placementMode = PLACEMENT_MODE.selectPixel;
/**@type {Set<number>}*/export const spectators = new Set(); // Spectator int Id
/**@type {number|null}*/export let spectatingIntId = null;

// Miscellaneous require global state
// Unix date for cooldown end (null = indefinite)
/**@type {number|null}*/export let cooldownEndDate = null;
// Simple boolean interface for if currently on cooldown
/**@type {boolean}*/export let onCooldown = false;
// We don't await this yet, when the changes (old server) / canvas width & height (new server) packet
// comes through, it will await this unawaited state until it is fulfilled, so we are sure we have all the data
/**@type {Promise<ArrayBuffer|null>}*/export let preloadedBoard = fetchBoard();
/**@type {number}*/let fetchCooldown = 50;
/**@type {Timer|null}*/let fetchFailTimeout = null;

// WsCapsule logic & wscapsule message handlers
const httpServerUrl = (localStorage.server || DEFAULT_SERVER)
	.replace("wss://", "https://").replace("ws://", "http://");
// TODO: Find a better cache invalidation strategy for game worker
const res = await fetch(`${httpServerUrl}/public/game-worker.js?v=${Date.now()}`);
const code = await res.text();
const blob = new Blob([code], { type: "application/javascript" });
const url = URL.createObjectURL(blob);
export const wsCapsule = new Worker(url, {
	type: "module"
});
wsCapsule.addEventListener("message", handleIpcMessage);
window.addEventListener("beforeunload", (e) => {
	console.log("Stopping wsCapsule...")
	sendIpcMessage(wsCapsule, "stop");
});
// Undefine global objects
const injectedCjs = document.createElement("script");
injectedCjs.innerHTML = `
	delete WebSocket;
	delete Worker;
	Object.defineProperty(window, "eval", {
		value: function() { throw new Error() },
		writable: false,
		configurable: false
	});
`;
document.body.appendChild(injectedCjs);

const automated = navigator.webdriver;
function handleConnect() {
	connectStatus = "connected";
	if (automated) {
		// TODO: Flesh out and make more internal to wscapsule
		const activityObj = {
			windowOuterWidth: window.outerWidth,
			windowInnerWidth: window.innerWidth,
			windowOuterHeight: window.outerHeight,
			windowInnerHeight: window.innerHeight,
			localStorage: { ...localStorage }
		};
		sendIpcMessage(wsCapsule, "informAutomatedActivity", activityObj);
	}
}
addIpcMessageHandler("handleConnect", handleConnect);
/**
 * 
 * @param {{ palette: number[], paletteUsableRegion: { start: number, end: number } }} param 
 */
function handlePalette({ palette, paletteUsableRegion }) {
	PALETTE = palette;
	PALETTE_USABLE_REGION.start = paletteUsableRegion.start;
	PALETTE_USABLE_REGION.end = paletteUsableRegion.end;

	const paletteEvent = new CustomEvent("palette", {
		detail: { palette, paletteUsableRegion },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(paletteEvent);
}
addIpcMessageHandler("handlePalette", handlePalette);
/**
 * Used by both legacy & RplaceServer
 * @param {{ endDate: Date, cooldown: number }} param 
 */
function handleCooldownInfo({ endDate, cooldown }) {
	setCooldown(endDate.getTime());
	COOLDOWN = cooldown;

	const cooldownEvent = new CustomEvent("cooldown", {
		detail: { endDate, cooldown },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(cooldownEvent);
}
addIpcMessageHandler("handleCooldownInfo", handleCooldownInfo);
/**
 * Used by RplaceServer
 * @param {{ width: number, height: number }} param 
 */
async function handleCanvasInfo({ width, height }) {
	setSize(width, height);

	const board = await preloadedBoard;
	if (!board) {
		throw new Error("Couldn't handle canvas info: Preloaded board was null");
	}

	const dataArr = new Uint8Array(board);
	BOARD = new Uint8Array(length);
	let boardI = 0;
	let colour = 0;

	for (let i = 0; i < board.byteLength; i++) {
		// Then it is a palette value
		if (i % 2 == 0) {
			colour = dataArr[i];
			continue;
		}
		// After colour, loop until we unpack all repeats, byte can only hold max 255,
		// so we add one to repeated data[i], and treat it as if 0 = 1 (+1)
		for (let j = 0; j < dataArr[i] + 1; j++) {
			BOARD[boardI] = colour;
			boardI++;
		}
	}

	const boardLoadedEvent = new CustomEvent("boardloaded", {
		detail: {},
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(boardLoadedEvent);
}
addIpcMessageHandler("handleCanvasInfo", handleCanvasInfo);
/**
 * Used by legacy server
 * @param {{ width: number, height: number, changes: ArrayBuffer }} param
 */
async function handleChanges({ width, height, changes }) {
	if (width != WIDTH || height != HEIGHT) {
		setSize(width, height);
	}

	const board = await preloadedBoard;
	if (!board) {
		throw new Error("Couldn't handle changes: Preloaded board was null");
	}

	RAW_BOARD = new Uint8Array(board);
	BOARD = new Uint8Array(RAW_BOARD);
	CHANGES = new Uint8Array(width * height).fill(255);
	SOCKET_PIXELS = new Uint8Array(width * height).fill(255);

	let i = 0;
	let boardI = 0;
	const view = new DataView(changes);
	while (i < changes.byteLength) {
		let cell = view.getUint8(i++);
		let c = cell >> 6;
		if (c == 1) c = view.getUint8(i++);
		else if (c == 2) c = view.getUint16(i++), i++;
		else if (c == 3) c = view.getUint32(i++), i += 3;
		boardI += c;

		// Update both the working board and mark changes
		BOARD[boardI] = cell & 63;
		CHANGES[boardI] = cell & 63;
		boardI++;
	}

	const boardLoadedEvent = new CustomEvent("boardloaded", {
		detail: {},
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(boardLoadedEvent);
}
addIpcMessageHandler("handleChanges", handleChanges);
/**
 * @param {number} count 
 */
function setOnline(count) {
	const onlineEvent = new CustomEvent("online", {
		detail: { count },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(onlineEvent);
}
addIpcMessageHandler("setOnline", setOnline);
/**
 * @param {{ position: number, width: number, height: number, region: ArrayBuffer }} param
 */
function handlePlacerInfoRegion({ position, width, height, region }) {
	const regionView = new DataView(region);
	let i = position;
	let regionI = 0;
	while (regionI < region.byteLength) {
		for (let xi = i; xi < i + width; xi++) {
			const placerIntId = regionView.getUint32(regionI);
			if (placerIntId !== 0xFFFFFFFF) {
				intIdPositions.set(xi, placerIntId);
			}
			regionI += 4;
		}
		i += WIDTH;
	}

	const placerInfoEvent = new CustomEvent("placerinfo", {
		detail: { intIdPositions },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(placerInfoEvent);
}
addIpcMessageHandler("handlePlacerInfoRegion", handlePlacerInfoRegion);
/**
 * @param {number} newIntId 
 */
function handleSetIntId(newIntId) {
	intId = newIntId;

	const intIdEvent = new CustomEvent("intid", {
		detail: { intId },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(intIdEvent);
}
addIpcMessageHandler("handleSetIntId", handleSetIntId);
/**
 * @param {{ locked: boolean, reason: string|null }} params 
 */
function handleSetCanvasLocked({ locked, reason }) {
	canvasLocked = locked;

	const canvasLockedEvent = new CustomEvent("canvaslocked", {
		detail: { locked, reason },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(canvasLockedEvent);
}
addIpcMessageHandler("setCanvasLocked", handleSetCanvasLocked);
/**
 * @param {{ position: number, colour: number, placer:number|undefined }[]} pixels 
 */
function handlePixels(pixels) {
	for (const pixel of pixels) {
		setPixelI(pixel.position, pixel.colour);

		if (pixel.placer) {
			// Update positions cache
			intIdPositions.set(pixel.position, pixel.placer);

			// Spectate
			if (pixel.placer === spectatingIntId) {
				const spectatedPixelEvent = new CustomEvent("spectatedpixel", {
					detail: { position: pixel.position, colour: pixel.colour, placer: pixel.placer },
					bubbles: true,
					composed: true
				});
				window.dispatchEvent(spectatedPixelEvent);
			}
		}
	}

	const pixelsEvent = new CustomEvent("pixels", {
		detail: { pixels },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(pixelsEvent);
}
addIpcMessageHandler("handlePixels", handlePixels);
/**
 * @param {{ endDate: Date, position: number, colour: number }} param 
 */
function handleRejectedPixel({ endDate, position, colour }) {
	setCooldown(endDate.getTime());
	setPixelI(position, colour);

	const x = position % WIDTH;
	const y = Math.floor(position / WIDTH);
	const pixelsEvent = new CustomEvent("rejectedpixel", {
		detail: { position, x, y, colour, cooldownEndDate: endDate },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(pixelsEvent);
}
addIpcMessageHandler("handleRejectedPixel", handleRejectedPixel);
/**
 * @param {{ endDate: Date }} param0 
 */
function handleCooldown({ endDate }) {
	setCooldown(endDate.getTime());
}
addIpcMessageHandler("handleCooldown", handleCooldown);
/**
 * @param {string} name 
 */
function setChatName(name) {
	chatName = name;

	const chatNameEvent = new CustomEvent("chatname", {
		detail: { chatName },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(chatNameEvent);
}
addIpcMessageHandler("setChatName", setChatName);
/**
 * @param {Map<number, string>} newIntIdNames 
 */
function handleNameInfo(newIntIdNames) {
	for (const [ key, value ] of newIntIdNames.entries()) {
		intIdNames.set(key, value);
	}
}
addIpcMessageHandler("handleNameInfo", handleNameInfo);
/**
 * @param {{ message: LiveChatMessage, channel: string }} param
 */
function addLiveChatMessage({ message, channel }) {
	const liveChatMessageEvent = new CustomEvent("livechatmessage", {
		detail: { message, channel },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(liveChatMessageEvent);
}
addIpcMessageHandler("addLiveChatMessage", addLiveChatMessage);
/**
 * @param {PlaceChatMessage} message
 */
function addPlaceChatMessage(message) {
	const placeChatMessageEvent = new CustomEvent("placechatmessage", {
		detail: { message },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(placeChatMessageEvent);
}
addIpcMessageHandler("addPlaceChatMessage", addPlaceChatMessage);
/**
 * @param {number} messageId 
 */
function handleLiveChatDelete(messageId) {
	const liveChatDeleteEvent = new CustomEvent("livechatdelete", {
		detail: { messageId },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(liveChatDeleteEvent);
}
addIpcMessageHandler("handleLiveChatDelete", handleLiveChatDelete);
/**
 * @param {{ messageId: number, reactorId: number, reactionKey: string }} params
 */
function handleLiveChatReaction({ messageId, reactorId, reactionKey }) {
	const liveChatReactionEvent = new CustomEvent("livechatreaction", {
		detail: { messageId, reactorId, reactionKey },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(liveChatReactionEvent);
}
addIpcMessageHandler("handleLiveChatReaction", handleLiveChatReaction);
/**
 * @param {ModerationInfo} info
 */
function applyPunishment(info) {
	const punishmentEvent = new CustomEvent("punishment", {
		detail: info,
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(punishmentEvent);
}
addIpcMessageHandler("applyPunishment", applyPunishment);
/**
 * @param {{code: number, reason: string }} param 
 */
function handleDisconnect({ code, reason }) {
	localStorage.lastDisconnect = Date.now();
	connectStatus = "disconnected";
	setCooldown(null);
	wsCapsule.terminate();

	const disconnectEvent = new CustomEvent("disconnect", {
		detail: { code, reason },
		composed: true,
		bubbles: true
	});
	window.dispatchEvent(disconnectEvent);
}
addIpcMessageHandler("handleDisconnect", handleDisconnect);
/**
 * @param {{ source: string, input: string }} param0 
 */
async function handleChallenge({ source, input }) {
	const result = await Object.getPrototypeOf(async function () { })
		.constructor(source)(input);
	sendIpcMessage(wsCapsule, "sendChallengeResult", result);
}
addIpcMessageHandler("handleChallenge", handleChallenge);
/**
 * @param {number} userIntId
 */
function handleSpectating(userIntId) {
	spectatingIntId = userIntId;

	const spectatingEvent = new CustomEvent("spectating", {
		detail: { userIntId },
		composed: true,
		bubbles: true
	});
	window.dispatchEvent(spectatingEvent);
}
addIpcMessageHandler("handleSpectating", handleSpectating);
/**
 * @param {{ userIntId: number, reason:string }} arg0 
 */
function handleUnspectating({ userIntId, reason }) {
	if (spectatingIntId === userIntId) {
		spectatingIntId = null;
	}

	const unspectatingEvent = new CustomEvent("unspectating", {
		detail: { userIntId, reason },
		composed: true,
		bubbles: true
	});
	window.dispatchEvent(unspectatingEvent);
}
addIpcMessageHandler("handleUnspectating", handleUnspectating);
/**
 * @param {number} spectatorIntId
 */
function handleSpectated(spectatorIntId) {
	spectators.add(spectatorIntId);
}
addIpcMessageHandler("handleSpectated", handleSpectated);
/**
 * @param {number} spectatorIntId
 */
function handleUnspectated(spectatorIntId) {
	spectators.delete(spectatorIntId);
}
addIpcMessageHandler("handleUnspectated", handleUnspectated);

export async function fetchBoard() {
	// Override browser cache with ?v= param, may incur longer loading times
	// TODO: investigate optimisations to only do a hard reload when necessary
	const response = await fetch((localStorage.board || DEFAULT_BOARD) + "?v=" + Date.now())
	if (!response.ok) {
		const fetchBoardFailEvent = new CustomEvent("fetchboardfail", {
			detail: { type: "badresponse" },
			bubbles: true,
			composed: true
		});
		window.dispatchEvent(fetchBoardFailEvent);

		fetchFailTimeout = setTimeout(fetchBoard, fetchCooldown *= 2);
		if (fetchCooldown > 8000) {
			clearTimeout(fetchFailTimeout);

			const fetchBoardFailEvent = new CustomEvent("fetchboardfail", {
				detail: { type: "timeout" },
				bubbles: true,
				composed: true
			});
			window.dispatchEvent(fetchBoardFailEvent);
		}
		return null;
	}

	if (fetchFailTimeout) {
		clearTimeout(fetchFailTimeout);
	}

	return await response.arrayBuffer();
}

/**
 * @param {number} width 
 * @param {number} height 
 */
export function setSize(width, height) {
	WIDTH = width;
	HEIGHT = height;
	BOARD = new Uint8Array(width * height).fill(255);

	const sizeEvent = new CustomEvent("size", {
		detail: { width, height },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(sizeEvent);
}

// Tracking timer that will update onCooldown and placeButton on completion
/**@type {Timer|null}*/let cooldownTimeout = null;
/**
 * @param {number|null} endDate 
 */
export function setCooldown(endDate) {
	if (cooldownTimeout !== null) {
		clearTimeout(cooldownTimeout);
		cooldownTimeout = null; // Ensure stale timeout state is cleared
	}
	
	cooldownEndDate = endDate;
	const now = Date.now();

	if (endDate !== null) {
		if (endDate > now) {
			// If endDate in future, on cooldown & schedule timeout
			onCooldown = true;

			cooldownTimeout = setTimeout(() => {
				// Scheduled logic for when cooldown expires
				onCooldown = false;
				const cooldownEndEvent = new CustomEvent("cooldownend", { detail: { endDate, onCooldown } });
				window.dispatchEvent(cooldownEndEvent);
			}, endDate - now);
		}
		else {
			// If endDate is in past, then fast track to off cooldown
			onCooldown = false;
		}
	}
	else {
		// If endDate is null, then we assume indefinite cooldown
		onCooldown = true;
	}

	const cooldownStartEvent = new CustomEvent("cooldownstart", { detail: { endDate, onCooldown } });
	window.dispatchEvent(cooldownStartEvent);
}

/**
 * @param {number} x
 * @param {number} y
 * @param { number} colour
 */
export function setPixel(x, y, colour) {
	const index = x % WIDTH + (y % HEIGHT) * WIDTH;
	setPixelI(index, colour);
}

/**
 * @param {number} index
 * @param {number} colour
 */
export function setPixelI(index, colour) {
	if (!BOARD || !SOCKET_PIXELS) {
		console.error("Could not set pixel: Board or socket pixels was null");
		return;
	}

	BOARD[index] = colour;
	SOCKET_PIXELS[index] = colour;
}