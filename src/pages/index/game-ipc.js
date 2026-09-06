import { createStrictIpcEndpoint, makeIpcRequest, sendIpcMessage } from "shared-ipc";

/** @typedef {[number, number, number, number, number]} ClientActivity */
/** @typedef {[string, string, string|null]} ConnectArgs */
/** @typedef {[number, string[], Uint8Array]} DefaultCaptchaChallenge */
/** @typedef {{ chatReact: (messageId: number, reaction: string) => void, chatReport: (messageId: number, reason: string) => void, connect: (device: string, vip: string|null) => void, fetchLinkKey: () => Promise<{linkKey:string,instanceId:number}>, putPixel: (position: number, colour: number) => Promise<boolean>, reportAutomatedActivity: (activity: ClientActivity) => void, reportCanvasPixel: (position: number, reason: string) => void, requestChatHistory: (channel: string, anchorMsgId?: number, msgCount?: number) => void, requestPixelPlacers: (position: number, width: number, height: number) => void, sendCaptchaResult: (captchaId: number, result: string) => void, sendChallengeResult: (result: bigint) => void, sendHCaptchaResult: (captchaId: number, result: string) => void, sendLiveChat: (message: string, channel: string, replyId: number|null) => void, sendModAction: (value: object) => Promise<string>, sendPlaceChat: (message: string, position: number) => void, sendTurnstileResult: (captchaId: number, result: string) => void, setName: (name: string) => void, spectateUser: (userId: number) => void, unspectateUser: () => void, stop: () => void, dispose: () => void }} GameIpc */
const MAX_DATE_MS = 8_640_000_000_000_000;
const textEncoder = new TextEncoder();

/** @param {*} activity */
function isClientActivity(activity) {
	if (!Array.isArray(activity) || activity.length !== 5) {
		return false;
	}
	const [flags, ...dimensions] = activity;
	return Number.isInteger(flags) && flags >= 1 && flags <= 31 &&
		dimensions.every(value => Number.isInteger(value) && value >= 0 && value <= 1_000_000);
}

/** @param {*} args */
function isConnectArgs(args) {
	if (!Array.isArray(args) || args.length !== 3 ||
		typeof args[0] !== "string" || args[0].length === 0 ||
		typeof args[1] !== "string" ||
		(args[2] !== null && typeof args[2] !== "string")) {
		return false;
	}
	try {
		const protocol = new URL(args[1]).protocol;
		return protocol === "ws:" || protocol === "wss:";
	}
	catch {
		return false;
	}
}

/** @param {*} value */
function isDisconnect(value) {
	return Array.isArray(value) && value.length === 2 &&
		Number.isInteger(value[0]) && value[0] >= 0 && value[0] <= 65_535 &&
		typeof value[1] === "string";
}

function isDefaultCaptchaChallenge(value) {
	return Array.isArray(value) && value.length === 3 &&
		Number.isInteger(value[0]) && value[0] >= 0 && value[0] <= 255 &&
		Array.isArray(value[1]) && value[1].every(option => typeof option === "string") &&
		value[2] instanceof Uint8Array;
}

function isDefaultCaptchaResult(value) {
	return Array.isArray(value) && value.length === 2 &&
		Number.isInteger(value[0]) && value[0] >= 0 && value[0] <= 255 &&
		typeof value[1] === "string" && value[1].length > 0;
}

function isPixelPlacement(value) {
	return Array.isArray(value) && value.length === 2 &&
		Number.isInteger(value[0]) && value[0] >= 0 && value[0] <= 0xFFFF_FFFF &&
		Number.isInteger(value[1]) && value[1] >= 0 && value[1] <= 255;
}

/** @param {*} value */
function isUint32(value) {
	return Number.isInteger(value) && value >= 0 && value <= 0xFFFF_FFFF;
}

/** @param {*} value */
function isUnspectating(value) {
	return Array.isArray(value) && value.length === 2 &&
		isUint32(value[0]) && typeof value[1] === "string";
}

function isPixels(value) {
	return Array.isArray(value) && value.length > 0 &&
		value.every(pixel => Array.isArray(pixel) &&
			(pixel.length === 2 || pixel.length === 3) &&
			isUint32(pixel[0]) &&
			Number.isInteger(pixel[1]) && pixel[1] >= 0 && pixel[1] <= 255 &&
			(pixel.length === 2 || isUint32(pixel[2])));
}

function isNameEntries(value) {
	return Array.isArray(value) && value.every(entry =>
		Array.isArray(entry) && entry.length === 2 &&
		isUint32(entry[0]) && typeof entry[1] === "string" &&
		entry[1].length <= 255);
}

function isNameRequest(value) {
	return typeof value === "string" && value.length <= 16;
}

function isChatReactionRequest(value) {
	return Array.isArray(value) && value.length === 2 &&
		isUint32(value[0]) && typeof value[1] === "string" &&
		value[1].length > 0 && value[1].length <= 255;
}

function isChatReaction(value) {
	return Array.isArray(value) && value.length === 3 &&
		isUint32(value[0]) && isUint32(value[1]) &&
		typeof value[2] === "string" && value[2].length > 0;
}

function isChatReport(value) {
	return Array.isArray(value) && value.length === 2 &&
		isUint32(value[0]) && typeof value[1] === "string" &&
		value[1].length > 0;
}

