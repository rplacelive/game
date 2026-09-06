"use strict";
import { DEFAULT_BOARD, DEFAULT_BOARD_FALLBACK, DEFAULT_COOLDOWN, DEFAULT_HEIGHT, DEFAULT_PALETTE, DEFAULT_PALETTE_USABLE_REGION, DEFAULT_SERVER, DEFAULT_WIDTH, PLACEMENT_MODE, RENDERER_TYPE } from "../../defaults";
import { addIpcMessageHandler, handleIpcMessage, makeIpcRequest, sendIpcMessage } from "shared-ipc";
import { createGameIpc, selectGameIpcMode } from "./game-ipc.js";

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
/**@type {"not-required"|"required"|"completed"|"failed"|"unsupported"}*/export let passkeyAuthState = "not-required";
/**@type {PLACEMENT_MODE}*/export let placementMode = PLACEMENT_MODE.selectPixel;
export function setPlacementMode(value) {
	placementMode = value;
}
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
const selectedServer = localStorage.server || DEFAULT_SERVER;
export const supportsCanvasPixelReports = selectGameIpcMode(selectedServer, DEFAULT_SERVER) === "strict";
const httpServerUrl = selectedServer
	.replace("wss://", "https://").replace("ws://", "http://");
// TODO: Find a better cache invalidation strategy for game worker
const res = await fetch(`${httpServerUrl}/public/game-worker.js?v=${Date.now()}`);
const code = await res.text();
const blob = new Blob([code], { type: "application/javascript" });
const url = URL.createObjectURL(blob);
const wsCapsule = new Worker(url, {
	type: "module"
});
let defaultCaptchaHandlers;
/** @type {[string, number|undefined, number|undefined]|null} */
let pendingChatHistoryRequest = null;
const gameIpc = await createGameIpc(
	wsCapsule,
	selectedServer,
	DEFAULT_SERVER,
	undefined,
	[
		handleGameConnect,
		handleGameDisconnect,
		value => defaultCaptchaHandlers?.[0](value),
		value => defaultCaptchaHandlers?.[1](value),
		() => defaultCaptchaHandlers?.[2](),
		handleStrictCooldownInfo,
		handleStrictCooldown,
		handleStrictRejectedPixel,
		handleStrictPalette,
		handleStrictChanges,
		handleStrictCanvasRestriction,
		handleStrictPasskeyRequired,
		handleStrictPasskeySuccess,
		handleSpectating,
		handleUnspectating,
		handleStrictPixels,
		handleOnline,
		handleSetIntId,
		handleNameInfo,
		handleChatName,
		handleSpectatorJoined,
		handleSpectatorLeft,
		handleChatDelete,
		handleChatReaction,
		handleLiveChat,
		handlePlaceChat,
		handlePunishment,
		handleChatHistory,
		handleChallenge,
		value => dispatchSecurityEvent("turnstilechallenge", value),
		() => dispatchSecurityEvent("turnstilesuccess"),
		value => dispatchSecurityEvent("hcaptchachallenge", value),
		() => dispatchSecurityEvent("hcaptchasuccess"),
		handlePlacerRegion,
		value => {
			setPlacementMode(value[1]);
			dispatchSecurityEvent("clientviewport", value);
		}
	]
);
wsCapsule.addEventListener("message", handleIpcMessage);
window.addEventListener("beforeunload", (e) => {
	console.log("Stopping wsCapsule...")
	gameIpc.stop();
});
// Undefine global objects
const undefineGlobals = new CustomEvent("undefineglobals");
window.dispatchEvent(undefineGlobals);
// Weak client telemetry flags: webdriver, extension API, zero-height window, no plugins, headless UA.
const automatedActivityFlags =
	(window.navigator.webdriver ? 1 : 0) |
	// @ts-ignore Browser specifics
	(window.chrome?.runtime?.onConnect ? 2 : 0) |
	(window.outerHeight === 0 ? 4 : 0) |
	// @ts-ignore Browser specifics
	(navigator?.plugins?.length === 0 ? 8 : 0) |
	(/HeadlessChrome/.test(navigator.userAgent) ? 16 : 0);

