"use strict";
import { DEFAULT_BOARD, DEFAULT_COOLDOWN, DEFAULT_HEIGHT, DEFAULT_PALETTE, DEFAULT_PALETTE_USABLE_REGION, DEFAULT_SERVER, DEFAULT_WIDTH, PLACEMENT_MODE } from "../../defaults";
import { addIpcMessageHandler, handleIpcMessage, makeIpcRequest, sendIpcMessage } from "shared-ipc";

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
/**@type {"initial"|"connecting"|"connected"|"disconnected"}*/export let connectStatus = "initial";
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
const wsCapsule = new Worker(url, {
	type: "module"
});
wsCapsule.addEventListener("message", handleIpcMessage);
window.addEventListener("beforeunload", (e) => {
	console.log("Stopping wsCapsule...")
	sendIpcMessage(wsCapsule, "stop");
});
// Undefine global objects
const undefineGlobals = new CustomEvent("undefineglobals");
window.dispatchEvent(undefineGlobals);
const automated = !!(
	window.navigator.webdriver ||
	// @ts-ignore Browser specifics
	window.chrome?.runtime?.onConnect ||
	window.outerHeight === 0 ||
	// @ts-ignore Browser specifics
	navigator?.plugins?.length === 0 ||
	/HeadlessChrome/.test(navigator.userAgent)
);