function isCanvasPixelReport(value) {
	return Array.isArray(value) && value.length === 2 &&
		isUint32(value[0]) && typeof value[1] === "string" &&
		value[1].trim().length > 0 &&
		textEncoder.encode(value[1]).byteLength <= 280;
}

function isLiveChatSubmission(value) {
	return Array.isArray(value) && value.length === 3 &&
		typeof value[0] === "string" && value[0].length > 0 &&
		textEncoder.encode(value[0]).byteLength <= 65_535 &&
		typeof value[1] === "string" && value[1].length > 0 &&
		textEncoder.encode(value[1]).byteLength <= 255 &&
		(value[2] === null || isUint32(value[2]));
}

function isPlaceChatSubmission(value) {
	return Array.isArray(value) && value.length === 2 &&
		typeof value[0] === "string" && value[0].length > 0 &&
		textEncoder.encode(value[0]).byteLength <= 65_535 && isUint32(value[1]);
}

function isLiveChatDelivery(value) {
	return Array.isArray(value) && value.length === 7 &&
		isUint32(value[0]) && typeof value[1] === "string" &&
		isUint32(value[2]) && typeof value[3] === "string" &&
		isUint32(value[4]) && typeof value[5] === "string" &&
		(value[6] === null || isUint32(value[6]));
}

function isPlaceChatDelivery(value) {
	return Array.isArray(value) && value.length === 4 &&
		isUint32(value[0]) && typeof value[1] === "string" &&
		isUint32(value[2]) && typeof value[3] === "string";
}

function isPunishment(value) {
	return Array.isArray(value) && value.length === 5 &&
		Number.isInteger(value[0]) && value[0] >= 0 && value[0] <= 3 &&
		isTimestamp(value[1]) && isTimestamp(value[2]) &&
		typeof value[3] === "string" && typeof value[4] === "string";
}

function isChatHistoryRequest(value) {
	return Array.isArray(value) && value.length === 3 &&
		typeof value[0] === "string" && value[0].length > 0 &&
		textEncoder.encode(value[0]).byteLength <= 255 &&
		isUint32(value[1]) && Number.isInteger(value[2]) &&
		value[2] >= 1 && value[2] <= 127;
}

function isChatHistory(value) {
	if (!Array.isArray(value) || value.length !== 5 ||
		!isUint32(value[0]) || !Number.isInteger(value[1]) ||
		value[1] < 0 || value[1] > 127 ||
		typeof value[2] !== "boolean" ||
		typeof value[3] !== "string" || value[3].length === 0 ||
		!Array.isArray(value[4])) return false;
	return value[4].every(message =>
		Array.isArray(message) && message.length === 7 &&
		isUint32(message[0]) && typeof message[1] === "string" &&
		isUint32(message[2]) && isUint32(message[3]) &&
		Array.isArray(message[4]) && message[4].every(reaction =>
			Array.isArray(reaction) && reaction.length === 2 &&
			typeof reaction[0] === "string" && reaction[0].length > 0 &&
			Array.isArray(reaction[1]) && reaction[1].every(isUint32)
		) &&
		typeof message[5] === "string" && message[5].length > 0 &&
		(message[6] === null || isUint32(message[6]))
	);
}

function isChallenge(value) {
	return Array.isArray(value) && value.length === 2 &&
		typeof value[0] === "string" && value[0].length > 0 &&
		value[1] instanceof Uint8Array && value[1].byteLength > 0;
}

function isChallengeResult(value) {
	return typeof value === "bigint" &&
		value >= 0n && value <= 0xFFFF_FFFF_FFFF_FFFFn;
}

function isExternalCaptchaChallenge(value) {
	return Array.isArray(value) && value.length === 2 &&
		Number.isInteger(value[0]) && value[0] >= 0 && value[0] <= 255 &&
		typeof value[1] === "string" && value[1].length > 0;
}

function isExternalCaptchaResult(value) {
	return Array.isArray(value) && value.length === 2 &&
		Number.isInteger(value[0]) && value[0] >= 0 && value[0] <= 255 &&
		typeof value[1] === "string" && value[1].length > 0 &&
		textEncoder.encode(value[1]).byteLength <= 65_533;
}

function isPlacerRegionRequest(value) {
	return Array.isArray(value) && value.length === 3 &&
		isUint32(value[0]) &&
		Number.isInteger(value[1]) && value[1] >= 1 && value[1] <= 15 &&
		Number.isInteger(value[2]) && value[2] >= 1 && value[2] <= 15;
}

function isPlacerRegion(value) {
	return Array.isArray(value) && value.length === 4 &&
		isUint32(value[0]) &&
		Number.isInteger(value[1]) && value[1] >= 1 && value[1] <= 15 &&
		Number.isInteger(value[2]) && value[2] >= 1 && value[2] <= 15 &&
		value[3] instanceof ArrayBuffer &&
		value[3].byteLength === value[1] * value[2] * 4;
}

function isClientViewport(value) {
	return Array.isArray(value) && value.length === 2 &&
		Number.isInteger(value[0]) && value[0] >= 0 && value[0] <= 3 &&
		Number.isInteger(value[1]) && value[1] >= 0 && value[1] <= 2;
}