function handleGameConnect() {
	connectStatus = "connected";
	if (pendingChatHistoryRequest) {
		const request = pendingChatHistoryRequest;
		pendingChatHistoryRequest = null;
		gameIpc.requestChatHistory(...request);
	}
}
addIpcMessageHandler("handleConnect", handleGameConnect);
function handleStrictPalette(/**@type {[number[],number,number]}*/[palette, start, end]) {
	PALETTE = palette;
	PALETTE_USABLE_REGION.start = start;
	PALETTE_USABLE_REGION.end = end;

	const paletteEvent = new CustomEvent("palette", {
		detail: { palette, start, end },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(paletteEvent);
}
addIpcMessageHandler("handlePalette", (/**@type {[number[],number,number]}*/value) => {
	handleStrictPalette(value);
});
function handleStrictCooldownInfo(/**@type {[number, number]}*/[endDateMs, cooldown]) {
	const endDate = new Date(endDateMs);
	setCooldown(endDateMs);
	COOLDOWN = cooldown;

	const cooldownEvent = new CustomEvent("cooldown", {
		detail: { endDate, cooldown },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(cooldownEvent);
}
addIpcMessageHandler("handleCooldownInfo", /**@type {[Date, number]}*/([endDate, cooldown]) => {
	handleStrictCooldownInfo([endDate.getTime(), cooldown]);
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
async function handleStrictChanges(/**@type {[number,number,ArrayBuffer]}*/[width, height, changes]) {
	// Initial compressed canvas changes.
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
addIpcMessageHandler("handleChanges", (/**@type {[number,number,ArrayBuffer]}*/value) => {
	return handleStrictChanges(value);
});
function handleOnline(/**@type {number}*/count) {
	const onlineEvent = new CustomEvent("online", {
		detail: { count },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(onlineEvent);
}
addIpcMessageHandler("setOnline", handleOnline);
function handlePlacerRegion(/**@type {[number,number,number,ArrayBuffer]}*/[position, width, height, region]) {
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
addIpcMessageHandler("handlePlacerInfoRegion", handlePlacerRegion);
function handleSetIntId(/**@type {number}*/userIntId) {
	intId = userIntId;
	if (automatedActivityFlags !== 0) {
		gameIpc.reportAutomatedActivity([
			automatedActivityFlags,
			window.outerWidth,
			window.innerWidth,
			window.outerHeight,
			window.innerHeight
		]);
	}

	const intIdEvent = new CustomEvent("intid", {
		detail: { intId },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(intIdEvent);
}
addIpcMessageHandler("handleSetIntId", handleSetIntId);
function handleStrictCanvasRestriction(/**@type {[boolean, string]}*/[locked, reason]) {
	canvasLocked = locked;

	const canvasLockedEvent = new CustomEvent("canvaslocked", {
		detail: { locked, reason },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(canvasLockedEvent);
}
addIpcMessageHandler("setCanvasLocked", (/**@type {[boolean, string]}*/value) => {
	handleStrictCanvasRestriction(value);
});
function handleStrictPixels(/**@type {([number, number]|[number, number, number])[]}*/values) {
	const pixels = values.map(([position, colour, placer]) => ({
		position,
		colour,
		placer
	}));
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
addIpcMessageHandler("handlePixels", (/**@type {{position:number,colour:number,placer:number|undefined}[]}*/pixels) => {
	handleStrictPixels(pixels.map(pixel => pixel.placer === undefined ?
		[pixel.position, pixel.colour] :
		[pixel.position, pixel.colour, pixel.placer]));
});
function handleStrictRejectedPixel(/**@type {[number, number, number]}*/[endDateMs, position, colour]) {
	const endDate = new Date(endDateMs);
	setCooldown(endDateMs);
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
addIpcMessageHandler("handleRejectedPixel", (/**@type {[Date,Number,number]}*/[endDate, position, colour]) => {
	handleStrictRejectedPixel([endDate.getTime(), position, colour]);
});
function handleStrictCooldown(/**@type {[number]}*/[endDateMs]) {
	setCooldown(endDateMs);
}
addIpcMessageHandler("handleCooldown", (/**@type {Date}*/endDate) => {
	handleStrictCooldown([endDate.getTime()]);
});
function handleChatName(/**@type {string}*/name) {
	chatName = name;

	const chatNameEvent = new CustomEvent("chatname", {
		detail: { chatName },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(chatNameEvent);
}
addIpcMessageHandler("setChatName", handleChatName);
function handleNameInfo(/**@type {[number, string][]}*/entries) {
	for (const [ key, value ] of entries) {
		intIdNames.set(key, value);
	}
}
addIpcMessageHandler("handleNameInfo", (/**@type {Map<number, string>}*/newIntIdNames) => {
	handleNameInfo(Array.from(newIntIdNames.entries()));
});
function handleLiveChat(/**@type {[number,string,number,string,number,string,number|null]}*/[
	messageId, content, senderIntId, senderChatName, sendDate, channel, repliesTo
]) {
	const message = {
		messageId, content, senderIntId, senderChatName, sendDate,
		reactions: new Map(),
		channel,
		repliesTo
	};
	const liveChatMessageEvent = new CustomEvent("livechatmessage", {
		detail: { message, channel },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(liveChatMessageEvent);
}
addIpcMessageHandler("addLiveChatMessage", (/**@type {[LiveChatMessage,string]}*/[message, channel]) => {
	handleLiveChat([
		message.messageId, message.content, message.senderIntId,
		message.senderChatName, message.sendDate, channel, message.repliesTo
	]);
});
function handlePlaceChat(/**@type {[number,string,number,string]}*/[
	positionIndex, content, senderIntId, senderChatName
]) {
	const message = { positionIndex, content, senderIntId, senderChatName };
	const placeChatMessageEvent = new CustomEvent("placechatmessage", {
		detail: { message },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(placeChatMessageEvent);
}
addIpcMessageHandler("addPlaceChatMessage", (/**@type {PlaceChatMessage}*/message) => {
	handlePlaceChat([
		message.positionIndex, message.content,
		message.senderIntId, message.senderChatName
	]);
});
function handleChatDelete(/**@type {number}*/messageId) {
	const liveChatDeleteEvent = new CustomEvent("livechatdelete", {
		detail: { messageId },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(liveChatDeleteEvent);
}
addIpcMessageHandler("handleLiveChatDelete", handleChatDelete);
function handleChatReaction(/**@type {[number,number,string]}*/[messageId, reactorId, reactionKey]) {
	const liveChatReactionEvent = new CustomEvent("livechatreaction", {
		detail: { messageId, reactorId, reactionKey },
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(liveChatReactionEvent);
}
addIpcMessageHandler("handleLiveChatReaction", handleChatReaction);
function handlePunishment(/**@type {[number,number,number,string,string]}*/[
	state, startDate, endDate, reason, appeal
]) {
	const info = { state, startDate, endDate, reason, appeal };
	const punishmentEvent = new CustomEvent("punishment", {
		detail: info,
		bubbles: true,
		composed: true
	});
	window.dispatchEvent(punishmentEvent);
}
addIpcMessageHandler("applyPunishment", (/**@type {ModerationInfo}*/info) => {
	handlePunishment([
		info.state, info.startDate, info.endDate, info.reason, info.appeal
	]);
});
function handleChatHistory(/**@type {[number,number,boolean,string,Array]}*/[
	fromMessageId, count, before, channel, messages
]) {
	window.dispatchEvent(new CustomEvent("livechathistory", {
		detail: {
			fromMessageId,
			count,
			before,
			channel,
			messages: messages.map(message => ({
				messageId: message[0],
				content: message[1],
				senderIntId: message[2],
				senderChatName: "",
				sendDate: message[3],
				reactions: new Map(message[4].map(
					reaction => [reaction[0], new Set(reaction[1])]
				)),
				channel: message[5],
				repliesTo: message[6]
			}))
		}
	}));
}
async function handleChallenge(/**@type {[string,Uint8Array]}*/[source, input]) {
	const result = await Object.getPrototypeOf(async function () { })
		.constructor(source)(input);
	gameIpc.sendChallengeResult(result);
}
addIpcMessageHandler("handleChallenge", value => { void handleChallenge(value); });
function dispatchSecurityEvent(name, detail=undefined) {
	window.dispatchEvent(new CustomEvent(name, { detail }));
}
function handleStrictPasskeyRequired() {
	setPasskeyAuthState("required");
}
addIpcMessageHandler("handlePasskeyAuthRequired", handleStrictPasskeyRequired);
function handleStrictPasskeySuccess() {
	setPasskeyAuthState("completed");
}
addIpcMessageHandler("handlePasskeyAuthSuccess", handleStrictPasskeySuccess);
function handleSpectating(/**@type {number}*/userIntId) {
	spectatingIntId = userIntId;

	const spectatingEvent = new CustomEvent("spectating", {
		detail: { userIntId },
		composed: true,
		bubbles: true
	});
	window.dispatchEvent(spectatingEvent);
}
addIpcMessageHandler("handleSpectating", handleSpectating);
function handleUnspectating(/**@type {[number, string]}*/[ userIntId, reason ]) {
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
function handleSpectatorJoined(/**@type {number}*/spectatorIntId) {
	spectators.add(spectatorIntId);
}
addIpcMessageHandler("handleSpectated", handleSpectatorJoined);
function handleSpectatorLeft(/**@type {number}*/spectatorIntId) {
	spectators.delete(spectatorIntId);
}
addIpcMessageHandler("handleUnspectated", handleSpectatorLeft);
/** @param {[number, string]} value */
function handleGameDisconnect([code, reason]) {
	localStorage.lastDisconnect = Date.now();
	connectStatus = "disconnected";
	setCooldown(null);
	gameIpc.dispose();
	wsCapsule.terminate();

	const disconnectEvent = new CustomEvent("disconnect", {
		detail: { code, reason },
		composed: true,
		bubbles: true
	});
	window.dispatchEvent(disconnectEvent);
}
addIpcMessageHandler("handleDisconnect", handleGameDisconnect);

/**
 * @param {string} device 
 * @param {string} [vip] 
 */
export function connect(device, vip = undefined) {
	if (connectStatus !== "initial" && connectStatus !== "disconnected") {
		return;
	}

	gameIpc.connect(device, vip ?? null);
	connectStatus = "connecting";
}

/**
 * @param {string} name
 * @param {any} [args]
 * @param {Event} [event] 
 */
export function sendServerMessage(name, args=undefined, event=undefined) {
	const trustedMethods = [ "putPixel", "reportCanvasPixel", "sendLiveChatMsg", "sendPlaceChatMsg" ]
	if (trustedMethods.includes(name) && (!(event instanceof Event) || !event?.isTrusted)) {
		throw new Error("Trusted method event was invalid");
	}

	if (name === "spectateUser") {
		gameIpc.spectateUser(args);
		return;
	}
	if (name === "unspectateUser") {
		gameIpc.unspectateUser();
		return;
	}
	if (name === "setName") {
		gameIpc.setName(args);
		return;
	}
	if (name === "chatReact") {
		gameIpc.chatReact(args.messageId, args.reactKey);
		return;
	}
	if (name === "chatReport") {
		gameIpc.chatReport(args.messageId, args.reason);
		return;
	}
	if (name === "reportCanvasPixel") {
		gameIpc.reportCanvasPixel(args.position, args.reason);
		return;
	}
	if (name === "sendLiveChatMsg") {
		gameIpc.sendLiveChat(args.message, args.channel, args.replyId);
		return;
	}
	if (name === "sendPlaceChatMsg") {
		gameIpc.sendPlaceChat(args.message, args.position);
		return;
	}
	if (name === "requestLoadChannelPrevious") {
		if (connectStatus !== "connected") {
			pendingChatHistoryRequest = [args.channel, args.anchorMsgId, args.msgCount];
			return;
		}
		gameIpc.requestChatHistory(args.channel, args.anchorMsgId, args.msgCount);
		return;
	}
	if (name === "sendTurnstileResult") {
		gameIpc.sendTurnstileResult(args.captchaId, args.result);
		return;
	}
	if (name === "sendHCaptchaResult") {
		gameIpc.sendHCaptchaResult(args.captchaId, args.result);
		return;
	}
	if (name === "requestPixelPlacers") {
		gameIpc.requestPixelPlacers(args.position, args.width, args.height);
		return;
	}
	sendIpcMessage(wsCapsule, name, args);
}

/**
 * @param {number} position
 * @param {number} colour
 * @param {Event} event
 */
export function placePixel(position, colour, event) {
	if (!(event instanceof Event) || !event.isTrusted) {
		throw new Error("Trusted pixel placement event was invalid");
	}
	return gameIpc.putPixel(position, colour);
}

export function setDefaultCaptchaHandlers(handleText, handleEmoji, handleSuccess) {
	if (defaultCaptchaHandlers) {
		throw new Error("Default CAPTCHA handlers are already registered");
	}
	defaultCaptchaHandlers = Object.freeze([handleText, handleEmoji, handleSuccess]);
}

export function sendDefaultCaptchaResult(captchaId, result) {
	gameIpc.sendCaptchaResult(captchaId, result);
}

/**
 * @param {string} call
 * @param {any} [args]
 */
export async function makeServerRequest(call, args=undefined) {
	if (call === "fetchLinkKey") {
		return await gameIpc.fetchLinkKey();
	}
	if (call === "sendModAction") {
		return await gameIpc.sendModAction(args);
	}
	return await makeIpcRequest(wsCapsule, call, args);
}

/**
 * @param {"not-required"|"required"|"completed"|"failed"|"unsupported"} state
 * @param {string} [message]
 */
export function setPasskeyAuthState(state, message = "") {
	passkeyAuthState = state;
	window.dispatchEvent(new CustomEvent("passkeyauthstate", {
		detail: { state, message },
		bubbles: true,
		composed: true
	}));
}

export async function fetchBoard() {
	const now = Date.now();
	const primary = localStorage.board || DEFAULT_BOARD;
	const fallback = localStorage.boardFallback || DEFAULT_BOARD_FALLBACK;

	const urlsToTry = [ primary, fallback ];
	for (let i = 0; i < urlsToTry.length; i++) {
		let url = urlsToTry[i];
		try {
			const response = await fetch(url + "?v=" + now);
			if (response.ok) {
				if (fetchFailTimeout) {
					clearTimeout(fetchFailTimeout);
				}
				return await response.arrayBuffer();
			}
			else {
				console.error(`Couldn't fetch board: Server responded with ${response.status} ${response.statusText} for: ${url}`);
			}
		}
		catch (err) {
			console.error(`Couldn't fetch board: Network error while fetching board from: ${url}`, err);
		}
	}

	// Both primary and fallback failed
	dispatchFetchBoardFail("badresponse");

	// Exponential backoff retry
	fetchFailTimeout = setTimeout(fetchBoard, fetchCooldown *= 2);
	if (fetchCooldown > 8000) {
		clearTimeout(fetchFailTimeout);
		dispatchFetchBoardFail("timeout");
	}

	return null;
}

/**
 * @param {string} type 
 */
function dispatchFetchBoardFail(type) {
	window.dispatchEvent(new CustomEvent("fetchboardfail", {
		detail: { type },
		bubbles: true,
		composed: true
	}));
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