addIpcMessageHandler("handleConnect", () => {
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
});
addIpcMessageHandler("handlePalette", (/**@type {[number[],number,number]}*/[palette, start, end]) => {
	PALETTE = palette;
	PALETTE_USABLE_REGION.start = start;
	PALETTE_USABLE_REGION.end = end;

	const paletteEvent = new CustomEvent("palette", {
		detail: { palette, usableRegion: { start: start, end: end } },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(paletteEvent);

});
addIpcMessageHandler("handleCooldownInfo", /**@type {[Date, number]}*/([endDate, cooldown]) => {
	setCooldown(endDate.getTime());
	COOLDOWN = cooldown;

	const cooldownEvent = new CustomEvent("cooldown", {
		detail: { endDate, cooldown },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(cooldownEvent);
});
addIpcMessageHandler("handleCanvasInfo", async (/**@type {[number,number]}*/[width, height]) => {
	// Used by RplaceServer
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
});
addIpcMessageHandler("handleChanges", async (/**@type {[number,number,ArrayBuffer]}*/[width, height, changes]) => {
	// Used by legacy server
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
});
addIpcMessageHandler("setOnline", (/**@type {number}*/count) => {
	const onlineEvent = new CustomEvent("online", {
		detail: { count },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(onlineEvent);
});
addIpcMessageHandler("handlePlacerInfoRegion", (/**@type {[number,number,Number,ArrayBuffer]}*/[position, width, height, region]) => {
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
});
addIpcMessageHandler("handleSetIntId", (/**@type {number}*/userIntId) => {
	intId = userIntId;

	const intIdEvent = new CustomEvent("intid", {
		detail: { intId },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(intIdEvent);
});
addIpcMessageHandler("setCanvasLocked", (/**@type {[boolean, string|null]}*/[locked, reason]) => {
	canvasLocked = locked;

	const canvasLockedEvent = new CustomEvent("canvaslocked", {
		detail: { locked, reason },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(canvasLockedEvent);
});
addIpcMessageHandler("handlePixels", (/**@type {{position:number,colour:number,placer:number|undefined}[]}*/pixels) => {
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
});
addIpcMessageHandler("handleRejectedPixel", (/**@type {[Date,Number,number]}*/[endDate, position, colour]) => {
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
});
addIpcMessageHandler("handleCooldown", (/**@type {Date}*/endDate) => {
	setCooldown(endDate.getTime());
});
addIpcMessageHandler("setChatName", (/**@type {string}*/name) => {
	chatName = name;

	const chatNameEvent = new CustomEvent("chatname", {
		detail: { chatName },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(chatNameEvent);
});
addIpcMessageHandler("handleNameInfo", (/**@type {Map<number, string>}*/newIntIdNames) => {
	for (const [ key, value ] of newIntIdNames.entries()) {
		intIdNames.set(key, value);
	}
});
addIpcMessageHandler("addLiveChatMessage", (/**@type {[LiveChatMessage,string]}*/[message, channel]) => {
	const liveChatMessageEvent = new CustomEvent("livechatmessage", {
		detail: { message, channel },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(liveChatMessageEvent);
});
addIpcMessageHandler("addPlaceChatMessage", (/**@type {PlaceChatMessage}*/message) => {
	const placeChatMessageEvent = new CustomEvent("placechatmessage", {
		detail: { message },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(placeChatMessageEvent);
});
addIpcMessageHandler("handleLiveChatDelete", (/**@type {number}*/messageId) => {
	const liveChatDeleteEvent = new CustomEvent("livechatdelete", {
		detail: { messageId },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(liveChatDeleteEvent);
});
addIpcMessageHandler("handleLiveChatReaction", (/**@type {[number,number,string]}*/[messageId, reactorId, reactionKey]) => {
	const liveChatReactionEvent = new CustomEvent("livechatreaction", {
		detail: { messageId, reactorId, reactionKey },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(liveChatReactionEvent);
});
addIpcMessageHandler("applyPunishment", (/**@type {ModerationInfo}*/info) => {
	const punishmentEvent = new CustomEvent("punishment", {
		detail: info,
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(punishmentEvent);
});
addIpcMessageHandler("handleChallenge", async (/**@type {[string,string]}*/[source, input]) => {
	const result = await Object.getPrototypeOf(async function () { })
		.constructor(source)(input);
	sendIpcMessage(wsCapsule, "sendChallengeResult", result);
});
addIpcMessageHandler("handleSpectating", (/**@type {number}*/userIntId) => {
	spectatingIntId = userIntId;

	const spectatingEvent = new CustomEvent("spectating", {
		detail: { userIntId },
		composed: true,
		bubbles: true
	});
	window.dispatchEvent(spectatingEvent);
});
addIpcMessageHandler("handleUnspectating", (/**@type {[number, string]}*/[ userIntId, reason ]) => {
	if (spectatingIntId === userIntId) {
		spectatingIntId = null;
	}

	const unspectatingEvent = new CustomEvent("unspectating", {
		detail: { userIntId, reason },
		composed: true,
		bubbles: true
	});
	window.dispatchEvent(unspectatingEvent);
});
addIpcMessageHandler("handleSpectated", (/**@type {number}*/spectatorIntId) => {
	spectators.add(spectatorIntId);
});
addIpcMessageHandler("handleUnspectated", (/**@type {number}*/spectatorIntId) => {
	spectators.delete(spectatorIntId);
});
addIpcMessageHandler("handleDisconnect", (/**@type {[number, string]}*/[code, reason]) => {
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
});

/**
 * @param {string} device 
 * @param {string} server 
 * @param {string} [vip] 
 */
export function connect(device, server = DEFAULT_SERVER, vip = undefined) {
	if (connectStatus !== "initial" && connectStatus !== "disconnected") {
		return;
	}

	sendIpcMessage(wsCapsule, "connect", {
		device,
		server,
		vip
	});
	connectStatus = "connecting";
}

/**
 * @param {string} name
 * @param {any} [args]
 * @param {Event} [event] 
 */
export function sendServerMessage(name, args=undefined, event=undefined) {
	const trustedMethods = [ "putPixel", "sendLiveChatMsg", "sendPlaceChatMsg" ]
	if (trustedMethods.includes(name) && (!(event instanceof Event) || !event?.isTrusted)) {
		throw new Error("Trusted method event was invalid");
	}

	sendIpcMessage(wsCapsule, name, args);
}

/**
 * @param {string} call
 * @param {any} [args]
 */
export async function makeServerRequest(call, args=undefined) {
	return await makeIpcRequest(wsCapsule, call, args);
}

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