function isLinkKey(value) {
	return Array.isArray(value) && value.length === 2 &&
		typeof value[0] === "string" && value[0].length > 0 &&
		isUint32(value[1]);
}

function isModAction(value) {
	if (!value || typeof value !== "object" || Array.isArray(value) ||
		typeof value.action !== "string" || typeof value.reason !== "string" ||
		textEncoder.encode(value.reason).byteLength > 65_529) return false;
	const keys = Object.keys(value).sort().join(",");
	if (value.action === "kick") {
		return keys === "action,memberId,reason" && isUint32(value.memberId);
	}
	if (value.action === "mute" || value.action === "ban") {
		return keys === "action,duration,memberId,reason" &&
			isUint32(value.memberId) && isUint32(value.duration);
	}
	if (value.action === "captcha") {
		return keys === "action,affectsAll,memberId,reason" &&
			isUint32(value.memberId) && typeof value.affectsAll === "boolean";
	}
	return value.action === "delete" &&
		keys === "action,messageId,reason" && isUint32(value.messageId);
}

function isTimestamp(value) {
	return Number.isSafeInteger(value) && value >= 0 && value <= MAX_DATE_MS;
}

function isCooldownInfo(value) {
	return Array.isArray(value) && value.length === 2 &&
		isTimestamp(value[0]) &&
		Number.isInteger(value[1]) && value[1] >= 0 && value[1] <= 0xFFFF_FFFF;
}

function isCooldown(value) {
	return Array.isArray(value) && value.length === 1 && isTimestamp(value[0]);
}

function isRejectedPixel(value) {
	return Array.isArray(value) && value.length === 3 &&
		isTimestamp(value[0]) &&
		Number.isInteger(value[1]) && value[1] >= 0 && value[1] <= 0xFFFF_FFFF &&
		Number.isInteger(value[2]) && value[2] >= 0 && value[2] <= 255;
}

function isCanvasDimensions(width, height) {
	return Number.isInteger(width) && width > 0 && width <= 0xFFFF_FFFF &&
		Number.isInteger(height) && height > 0 && height <= 0xFFFF_FFFF &&
		width * height <= 0x1_0000_0000;
}

function isPalette(value) {
	if (!Array.isArray(value) || value.length !== 3 || !Array.isArray(value[0]) ||
		value[0].length > 255 ||
		!value[0].every(colour => Number.isInteger(colour) &&
			colour >= 0 && colour <= 0xFFFF_FFFF)) {
		return false;
	}
	return Number.isInteger(value[1]) && value[1] >= 0 &&
		Number.isInteger(value[2]) && value[2] >= value[1] &&
		value[2] <= value[0].length;
}

function isChanges(value) {
	return Array.isArray(value) && value.length === 3 &&
		isCanvasDimensions(value[0], value[1]) &&
		value[2] instanceof ArrayBuffer;
}

function isCanvasRestriction(value) {
	return Array.isArray(value) && value.length === 2 &&
		typeof value[0] === "boolean" && typeof value[1] === "string";
}

function createChannelId() {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

/** @param {unknown} value */
function isWorkerBootstrap(value) {
	return Array.isArray(value) && value.length === 3 && value[0] === 1 &&
		value.slice(1).every(sequence => Number.isSafeInteger(sequence) &&
			sequence >= 0 && sequence <= 0xFFFF_FFFF_FFFF);
}

/**
 * The official origin is strict-required. A different origin can only come
 * from the existing explicit custom-server selection.
 * @param {string} server
 * @param {string} officialServer
 * @returns {"strict"|"legacy"}
 */
export function selectGameIpcMode(server, officialServer) {
	try {
		return new URL(server).origin === new URL(officialServer).origin ? "strict" : "legacy";
	}
	catch {
		return "legacy";
	}
}

/**
 * @param {{ postMessage: Function, terminate: Function }} worker
 * @param {string} server
 * @param {string} officialServer
 * @param {number} [bootstrapTimeoutMs]
 * @param {[() => void, (value: [number, string]) => void, (value: DefaultCaptchaChallenge) => void, (value: DefaultCaptchaChallenge) => void, () => void, (value: [number, number]) => void, (value: [number]) => void, (value: [number, number, number]) => void, (value: [number[], number, number]) => void, (value: [number, number, ArrayBuffer]) => void, (value: [boolean, string]) => void, () => void, () => void, (value: number) => void, (value: [number, string]) => void, (value: ([number, number]|[number, number, number])[]) => void]} [eventHandlers]
 * @returns {Promise<GameIpc>}
 */
export async function createGameIpc(
	worker,
	server,
	officialServer,
	bootstrapTimeoutMs = 5_000,
	eventHandlers = [
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined,
		() => undefined
	]
) {
	const mode = selectGameIpcMode(server, officialServer);
	if (mode === "legacy") {
		let disposed = false;
		return Object.freeze({
			/**
			 * @param {string} device
			 * @param {string|null} vip
			 */
			connect(device, vip) {
				if (disposed) {
					throw new Error("Game IPC endpoint is closed");
				}
				sendIpcMessage(/** @type {Worker} */(worker), "connect", {
					device,
					server,
					vip
				});
			},
			/** @param {ClientActivity} activity */
			reportAutomatedActivity(activity) {
				if (disposed) {
					throw new Error("Game IPC endpoint is closed");
				}
				if (!isClientActivity(activity)) {
					throw new TypeError("Invalid client activity");
				}
				sendIpcMessage(/** @type {Worker} */(worker), "informAutomatedActivity", activity);
			},
			sendCaptchaResult(captchaId, result) {
				if (disposed) {
					throw new Error("Game IPC endpoint is closed");
				}
				sendIpcMessage(/** @type {Worker} */(worker), "sendCaptchaResult", {
					captchaId,
					result
				});
			},
			requestChatHistory(channel, anchorMsgId = 0, msgCount = 64) {
				if (disposed) throw new Error("Game IPC endpoint is closed");
				const value = [channel, anchorMsgId, msgCount];
				if (!isChatHistoryRequest(value)) throw new TypeError("Invalid chat history request");
				sendIpcMessage(/** @type {Worker} */(worker), "requestLoadChannelPrevious", {
					channel, anchorMsgId, msgCount
				});
			},
			requestPixelPlacers(position, width, height) {
				if (disposed) throw new Error("Game IPC endpoint is closed");
				const value = [position, width, height];
				if (!isPlacerRegionRequest(value)) throw new TypeError("Invalid placer-region request");
				sendIpcMessage(/** @type {Worker} */(worker), "requestPixelPlacers",
					{ position, width, height });
			},
			async fetchLinkKey() {
				if (disposed) throw new Error("Game IPC endpoint is closed");
				return await makeIpcRequest(/** @type {Worker} */(worker), "fetchLinkKey");
			},
			async sendModAction(value) {
				if (disposed) throw new Error("Game IPC endpoint is closed");
				if (!isModAction(value)) throw new TypeError("Invalid moderation action");
				return await makeIpcRequest(/** @type {Worker} */(worker), "sendModAction", value);
			},
			sendChallengeResult(result) {
				if (disposed) throw new Error("Game IPC endpoint is closed");
				if (!isChallengeResult(result)) throw new TypeError("Invalid challenge result");
				sendIpcMessage(/** @type {Worker} */(worker), "sendChallengeResult", result);
			},
			sendTurnstileResult(captchaId, result) {
				if (disposed) throw new Error("Game IPC endpoint is closed");
				const value = [captchaId, result];
				if (!isExternalCaptchaResult(value)) throw new TypeError("Invalid Turnstile result");
				sendIpcMessage(/** @type {Worker} */(worker), "sendTurnstileResult",
					{ captchaId, result });
			},
			sendHCaptchaResult(captchaId, result) {
				if (disposed) throw new Error("Game IPC endpoint is closed");
				const value = [captchaId, result];
				if (!isExternalCaptchaResult(value)) throw new TypeError("Invalid hCaptcha result");
				sendIpcMessage(/** @type {Worker} */(worker), "sendHCaptchaResult",
					{ captchaId, result });
			},
			putPixel(position, colour) {
				if (disposed) {
					throw new Error("Game IPC endpoint is closed");
				}
				sendIpcMessage(/** @type {Worker} */(worker), "putPixel", {
					position,
					colour
				});
				return Promise.resolve(true);
			},
			/** @param {number} userId */
			spectateUser(userId) {
				if (disposed) {
					throw new Error("Game IPC endpoint is closed");
				}
				if (!isUint32(userId)) {
					throw new TypeError("Invalid spectate target");
				}
				sendIpcMessage(/** @type {Worker} */(worker), "spectateUser", userId);
			},
			unspectateUser() {
				if (disposed) {
					throw new Error("Game IPC endpoint is closed");
				}
				sendIpcMessage(/** @type {Worker} */(worker), "unspectateUser");
			},
			/** @param {string} name */
			setName(name) {
				if (disposed) {
					throw new Error("Game IPC endpoint is closed");
				}
				if (!isNameRequest(name)) {
					throw new TypeError("Invalid chat name");
				}
				sendIpcMessage(/** @type {Worker} */(worker), "setName", name);
			},
			chatReact(messageId, reaction) {
				if (disposed) {
					throw new Error("Game IPC endpoint is closed");
				}
				const value = [messageId, reaction];
				if (!isChatReactionRequest(value)) {
					throw new TypeError("Invalid chat reaction");
				}
				sendIpcMessage(/** @type {Worker} */(worker), "chatReact", {
					messageId,
					reactKey: reaction
				});
			},
			chatReport(messageId, reason) {
				if (disposed) throw new Error("Game IPC endpoint is closed");
				const value = [messageId, reason];
				if (!isChatReport(value)) throw new TypeError("Invalid chat report");
				sendIpcMessage(/** @type {Worker} */(worker), "chatReport", { messageId, reason });
			},
			reportCanvasPixel() {
				if (disposed) throw new Error("Game IPC endpoint is closed");
				throw new Error("Canvas pixel reports require the official server");
			},
			sendLiveChat(message, channel, replyId) {
				if (disposed) throw new Error("Game IPC endpoint is closed");
				const value = [message, channel, replyId];
				if (!isLiveChatSubmission(value)) throw new TypeError("Invalid live chat");
				sendIpcMessage(/** @type {Worker} */(worker), "sendLiveChatMsg",
					{ message, channel, replyId });
			},
			sendPlaceChat(message, position) {
				if (disposed) throw new Error("Game IPC endpoint is closed");
				const value = [message, position];
				if (!isPlaceChatSubmission(value)) throw new TypeError("Invalid place chat");
				sendIpcMessage(/** @type {Worker} */(worker), "sendPlaceChatMsg",
					{ message, position });
			},
			stop() {
				if (disposed) {
					return;
				}
				disposed = true;
				sendIpcMessage(/** @type {Worker} */(worker), "stop");
			},
			dispose() {
				disposed = true;
			}
		});
	}
	if (!Number.isSafeInteger(bootstrapTimeoutMs) || bootstrapTimeoutMs <= 0) {
		throw new TypeError("Invalid game IPC configuration");
	}

	const channel = new MessageChannel();
	const channelId = createChannelId();
	let disposed = false;
	// 0 = port-bound, 1 = connecting, 2 = open, 3 = closed.
	let connectionState = 0;
	const outstandingCaptchas = new Set();
	let pendingCaptcha = null;
	// 0 = unknown, 1 = required, 2 = completed.
	let passkeyState = 0;
	/** @type {number|null} */
	let spectatingId = null;
	/** @type {number|null} */
	let userId = null;
	const spectators = new Set();
	const pendingChatHistories = new Map();
	let challengePending = false;
	let turnstile = null;
	let hcaptcha = null;
	const placerRequests = [];
	/** @type {ReturnType<typeof createStrictIpcEndpoint>|undefined} */
	let endpoint;
	/** @type {(() => void)|undefined} */
	let markReady;
	/** @type {Promise<void>} */
	const readyPromise = new Promise(resolve => { markReady = resolve; });
	/** @type {Map<number, import("shared-ipc").StrictIncomingCommand>} */
	// Schema validation belongs to the transport. State rejection belongs in
	// handlers so a delivered command cannot strand the IPC receive sequence.
	const incoming = new Map([[0, {
		kind: "message",
		validate: value => value === undefined,
		handler: () => {
			markReady?.();
			markReady = undefined;
		}
	}], [1, {
		kind: "message",
		validate: value => value === undefined,
		handler: () => {
			if (connectionState !== 1) return;
			connectionState = 2;
			eventHandlers[0]();
		}
	}], [2, {
		kind: "message",
		validate: isDisconnect,
		handler: value => {
			if (!(connectionState === 1 || connectionState === 2)) return;
			connectionState = 3;
			disposed = true;
			try {
				eventHandlers[1](value);
			}
			finally {
				endpoint?.dispose();
			}
		}
	}], [3, {
		kind: "message",
		validate: isDefaultCaptchaChallenge,
		handler: value => {
			if (!(connectionState === 2 && !outstandingCaptchas.has(value[0]) && pendingCaptcha !== value[0])) return;
			outstandingCaptchas.add(value[0]);
			eventHandlers[2](value);
		}
	}], [4, {
		kind: "message",
		validate: isDefaultCaptchaChallenge,
		handler: value => {
			if (!(connectionState === 2 && !outstandingCaptchas.has(value[0]) && pendingCaptcha !== value[0])) return;
			outstandingCaptchas.add(value[0]);
			eventHandlers[3](value);
		}
	}], [5, {
		kind: "message",
		validate: value => value === undefined,
		handler: () => {
			if (!(connectionState === 2 && pendingCaptcha !== null)) return;
			pendingCaptcha = null;
			eventHandlers[4]();
		}
	}], [6, {
		kind: "message",
		validate: isCooldownInfo,
		handler: value => {
			if (connectionState !== 2) return;
			eventHandlers[5](value);
		}
	}], [7, {
		kind: "message",
		validate: isCooldown,
		handler: value => {
			if (connectionState !== 2) return;
			eventHandlers[6](value);
		}
	}], [8, {
		kind: "message",
		validate: isRejectedPixel,
		handler: value => {
			if (connectionState !== 2) return;
			eventHandlers[7](value);
		}
	}], [9, {
		kind: "message",
		validate: isPalette,
		handler: value => {
			if (connectionState !== 2) return;
			eventHandlers[8](value);
		}
	}], [10, {
		kind: "message",
		validate: isChanges,
		handler: value => {
			if (connectionState !== 2) return;
			return eventHandlers[9](value);
		}
	}], [11, {
		kind: "message",
		validate: isCanvasRestriction,
		handler: value => {
			if (connectionState !== 2) return;
			eventHandlers[10](value);
		}
	}], [12, {
		kind: "message",
		validate: value => value === undefined,
		handler: () => {
			if (!(connectionState === 2 && passkeyState === 0)) return;
			passkeyState = 1;
			eventHandlers[11]();
		}
	}], [13, {
		kind: "message",
		validate: value => value === undefined,
		handler: () => {
			if (!(connectionState === 2 && passkeyState !== 2)) return;
			passkeyState = 2;
			eventHandlers[12]();
		}
	}], [14, {
		kind: "message",
		validate: isUint32,
		handler: value => {
			if (connectionState !== 2) return;
			spectatingId = value;
			eventHandlers[13](value);
		}
	}], [15, {
		kind: "message",
		validate: isUnspectating,
		handler: value => {
			if (!(connectionState === 2 && spectatingId === value[0])) return;
			spectatingId = null;
			eventHandlers[14](value);
		}
	}], [16, {
		kind: "message",
		validate: isPixels,
		handler: value => {
			if (connectionState !== 2) return;
			eventHandlers[15](value);
		}
	}], [17, {
		kind: "message",
		validate: value => Number.isInteger(value) && value >= 0 && value <= 65_535,
		handler: value => {
			if (connectionState !== 2) return;
			eventHandlers[16](value);
		}
	}], [18, {
		kind: "message",
		validate: isUint32,
		handler: value => {
			if (!(connectionState === 2 && userId === null)) return;
			userId = value;
			eventHandlers[17](value);
		}
	}], [19, {
		kind: "message",
		validate: isNameEntries,
		handler: value => {
			if (connectionState !== 2) return;
			eventHandlers[18](value);
		}
	}], [20, {
		kind: "message",
		validate: value => typeof value === "string" && value.length <= 255,
		handler: value => {
			if (connectionState !== 2) return;
			eventHandlers[19](value);
		}
	}], [21, {
		kind: "message",
		validate: isUint32,
		handler: value => {
			if (!(connectionState === 2 && !spectators.has(value))) return;
			spectators.add(value);
			eventHandlers[20](value);
		}
	}], [22, {
		kind: "message",
		validate: isUint32,
		handler: value => {
			if (!(connectionState === 2 && spectators.has(value))) return;
			spectators.delete(value);
			eventHandlers[21](value);
		}
	}], [23, {
		kind: "message",
		validate: isUint32,
		handler: value => {
			if (connectionState !== 2) return;
			eventHandlers[22](value);
		}
	}], [24, {
		kind: "message",
		validate: isChatReaction,
		handler: value => {
			if (connectionState !== 2) return;
			eventHandlers[23](value);
		}
	}], [25, {
		kind: "message",
		validate: isLiveChatDelivery,
		handler: value => {
			if (connectionState !== 2) return;
			eventHandlers[24](value);
		}
	}], [26, {
		kind: "message",
		validate: isPlaceChatDelivery,
		handler: value => {
			if (connectionState !== 2) return;
			eventHandlers[25](value);
		}
	}], [27, {
		kind: "message",
		validate: isPunishment,
		handler: value => {
			if (connectionState !== 2) return;
			eventHandlers[26](value);
		}
	}], [28, {
		kind: "message",
		validate: isChatHistory,
		handler: value => {
			if (!(connectionState === 2 && (pendingChatHistories.get(value[3]) || 0) > 0)) return;
			const pending = pendingChatHistories.get(value[3]);
			if (pending === 1) pendingChatHistories.delete(value[3]);
			else pendingChatHistories.set(value[3], pending - 1);
			eventHandlers[27](value);
		}
	}], [29, {
		kind: "message",
		validate: isChallenge,
		handler: value => {
			if (!(connectionState === 2 && !challengePending)) return;
			challengePending = true;
			eventHandlers[28](value);
		}
	}], [30, {
		kind: "message",
		validate: isExternalCaptchaChallenge,
		handler: value => {
			if (!(connectionState === 2 && turnstile === null)) return;
			turnstile = { id: value[0], submitted: false };
			eventHandlers[29](value);
		}
	}], [31, {
		kind: "message",
		validate: value => value === undefined,
		handler: () => {
			if (!(connectionState === 2 && turnstile !== null && turnstile.submitted)) return;
			turnstile = null;
			eventHandlers[30]();
		}
	}], [32, {
		kind: "message",
		validate: isExternalCaptchaChallenge,
		handler: value => {
			if (!(connectionState === 2 && hcaptcha === null)) return;
			hcaptcha = { id: value[0], submitted: false };
			eventHandlers[31](value);
		}
	}], [33, {
		kind: "message",
		validate: value => value === undefined,
		handler: () => {
			if (!(connectionState === 2 && hcaptcha !== null && hcaptcha.submitted)) return;
			hcaptcha = null;
			eventHandlers[32]();
		}
	}], [34, {
		kind: "message",
		validate: isPlacerRegion,
		handler: value => {
			if (connectionState !== 2) return;
			const requestIndex = placerRequests.findIndex(request =>
				request[0] === value[0] &&
				value[1] <= request[1] && value[2] <= request[2]
			);
			if (requestIndex === -1) return;
			placerRequests.splice(requestIndex, 1);
			eventHandlers[33](value);
		}
	}], [35, {
		kind: "message",
		validate: isClientViewport,
		handler: value => {
			if (connectionState !== 2) return;
			eventHandlers[34](value);
		}
	}]]);
	/** @type {Map<number, import("shared-ipc").StrictOutgoingCommand>} */
	const outgoing = new Map([[0, {
		kind: "message",
		validate: isClientActivity
	}], [1, {
		kind: "message",
		validate: value => value === undefined
	}], [2, {
		kind: "message",
		validate: isConnectArgs
	}], [3, {
		kind: "message",
		validate: isDefaultCaptchaResult
	}], [5, {
		kind: "message",
		validate: isUint32
	}], [6, {
		kind: "message",
		validate: value => value === undefined
	}], [7, {
		kind: "message",
		validate: isNameRequest
	}], [8, {
		kind: "message",
		validate: isChatReactionRequest
	}], [9, {
		kind: "message",
		validate: isChatReport
	}], [10, {
		kind: "message",
		validate: isLiveChatSubmission
	}], [11, {
		kind: "message",
		validate: isPlaceChatSubmission
	}], [12, {
		kind: "message",
		validate: isChatHistoryRequest
	}], [13, {
		kind: "message",
		validate: isChallengeResult
	}], [14, {
		kind: "message",
		validate: isExternalCaptchaResult
	}], [15, {
		kind: "message",
		validate: isExternalCaptchaResult
	}], [16, {
		kind: "message",
		validate: isPlacerRegionRequest
	}], [17, {
		kind: "request",
		validate: value => value === undefined,
		validateResult: isLinkKey
	}], [18, {
		kind: "request",
		validate: isModAction,
		validateResult: value => typeof value === "string"
	}], [19, {
		kind: "message",
		validate: isCanvasPixelReport
	}], [20, {
		kind: "request",
		validate: isPixelPlacement,
		validateResult: value => typeof value === "boolean"
	}]]);
	let timeout;
	const timeoutPromise = new Promise((_, reject) => {
		timeout = setTimeout(reject, bootstrapTimeoutMs);
	});
	/** @type {(event: MessageEvent) => void} */
	const handleBootstrap = event => {
		channel.port1.removeEventListener("message", handleBootstrap);
		if (!isWorkerBootstrap(event.data)) {
			failBootstrap?.(new Error("Invalid worker bootstrap"));
			return;
		}
		completeBootstrap?.([event.data[1], event.data[2]]);
	};
	/** @type {((value: [number, number]) => void)|undefined} */
	let completeBootstrap;
	/** @type {((error: Error) => void)|undefined} */
	let failBootstrap;
	/** @type {Promise<[number, number]>} */
	const bootstrapPromise = new Promise((resolve, reject) => {
		completeBootstrap = resolve;
		failBootstrap = reject;
	});
	channel.port1.addEventListener("message", handleBootstrap);
	channel.port1.start();

	try {
		worker.postMessage([1, channelId], [channel.port2]);
		const sequenceStarts = await Promise.race([bootstrapPromise, timeoutPromise]);
		/** @param {{ reason: string, call?: import("shared-ipc").StrictIpcCommand }} rejection */
		const failSequence = rejection => {
			if (rejection.reason !== "invalid-sequence" || disposed) {
				return;
			}
			const priorState = connectionState;
			disposed = true;
			connectionState = 3;
			endpoint?.dispose("Game IPC integrity failure");
			worker.terminate();
			try {
				console.warn("Game IPC sequence integrity failure");
			}
			catch {
				// Diagnostics must not affect terminal enforcement.
			}
			if (priorState === 1 || priorState === 2) {
				eventHandlers[1]([1002, "Game IPC integrity failure"]);
			}
		};
		endpoint = createStrictIpcEndpoint(channel.port1, {
			channelId,
			incoming,
			outgoing,
			sendSequenceStart: sequenceStarts[0],
			receiveSequenceStart: sequenceStarts[1],
			onReject: failSequence
		});
		incoming.clear();
		outgoing.clear();
		await Promise.race([readyPromise, timeoutPromise]);
	}
	catch {
		channel.port1.removeEventListener("message", handleBootstrap);
		endpoint?.dispose("Game IPC bootstrap failed");
		channel.port1.close();
		worker.terminate();
		throw new Error("Game IPC bootstrap failed");
	}
	finally {
		clearTimeout(timeout);
	}

	return Object.freeze({
		/**
		 * @param {string} device
		 * @param {string|null} vip
		 */
		connect(device, vip) {
			if (disposed) {
				throw new Error("Game IPC endpoint is closed");
			}
			if (connectionState !== 0) {
				throw new Error("Game IPC connection already started");
			}
			/** @type {ConnectArgs} */
			const args = [device, server, vip];
			endpoint.send(2, args);
			connectionState = 1;
		},
		/** @param {ClientActivity} activity */
		reportAutomatedActivity(activity) {
			if (disposed) {
				throw new Error("Game IPC endpoint is closed");
			}
			if (connectionState !== 2) {
				throw new Error("Game IPC connection is not open");
			}
			endpoint.send(0, activity);
		},
		sendCaptchaResult(captchaId, result) {
			if (disposed) {
				throw new Error("Game IPC endpoint is closed");
			}
			const value = [captchaId, result];
			if (connectionState !== 2 || pendingCaptcha !== null ||
				!isDefaultCaptchaResult(value) || !outstandingCaptchas.has(captchaId)) {
				throw new Error("Default CAPTCHA response is not valid");
			}
			outstandingCaptchas.delete(captchaId);
			pendingCaptcha = captchaId;
			endpoint.send(3, value);
		},
		putPixel(position, colour) {
			if (disposed) {
				throw new Error("Game IPC endpoint is closed");
			}
			const value = [position, colour];
			if (connectionState !== 2 || !isPixelPlacement(value)) {
				throw new Error("Pixel placement is not valid");
			}
			return endpoint.request(20, value).catch(error => {
				// A timed-out reply cannot safely be retried on this IPC stream:
				// a late result would no longer have a matching pending request.
				if (!disposed) {
					disposed = true;
					connectionState = 3;
					endpoint.dispose("Placement acknowledgement failed");
					worker.terminate();
					eventHandlers[1]([1002, "Placement acknowledgement failed"]);
				}
				throw error;
			});
		},
		/** @param {number} userId */
		spectateUser(userId) {
			if (disposed) {
				throw new Error("Game IPC endpoint is closed");
			}
			if (connectionState !== 2 || !isUint32(userId)) {
				throw new Error("Spectate target is not valid");
			}
			endpoint.send(5, userId);
		},
		unspectateUser() {
			if (disposed) {
				throw new Error("Game IPC endpoint is closed");
			}
			if (connectionState !== 2 || spectatingId === null) {
				throw new Error("Game IPC is not spectating");
			}
			endpoint.send(6);
		},
		/** @param {string} name */
		setName(name) {
			if (disposed) {
				throw new Error("Game IPC endpoint is closed");
			}
			if (connectionState !== 2 || !isNameRequest(name)) {
				throw new Error("Chat name is not valid");
			}
			endpoint.send(7, name);
		},
		chatReact(messageId, reaction) {
			if (disposed) {
				throw new Error("Game IPC endpoint is closed");
			}
			const value = [messageId, reaction];
			if (connectionState !== 2 || !isChatReactionRequest(value)) {
				throw new Error("Chat reaction is not valid");
			}
			endpoint.send(8, value);
		},
		chatReport(messageId, reason) {
			if (disposed) throw new Error("Game IPC endpoint is closed");
			const value = [messageId, reason];
			if (connectionState !== 2 || !isChatReport(value)) {
				throw new Error("Chat report is not valid");
			}
			endpoint.send(9, value);
		},
		reportCanvasPixel(position, reason) {
			if (disposed) throw new Error("Game IPC endpoint is closed");
			const value = [position, reason];
			if (connectionState !== 2 || !isCanvasPixelReport(value)) {
				throw new Error("Canvas pixel report is not valid");
			}
			endpoint.send(19, value);
		},
		sendLiveChat(message, channel, replyId) {
			if (disposed) throw new Error("Game IPC endpoint is closed");
			const value = [message, channel, replyId];
			if (connectionState !== 2 || !isLiveChatSubmission(value)) {
				throw new Error("Live chat is not valid");
			}
			endpoint.send(10, value);
		},
		sendPlaceChat(message, position) {
			if (disposed) throw new Error("Game IPC endpoint is closed");
			const value = [message, position];
			if (connectionState !== 2 || !isPlaceChatSubmission(value)) {
				throw new Error("Place chat is not valid");
			}
			endpoint.send(11, value);
		},
		requestChatHistory(channel, anchorMsgId = 0, msgCount = 64) {
			if (disposed) throw new Error("Game IPC endpoint is closed");
			const value = [channel, anchorMsgId, msgCount];
			if (connectionState !== 2 || !isChatHistoryRequest(value)) {
				throw new Error("Chat history request is not valid");
			}
			endpoint.send(12, value);
			pendingChatHistories.set(channel,
				(pendingChatHistories.get(channel) || 0) + 1);
		},
		sendChallengeResult(result) {
			if (disposed) throw new Error("Game IPC endpoint is closed");
			if (connectionState !== 2 || !challengePending ||
				!isChallengeResult(result)) {
				throw new Error("Challenge result is not valid");
			}
			challengePending = false;
			endpoint.send(13, result);
		},
		sendTurnstileResult(captchaId, result) {
			if (disposed) throw new Error("Game IPC endpoint is closed");
			const value = [captchaId, result];
			if (connectionState !== 2 || turnstile === null ||
				turnstile.submitted || captchaId !== turnstile.id ||
				!isExternalCaptchaResult(value)) {
				throw new Error("Turnstile result is not valid");
			}
			turnstile.submitted = true;
			endpoint.send(14, value);
		},
		sendHCaptchaResult(captchaId, result) {
			if (disposed) throw new Error("Game IPC endpoint is closed");
			const value = [captchaId, result];
			if (connectionState !== 2 || hcaptcha === null ||
				hcaptcha.submitted || captchaId !== hcaptcha.id ||
				!isExternalCaptchaResult(value)) {
				throw new Error("hCaptcha result is not valid");
			}
			hcaptcha.submitted = true;
			endpoint.send(15, value);
		},
		requestPixelPlacers(position, width, height) {
			if (disposed) throw new Error("Game IPC endpoint is closed");
			const value = [position, width, height];
			if (connectionState !== 2 || !isPlacerRegionRequest(value)) {
				throw new Error("Placer-region request is not valid");
			}
			if (placerRequests.length === 64) placerRequests.shift();
			placerRequests.push(value);
			endpoint.send(16, value);
		},
		async fetchLinkKey() {
			if (disposed || connectionState !== 2) {
				throw new Error("Link key request is not valid");
			}
			const value = await endpoint.request(17);
			return { linkKey: value[0], instanceId: value[1] };
		},
		async sendModAction(value) {
			if (disposed || connectionState !== 2 || !isModAction(value)) {
				throw new Error("Moderation action is not valid");
			}
			return await endpoint.request(18, value);
		},
		stop() {
			if (disposed) {
				return;
			}
			disposed = true;
			try {
				endpoint.send(1);
			}
			finally {
				endpoint.dispose();
			}
		},
		dispose() {
			if (disposed) {
				return;
			}
			disposed = true;
			endpoint.dispose();
		}
	});
}
