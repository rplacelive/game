import { ADS, AUDIOS, CHAT_COLOURS, COMMANDS, CUSTOM_EMOJIS, DEFAULT_HEIGHT, DEFAULT_PALETTE_KEYS, DEFAULT_THEMES, DEFAULT_WIDTH, EMOJIS, LANG_INFOS, MAX_CHANNEL_MESSAGES, PUNISHMENT_STATE, DEFAULT_PALETTE_USABLE_REGION, DEFAULT_PALETTE, DEFAULT_COOLDOWN } from "./defaults.js"
import { DEFAULT_BOARD, DEFAULT_SERVER, lang, PublicPromise, translate, translateAll, hash, $, $$, stringToHtml, addMessageHandler } from "./shared.js"
import { showLoadingScreen, hideLoadingScreen } from "./loading-screen.js"
import { enableDarkplace, disableDarkplace } from "./darkplace.js"
import { enableWinter, disableWinter } from "./snowplace.js"
import { clearCaptchaCanvas, updateImgCaptchaCanvas, updateImgCaptchaCanvasFallback } from "./captcha-canvas.js"

// Ws Capsule
if(!("subtle" in (window.crypto || {}))) {
	location.protocol = "https:"
}
const automated = navigator.webdriver

// Types
/**
 * @typedef {Object} LiveChatMessage
 * @property {number} messageId
 * @property {string} txt
 * @property {number} senderIntId
 * @property {string} name
 * @property {number} sendDate
 * @property {Map<string, Set<number>>} reactions
 * @property {string} channel
 * @property {number|null} repliesTo
 */
/**
 * @typedef {Object} PlaceChatMessage
 * @property {number} msgPos
 * @property {string} txt
 * @property {number} senderIntId
 * @property {string} name
 */
/**
 * @typedef {Object} ChatPacket
 * @property {"live"|"place"} type
 * @property {LiveChatMessage|PlaceChatMessage} message
 * @property {string} [channel] - Only present for live chat
 */
/**
 * @typedef {Object} LiveChatHistoryPacket
 * @property {number} fromMessageId
 * @property {number} count
 * @property {boolean} before
 * @property {string} channel
 * @property {LiveChatMessage[]} messages
 */
/**
 * @typedef {Object} ModerationPacket
 * @property {number} state - The punishment state (mute/ban)
 * @property {number} startDate - Timestamp in milliseconds
 * @property {number} endDate - Timestamp in milliseconds
 * @property {string} reason - Reason for punishment
 * @property {string} appeal - Appeal status text
 */


// Utilities
const encoder = new TextEncoder()
const decoder = new TextDecoder()

// csrfstate not used at the moment, may be later to encode some extra info for client
let params = new URLSearchParams(location.search);
let csrfState = params.get("state");
let redditOauthCode = params.get("code");
let boardParam = params.get("board");
let serverParam = params.get("server");

if (boardParam && serverParam) {
	if (localStorage.server != serverParam || localStorage.board != boardParam) {
		localStorage.server = serverParam
		localStorage.board = boardParam
		history.pushState(null, "", location.origin)
		window.location.reload()
	}
}

// Register PWA Service worker
if ("serviceWorker" in navigator) {
	navigator.serviceWorker.register("./sw.js", {
		type: "module",
	});
}

// HTML Elements
const postsFrame = /**@type {HTMLIFrameElement}*/($("#postsFrame"));
const more = /**@type {HTMLElement}*/$("#more");
const spaceFiller = /**@type {HTMLElement}*/($("#spaceFiller"));
const mainContent = /**@type {HTMLElement}*/($("#maincontent"));
const canvParent1 = /**@type {HTMLElement}*/($("#canvparent1"));
const canvParent2 = /**@type {HTMLElement}*/($("#canvparent2"));
const canvSelect = /**@type {HTMLElement}*/($("#canvselect"));
const canvas = /**@type {HTMLCanvasElement}*/($("#canvas"));
const colours = /**@type {HTMLElement}*/($("#colours"));
const modal = /**@type {HTMLDialogElement}*/($("#modal"));
const modalInstall = /**@type {HTMLButtonElement}*/($("#modalInstall"));
const templateImage = /**@type {HTMLImageElement}*/($("#templateImage"));
const overlayMenu = /**@type {HTMLElement}*/($("#overlayMenu"));
const posEl = /**@type {HTMLElement}*/($("#posel"));
const idPosition = /**@type {HTMLElement}*/($("#idPosition"));
const onlineCounter = /**@type {HTMLElement}*/($("#onlineCounter"));
const canvasLock = /**@type {HTMLElement}*/($("#canvasLock"));
const namePanel = /**@type {HTMLElement}*/($("#namePanel"));
const muteButton = /**@type {HTMLButtonElement}*/($("#muteButton"));
const muteButtonImage = /**@type {HTMLImageElement}*/($("#muteButtonImage"));
const placeChatButton = /**@type {HTMLButtonElement}*/($("#placeChatButton"));
const placeChatButtonImage = /**@type {HTMLImageElement}*/($("#placeChatButtonImage"));
const placeButton = /**@type {HTMLButtonElement}*/($("#place")); 
const placeOkButton = /**@type {HTMLButtonElement}*/($("#pok"));
const placeCancelButton = /**@type {HTMLButtonElement}*/($("#pcancel"));
const palette = /**@type {HTMLElement}*/($("#palette"));
const channelDrop = /**@type {HTMLElement}*/($("#channelDrop"));
const channelDropParent = /**@type {HTMLElement}*/($("#channelDropParent"));
const channelEn = /**@type {HTMLElement}*/($("#channelEn"));
const channelMine = /**@type {HTMLElement}*/($("#channelMine"));
const channelMineButton = /**@type {HTMLButtonElement}*/($("#channelMineButton"));
const channelEnButton = /**@type {HTMLButtonElement}*/($("#channelEnButton"));
const channelMineName = /**@type {HTMLElement}*/($("#channelMineName"));
const channelMineImg = /**@type {HTMLImageElement}*/($("#channelMineImg"));
const chatMessages = /**@type {HTMLElement}*/($("#chatMessages"));
const chatPreviousButton = /**@type {HTMLButtonElement}*/($("#chatPreviousButton"));
const captchaOptions = /**@type {HTMLElement}*/($("#captchaOptions"));
const turnstileMenu = /**@type {HTMLElement}*/($("#turnstileMenu"));
const messageInput = /**@type {HTMLInputElement}*/($("#messageInput"));
const messageTypePanel = /**@type {HTMLElement}*/($("#messageTypePanel"));
const messageInputGifPanel = /**@type {HTMLElement}*/($("#messageInputGifPanel"));
const messageReplyPanel = /**@type {HTMLElement}*/($("#messageReplyPanel"));
const messageReplyLabel = /**@type {HTMLElement}*/($("#messageReplyLabel"));
const punishmentNote = /** @type {HTMLElement}*/($("#punishmentNote"));
const punishmentUserId = /** @type {HTMLElement}*/($("#punishmentUserId"));
const punishmentStartDate = /** @type {HTMLElement}*/($("#punishmentStartDate"));
const punishmentEndDate = /** @type {HTMLElement}*/($("#punishmentEndDate"));
const punishmentReason = /** @type {HTMLElement}*/($("#punishmentReason"));
const punishmentAppeal = /** @type {HTMLElement}*/($("#punishmentAppeal"));
const punishmentMenu = /** @type {HTMLElement}*/($("#punishmentMenu"));
const moderationMenu = /**@type {HTMLInputElement}*/($("#moderationMenu"));
const modMemberId = /**@type {HTMLInputElement}*/($("#modMemberId"));
const modMessageId = /**@type {HTMLInputElement}*/($("#modMessageId"));
const modMessagePreview = /**@type {HTMLInputElement}*/($("#modMessagePreview"));
const modDurationH = /**@type {HTMLInputElement}*/($("#modDurationH"));
const modDurationM = /**@type {HTMLInputElement}*/($("#modDurationM"));
const modDurationS = /**@type {HTMLInputElement}*/($("#modDurationS"));
const modAffectsAll = /**@type {HTMLInputElement}*/($("#modAffectsAll"));
const modReason = /**@type {HTMLInputElement}*/($("#modReason"));
const modCloseButton = /**@type {HTMLButtonElement}*/$("#modCloseButton");
const modCancelButtonn = /**@type {HTMLButtonElement}*/$("#modCancelButton");
const captchaPopup = /**@type {HTMLElement}*/($("#captchaPopup"));
const modActionDelete = /**@type {HTMLInputElement}*/($("#modActionDelete"));
const modActionKick = /**@type {HTMLInputElement}*/($("#modActionKick"));
const modActionMute = /**@type {HTMLInputElement}*/($("#modActionMute"));
const modActionBan = /**@type {HTMLInputElement}*/($("#modActionBan"));
const modActionCaptcha = /**@type {HTMLInputElement}*/($("#modActionCaptcha"));
const chatPanel = /**@type {HTMLElement}*/($("#chatPanel"));
const messageEmojisPanel = /**@type {HTMLElement}*/($("#messageEmojisPanel"));
const messageInputEmojiPanel = /**@type {HTMLElement}*/($("#messageInputEmojiPanel"));
const tlSelect = /**@type {HTMLElement}*/($("#tlSelect"));
const tlImage = /**@type {HTMLImageElement}*/($("#tlImage"));
const timelapsePanel = /**@type {HTMLElement}*/($("#timelapsePanel"));
const tlConfirm = /**@type {HTMLButtonElement}*/($("#tlConfirm"));
const tlStartSel = /**@type {HTMLSelectElement}*/($("#tlStartSel"));
const tlEndSel = /**@type {HTMLSelectElement}*/($("#tlEndSel"));
const tlTimer = /**@type {HTMLElement}*/($("#tlTimer"));
const tlFps = /**@type {HTMLInputElement}*/($("#tlFps"));
const tlPlayDir = /**@type {HTMLInputElement}*/($("#tlPlayDir"));
const overlayInput = /**@type {HTMLInputElement}*/($("#overlayInput"));
const chatContext = /**@type {HTMLElement}*/($("#chatContext"));
const userNote = /**@type {HTMLElement}*/($("#userNote"));
const mentionUser = /**@type {HTMLElement}*/($("#mentionUser"));
const replyUser = /**@type {HTMLElement}*/($("#replyUser"));
const blockUser = /**@type {HTMLElement}*/($("#blockUser"));
const changeMyName = /**@type {HTMLElement}*/($("#changeMyName"));
const connProblems = /**@type {HTMLElement}*/($("#connproblems"));
const chatAd = /**@type {HTMLAnchorElement}*/($("#chatAd"));
const chatCloseButton = /**@type {HTMLButtonElement}*/($("#chatCloseButton"));
const closeButton = /**@type {HTMLAnchorElement}*/($("#closebtn"));
const chatButton = /**@type {HTMLAnchorElement}*/($("#chatbtn"));
const messageOptionsButton = /**@type {HTMLAnchorElement}*/($("#messageOptionsButton"));
const themeDrop = /**@type {HTMLElement}*/($("#themeDrop"));
const themeDropName = /**@type {HTMLElement}*/($("#themeDropName"));
const themeDropParent = /**@type {HTMLElement}*/($("#themeDropParent"));

// WS & State variables
/**@type {Map<number, number>}*/ let intIdPositions = new Map(); // position : intId
/**@type {Map<number, string>}*/ export let intIdNames = new Map(); // intId : name
/**@type {any|null}*/ let account = null;
/**@type {number|null}*/ let intId = null;
/**@type {string|null}*/ let chatName = null;
/**@type {boolean}*/ let vasLocked = false; // Server will tell us this
/**@type {boolean}*/ let includesPlacer = false; // Server will tell us this
/**@type {boolean}*/ let initialConnect = false;
/**@type {number|null}*/ let cooldownEndDate = null;
/**@type {number}*/ let online = 1;
/**@type {boolean}*/ let canvasLocked = false;

// Readonly WS & State variables
let PALETTE_USABLE_REGION = DEFAULT_PALETTE_USABLE_REGION;
let PALETTE = DEFAULT_PALETTE;
let WIDTH = DEFAULT_WIDTH;
let HEIGHT = DEFAULT_HEIGHT;
let COOLDOWN = DEFAULT_COOLDOWN;

class WsCapsule {
	/**
	 * @param {Function} send 
	 * @param {Function} addEventListener 
	 * @param {Function} call 
	 */
	constructor(send, addEventListener, call) {
		// wscapsule logic
		let svUri = localStorage.server || DEFAULT_SERVER;
		if (localStorage.vip) {
			if (!svUri.endsWith("/")) svUri += "/";
			svUri += localStorage.vip;
		}
		const ws = new WebSocket(svUri);
		Object.defineProperty(window, 'WebSocket', {
			configurable: false,
			writable: false,
			value: class {
				constructor() {
					window.location.reload();
				}
			}
		});

		/**
		 * @param {number} messageId
		 * @param {any} senderId
		 */
		function _chatReport(messageId, senderId) {
			const reason = prompt("Enter the reason for why you are reporting this message (max 280 chars)\n\n" +
				`Additional info:\nMessage ID: ${messageId}\nSender ID: ${senderId}\n`);
			if (!reason || !reason.trim()) {
				return;
			}
			const reportBuffer = encoder.encode("XXXXX" + reason);
			reportBuffer[0] = 14;
			reportBuffer[1] = messageId >> 24;
			reportBuffer[2] = messageId >> 16;
			reportBuffer[3] = messageId >> 8;
			reportBuffer[4] = messageId & 255;
			call(send, ws, reportBuffer);
			alert("Report sent!\nIn the meantime you can block this user by 'right clicking / press hold on the message' > 'block'");
		}
		this.chatReport = _chatReport;

		/**
		 * @param {number} messageId
		 * @param {string} reactKey
		 */
		function _chatReact(messageId, reactKey) {
			const reactBuffer = encoder.encode("XXXXX" + reactKey);
			reactBuffer[0] = 18;
			reactBuffer[1] = messageId >> 24;
			reactBuffer[2] = messageId >> 16;
			reactBuffer[3] = messageId >> 8;
			reactBuffer[4] = messageId & 255;
			call(send, ws, reactBuffer);
		}
		this.chatReact = _chatReact;

		/**
		 * @param {string} answer
		 */
		function sendCaptchaResult(answer) {
			call(send, ws, encoder.encode("\x10" + answer));
		}

		/**
		 * @param {DataView<ArrayBuffer>} data
		 * @returns {ChatPacket}
		 */
		function parseChatPacket(data) {
			const decoder = new TextDecoder();
			let i = 1; // Skip opcode

			const msgType = data.getUint8(i); i++;
			const messageId = data.getUint32(i); i += 4;
			const txtLength = data.getUint16(i); i += 2;
			let txt = decoder.decode(data.buffer.slice(i, (i += txtLength)));
			const senderIntId = data.getUint32(i); i += 4;
			const name = intIdNames.get(senderIntId) || 'Unknown';

			if (msgType === 0) { // Live chat
				const sendDate = data.getUint32(i); i += 4;
				/**@type {Map<string, Set<number>>}*/ const reactions = new Map();
				const reactionsL = data.getUint8(i); i++;
				for (let j = 0; j < reactionsL; j++) {
					const reactionKeyL = data.getUint8(i); i++;
					const reactionKey = decoder.decode(data.buffer.slice(i, (i += reactionKeyL)));
					/** @type {Set<number>} */
					const reactors = new Set();
					const reactorsL = data.getUint32(i); i += 4;
					for (let k = 0; k < reactorsL; k++) {
						const reactor = data.getUint32(i); i += 4;
						reactors.add(reactor);
					}
					reactions.set(reactionKey, reactors);
				}
				const channelL = data.getUint8(i); i++;
				const channel = decoder.decode(data.buffer.slice(i, (i += channelL)));

				/**@type {number|null}*/ let repliesTo = null;
				if (data.byteLength - i >= 4) {
					repliesTo = data.getUint32(i);
				}

				return {
					type: "live",
					message: {
						messageId,
						txt,
						senderIntId,
						name,
						sendDate,
						reactions,
						channel,
						repliesTo
					},
					channel
				};
			}
			else { // Place chat
				const msgPos = data.getUint32(i);
				txt = txt.substring(0, 56);
				return {
					type: "place",
					message: {
						msgPos,
						txt,
						senderIntId,
						name
					}
				};
			}
		}

		/**
		 * @param {DataView<ArrayBuffer>} data
		 * @returns {LiveChatHistoryPacket}
		 */
		function parseLiveChatHistoryPacket(data) {
			const decoder = new TextDecoder();
			let i = 1; // Skip opcode
			const fromMessageId = data.getUint32(i); i += 4;
			const countByte = data.getUint8(i);
			const count = countByte & 0x7F;
			const before = (countByte >> 7) !== 0; i++;
			const channelLen = data.getUint8(i++);
			const channel = decoder.decode(data.buffer.slice(i, i += channelLen));

			/**@type {LiveChatMessage[]}*/ const messages = [];
			while (i < data.byteLength) {
				const startOffset = i;
				const messageLength = data.getUint16(i); i += 2;
				const messageId = data.getUint32(i); i += 4;
				const txtLen = data.getUint16(i); i += 2;
				const txt = decoder.decode(data.buffer.slice(i, i += txtLen));
				const intId = data.getUint32(i); i += 4;
				const sendDate = data.getUint32(i); i += 4;

				// Parse reactions
				const reactions = new Map();
				const reactionsL = data.getUint8(i++);
				for (let j = 0; j < reactionsL; j++) {
					const reactionKeyLen = data.getUint8(i++);
					const reactionKey = decoder.decode(data.buffer.slice(i, i += reactionKeyLen));
					const reactors = new Set();
					const reactorsL = data.getUint32(i); i += 4;
					for (let k = 0; k < reactorsL; k++) {
						const reactor = data.getUint32(i, false); // Big-endian
						i += 4;
						reactors.add(reactor);
					}
					reactions.set(reactionKey, reactors);
				}

				// Parse message's channel
				const messageChannelLen = data.getUint8(i++);
				const messageChannel = decoder.decode(data.buffer.slice(i, i += messageChannelLen));

				// Check for repliesTo
				let repliesTo = null;
				const bytesConsumed = i - startOffset;
				if (messageLength - (bytesConsumed - 2) === 4) {
					repliesTo = data.getUint32(i); i += 4;
				}

				messages.push(/**@type {LiveChatMessage}*/ {
					messageId,
					txt,
					senderIntId: intId,
					sendDate,
					reactions,
					channel: messageChannel,
					repliesTo,
					name: ""
				});
			}

			return { fromMessageId, count, before, channel, messages };
		}

		/**
		 * @param {DataView<ArrayBuffer>} data
		 * @returns {ModerationPacket}
		 */
		function parseModerationPacket(data) {
			const decoder = new TextDecoder();
			let i = 1; // Skip opcode

			const state = data.getUint8(i++);
			const startDate = data.getUint32(i) * 1000; i += 4;
			const endDate = data.getUint32(i) * 1000; i += 4;

			const reasonLen = data.getUint8(i++);
			const reason = decoder.decode(data.buffer.slice(i, i + reasonLen)); i += reasonLen;

			const appealLen = data.getUint8(i++);
			const appeal = decoder.decode(data.buffer.slice(i, i + appealLen)); i += appealLen;

			return { state, startDate, endDate, reason, appeal };
		}

		ws.onopen = function (e) {
			initialConnect = true;
			if (automated) {
				console.error("Unsupported environment. Connection can not be guarenteed");
				function reportUsage() {
					const activityBuffer = encoder.encode(`\x1eWindow outer width: ${window.outerWidth}\nWindow inner width: ${window.innerWidth}\n` +
						`Window outer height: ${window.outerHeight}\nWindow inner height: ${window.innerHeight}\nLast mouse move: ${new Date(lastMouseMove).toISOString()}\n` +
						`Mouse X (mx): ${mx}\nMouse Y (my): ${my}\nLocal storage: ${JSON.stringify(localStorage, null, 4)}`);
					call(send, ws, activityBuffer);
				}
				setInterval(reportUsage, 3e5); // 5 mins
				reportUsage();
			}
		};
		ws.onmessage = async function ({ data }) {
			delete sessionStorage.err;
			data = new DataView(await data.arrayBuffer());

			switch (data.getUint8(0)) {
				case 0: {
					let pi = 1;
					const paletteLength = data.getUint8(pi++);
					PALETTE = [...new Uint32Array(data.buffer.slice(pi, pi += paletteLength * 4))];
					PALETTE_USABLE_REGION.start = data.getUint8(pi++);
					PALETTE_USABLE_REGION.end = data.getUint8(pi++);
					generatePalette();
					const binds = (localStorage.paletteKeys || DEFAULT_PALETTE_KEYS);
					generateIndicators(binds);
					// Board might have already been drawn with old palette so we need to draw it again
					if (boardAlreadyRendered === true) {
						renderAll();
					}
					break;
				}
				case 1: {
					cooldownEndDate = data.getUint32(1) * 1000; // Current cooldown
					COOLDOWN = data.getUint32(5);

					// New server packs canvas width and height in code 1, making it 17
					if (data.byteLength == 17) {
						const width = data.getUint32(9);
						const height = data.getUint32(13);
						WIDTH = width;
						HEIGHT = height;
						setSize(width, height);
						const board = await preloadedBoard;
						if (board) {
							runLengthDecodeBoard(board, width * height);
							hideLoadingScreen();
						}
						// TODO: Handle else condition
					}
					break;
				}
				case 2: {
					// Old server "changes" packet - preloadedBoard = http board, data = changes
					const board = await preloadedBoard
					if (board) {
						runLengthChanges(data, board);
						hideLoadingScreen();
					}
					break;
				}
				case 3: { // Online
					online = data.getUint16(1);
					setOnline(online);
					break;
				}
				case 5: { // Pixel with included placer
					let i = 1;
					while (i < data.byteLength) {
						let position = data.getUint32(i); i += 4;
						seti(position, data.getUint8(i)); i += 1;
						intIdPositions.set(position, data.getUint32(i)); i += 4;
					}
					break;
				}
				case 6: { // Pixel without included placer
					let i = 0;
					while (i < data.byteLength - 2) {
						seti(data.getUint32(i += 1), data.getUint8(i += 4));
					}
					break;
				}
				case 7: { // Rejected pixel
					cooldownEndDate = data.getUint32(1) * 1000;
					seti(data.getUint32(5), data.getUint8(9));
					break;
				}
				case 8: { // Canvas restriction
					canvasLocked = !!data.getUint8(1);
					const reason = decoder.decode(data.buffer.slice(2));
					setCanvasLocked(canvasLocked, reason);
					break;
				}
				case 9: { // Placer info region
					let i = data.getUint32(1);
					const regionWidth = data.getUint8(5);
					const regionHeight = data.getUint8(6);

					let dataI = 7;
					while (dataI < data.byteLength) {
						for (let xi = i; xi < i + regionWidth; xi++) {
							const placerIntId = data.getUint32(dataI);
							if (placerIntId !== 0xFFFFFFFF) {
								intIdPositions.set(xi, placerIntId);
							}
							dataI += 4;
						}
						i += WIDTH;
					}
					break;
				}
				case 11: { // Player int ID
					// TODO: Integrate into packet 1
					intId = data.getUint32(1);
					break;
				}
				case 12: { // Name info
					for (let i = 1; i < data.byteLength;) {
						let pIntId = data.getUint32(i); i += 4;
						let pNameLen = data.getUint8(i); i++;
						let pName = decoder.decode(data.buffer.slice(i, (i += pNameLen)));

						intIdNames.set(pIntId, pName);
						// Occurs either if server has sent us name it has remembered from a previous session,
						// or we have just sent server packet 12 name update, and it is sending us back our name
						if (pIntId == intId) {
							chatName = pName;
							setChatName(chatName);
						}
					}
					break;
				}
				case 13: { // Live chat history
					const packetData = parseLiveChatHistoryPacket(data);
					if (packetData.channel !== currentChannel) {
						return;
					}
					addChatMessages(packetData.messages, packetData.before);
					break;
				}
				case 14: { // Moderation
					const packetData = parseModerationPacket(data);
					if (packetData.state === PUNISHMENT_STATE.ban) {
						canvasLocked = true;
					}
					applyPunishment(packetData, intId || 0);
					break;
				}
				case 15: { // Chat
					const packetData = parseChatPacket(data);
					if (packetData.type === "live") {
						addLiveChatMessage(
						/**@type {LiveChatMessage}*/(packetData.message),
							/**@type {string}*/(packetData.channel));
					}
					else {
						addPlaceChatMessage(
						/**@type {PlaceChatMessage}*/(packetData.message));
					}
					break;
				}
				case 16: { // Captcha success
					handleCaptchaSuccess();
					break;
				}
				case 17: { // Live chat delete
					const messageId = data.getUint32(1);
					for (const channel of cMessages.values()) {
						for (const messageEl of channel) {
							if (messageEl.messageId !== messageId) continue;
							channel.splice(channel.indexOf(messageEl), 1);
							messageEl.remove();
						}
					}
					break;
				}
				case 18: { // Live chat reaction
					const messageId = data.getUint32(1);
					const reactorId = data.getUint32(5);
					const reactionKey = decoder.decode(data.buffer.slice(9));
					for (const channel of cMessages.values()) {
						for (const messageEl of channel) {
							if (messageEl.messageId !== messageId) {
								continue;
							}

							const currentReactions = messageEl.reactions;
							const reactors = currentReactions?.get(reactionKey) || new Set();
							if (!reactors.has(reactorId)) {
								const newReactions = currentReactions ? new Map(currentReactions) : new Map();
								reactors.add(reactorId);
								newReactions.set(reactionKey, reactors);
								messageEl.reactions = newReactions;
							}
						}
					}
					break;
				}
				case 20: { // Text capcha
					const textsSize = data.getUint8(1);
					const texts = decoder.decode(new Uint8Array(data.buffer).slice(2, textsSize + 2)).split("\n");
					const imageData = new Uint8Array(data.buffer).slice(2 + textsSize);
					handleTextCaptcha(texts, imageData, sendCaptchaResult);
					break;
				}
				case 21: { // Math captcha
					console.error("Math captcha not yet supported. Ignoring.");
					break;
				}
				case 22: { // Emoji captcha
					const emojisSize = data.getUint8(1);
					const emojis = decoder.decode(new Uint8Array(data.buffer).slice(2, emojisSize + 2)).split("\n");
					const imageData = new Uint8Array(data.buffer).slice(2 + emojisSize);
					handleEmojiCaptcha(emojis, imageData, sendCaptchaResult);
					break;
				}
				case 23: { // Challenge
					let a = data.getUint32(1), b = 5 + a, c = data.buffer.slice(5, 5 + a), f = new Uint8Array(9), u = new DataView(f.buffer); window.challengeData = new Uint8Array(data.buffer.slice(b)); let d = await Object.getPrototypeOf(async function () { }).constructor(atob(decoder.decode(c)))(); delete window.challengeData; u.setUint8(0, 23); u.setBigInt64(1, d); call(send, ws, u.buffer);
					break;
				}
				case 24: { // Turnstile
					const siteKey = decoder.decode(data.buffer.slice(1));
					handleTurnstile(siteKey, (/**@type {string}*/ token) => {
						call(send, ws, encoder.encode("\x18" + token));
					});
					break;
				}
				case 25: { // Turnstile success
					handleTurnstileSuccess();
					break;
				}
				case 110: {
					const requestsLength = linkKeyRequests.length;
					if (!requestsLength) {
						console.error("Could not resolve link key, no existing link key requests could be found");
						break;
					}
					const instanceId = data.getUint32(1);
					const linkKey = decoder.decode(data.buffer.slice(5));
					linkKeyRequests[requestsLength - 1].resolve({ linkKey, instanceId });
					break;
				}
			}
		};
		ws.onclose = async function (e) {
			console.error(e);
			cooldownEndDate = null;
			if (e.code == 1006 && !sessionStorage.err) {
				sessionStorage.err = "1";
				window.location.reload();
			}
			showLoadingScreen("disconnected", e.reason);
		};

		/**
		 * @type {any[]}
		 */
		let linkKeyRequests = [];
		async function _fetchLinkKey() {
			const linkKeyRequest = new PublicPromise();
			linkKeyRequests.push(linkKeyRequest);
			call(send, ws, new Uint8Array([110]));
			const linkInfo = await linkKeyRequest.promise;
			return linkInfo;
		}
		this.fetchLinkKey = _fetchLinkKey;

		/**
		 * @param {string | any[]} uname
		 */
		function _setName(uname) {
			if (uname.length > 16) return;
			uname ||= "anon";

			const nameBuf = encoder.encode("\x0C" + uname);
			call(send, ws, nameBuf);
		}
		this.setName = _setName;

		// Requests all the pixel placers for a given region from the server to be loaded into
		/**
		 * @param {number} x
		 * @param {number} y
		 * @param {number} width
		 * @param {number} height
		 */
		function _requestPixelPlacers(x, y, width, height) {
			if (ws.readyState !== ws.OPEN) {
				return;
			}
			const placerInfoBuf = new DataView(new Uint8Array(7).buffer);
			placerInfoBuf.setUint8(0, 9);
			placerInfoBuf.setUint32(1, x + y * WIDTH);
			placerInfoBuf.setUint8(5, width);
			placerInfoBuf.setUint8(6, height);
			call(send, ws, placerInfoBuf);
		}
		this.requestPixelPlacers = _requestPixelPlacers;

		/**
		 * @param {Event} e
		 * @param {number} x
		 * @param {number} y
		 * @param {number} colour
		 */
		function _tryPutPixel(e, x, y, colour) {
			if (!e.isTrusted) {
				return false;
			}

			const pixelView = new DataView(new Uint8Array(6).buffer);
			pixelView.setUint8(0, 4);
			pixelView.setUint32(1, Math.floor(x) + Math.floor(y) * WIDTH);
			pixelView.setUint8(5, colour);
			call(send, ws, pixelView);
			cooldownEndDate = Date.now() + (localStorage.vip ? (localStorage.vip[0] == '!' ? 0 : COOLDOWN / 2) : COOLDOWN);
			return true;
		}
		this.tryPutPixel = _tryPutPixel;

		/**
		 * @param {string} message
		 */
		function _sendLiveChatMsg(message) {
			// Execute live chat commands
			for (const [command] of COMMANDS) {
				if (message.startsWith(":" + command)) {
					handleLiveChatCommand(command, message);
					return;
				}
			}

			// VIP key leak detection
			if (localStorage.vip && message.includes(localStorage.vip)) {
				alert("Can't send VIP key in chat. Use ':vip yourvipkeyhere' to apply a VIP key");
				return;
			}

			const encodedChannel = encoder.encode(currentChannel);
			const encodedMsg = encoder.encode(message);

			let msgArray = new Uint8Array(1 + 1 + 2 + encodedMsg.byteLength + 1
				+ encodedChannel.byteLength + (currentReply ? 4 : 0));
			let msgView = new DataView(msgArray.buffer);

			let offset = 0;
			msgView.setUint8(offset++, 15);
			msgView.setUint8(offset++, 0); // type
			msgView.setUint16(offset, encodedMsg.byteLength); // msg length
			offset += 2;
			msgArray.set(encodedMsg, offset);
			offset += encodedMsg.byteLength;
			msgView.setUint8(offset, encodedChannel.byteLength);
			offset += 1;
			msgArray.set(encodedChannel, offset);
			offset += encodedChannel.byteLength;
			if (currentReply != null) {
				msgView.setUint32(offset, currentReply);
			}

			chatCancelReplies();
			call(send, ws, msgView);
		}
		this.sendLiveChatMsg = _sendLiveChatMsg;

		/**
		 * @param {string} message
		 */
		function _sendPlaceChatMsg(message) {
			const encodedMsg = encoder.encode(message);

			let msgArray = new Uint8Array(1 + 1 + 2 + encodedMsg.byteLength + 4);
			let msgView = new DataView(msgArray.buffer);
			let offset = 0;
			msgView.setUint8(offset++, 15);
			msgView.setUint8(offset++, 1); // type
			msgView.setUint16(offset, encodedMsg.byteLength);
			offset += 2;
			msgArray.set(encodedMsg, offset);
			offset += encodedMsg.byteLength;
			msgView.setUint32(offset, Math.floor(y) * WIDTH + Math.floor(x));

			call(send, ws, msgView);
		}
		this.sendPlaceChatMsg = _sendPlaceChatMsg;

		function _requestLoadChannelPrevious(anchorMsgId = 0, msgCount = 64) {
			const encChannel = encoder.encode(currentChannel);
			let view = new DataView(new Uint8Array(6 + encChannel.byteLength).buffer);
			view.setUint8(0, 13);
			view.setUint32(1, anchorMsgId);
			view.setUint8(5, msgCount | 128); // 128 = before (most significant bit)
			for (let i = 0; i < encChannel.byteLength; i++) {
				view.setUint8(6 + i, encChannel[i]);
			}
			call(send, ws, view.buffer);
		}
		this.requestLoadChannelPrevious = _requestLoadChannelPrevious;

		// TODO: Reimplement this
		const modOptionsButton = document.getElementById("modOptionsButton");
		call(addEventListener, modOptionsButton, "click", function () {
			alert("Not implemented!");
			throw new Error("Moderation options not implemented");
			/*const reason = modReason.value.slice(0, 300)
			const encReason = encoder.encode(reason)*/
			// 0 - kick, 1 - mute, 2 - ban, 3 - captcha, 4 - delete
			/*/**@type {DataView<ArrayBuffer> | null}*\/let view = null
			let action = null
			let offset = 2
			let statusMsg = ""
			*/
			/**
			 * @param {number} extraLength
			 */
			/*function setModView(extraLength) {
				view = new DataView(new Uint8Array(2 + extraLength + encReason.byteLength).buffer)
				view.setUint8(0, 98)
			}*/
			/**
			 * @param {number} offset
			 */
			/*function setModReason(offset) {
				for (let ri = 0; ri < encReason.byteLength; ri++) {
					view.setUint8(offset + ri, encReason[ri])
				}
			}
	
			if (modActionKick.checked) {
				setModView(4)
				view.setUint8(1, 0)
				view.setUint32(2, modMemberId.value)
				setModReason(6)
				statusMsg = `Kicked player ${modMemberId.value} with reason '${reason}'`
			}
			else if (modActionMute.checked || modActionBan.checked) {
				const action = modActionMute.checked ? 1 : 2
				const seconds = (+modDurationS.value||0)
				const minutes = (+modDurationM.value||0)
				const hours = (+modDurationH.value||0)
				setModView(8)
				view.setUint8(1, action)
				view.setUint32(2, modMemberId.value)
				view.setUint32(6, seconds + minutes * 60 + hours * 3600)
				setModReason(10)
				statusMsg = `${["Kicked","Banned"][action-1]} player ${modMemberId.value} for ${hours
					} hours, ${minutes} minutes, and ${seconds} seconds with reason '${reason}'`
			}
			else if (modActionCaptcha.checked) {
				setModView(4)
				view.setUint8(1, 3)
				view.setUint32(2, modAffectsAll.checked ? 0 : modMemberId.value)
				setModReason(6)
				statusMsg = `Forced captcha for ${modAffectsAll.checked ? "all users" : "user " + modMemberId.value
					} with reason '${reason}'`
			}
			else if (modActionDelete.checked) {
				setModView(4)
				view.setUint8(1, 4)
				view.setUint32(2, modMessageId.value)
				setModReason(6)
				statusMsg = `Deleted message ${modMessageId.value} with reason '${reason}'`
			}
			else {
				return
			}
			call(send, ws, view.buffer)
			alert(statusMsg)*/
		});

		const injectedCjs = document.createElement("script");
		injectedCjs.innerHTML = `
			WebSocket.prototype.send = function() { this.close() };
			delete WebSocket;
			Object.defineProperty(window, "eval", {
				value: function() { throw new Error() },
				writable: false,
				configurable: false
			});
		`;
		document.body.appendChild(injectedCjs);
	}
}

// Touch & mouse canvas event handling
let moved = 3
/**@type {Touch|null}*/let touch1 = null
/**@type {Touch|null}*/let touch2 = null
let touchMoveDistance = 15

// Bidirectional IPC, similar to server.ts - db-worker.ts communication
// Methods called by posts frame
function resizePostsFrame() {
	if (!postsFrame) {
		return;
	}
	const calcHeight = postsFrame.contentWindow?.document.body.scrollHeight || 0;
	postsFrame.height = String(calcHeight);
	postsFrame.style.minHeight = calcHeight + "px";
}
postsFrame.addEventListener("load", resizePostsFrame);

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
	runAudio(AUDIOS.selectColour)
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
	canvas.width = WIDTH = w;
	canvas.height = HEIGHT = h;
	canvParent1.style.width = w + "px";
	canvParent1.style.height = h + "px";
	canvParent2.style.width = w + "px";
	canvParent2.style.height = h + "px";
	board = new Uint8Array(w * h).fill(255);
	let i = board.length;
	x = +localStorage.x || w / 2;
	y = +localStorage.y || h / 2;
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

				templateImage.src = URL.createObjectURL(new Blob([data], { type: overlayInfo.type }));
				overlayInfo.x = overlayInfo.x || 0;
				overlayInfo.y = overlayInfo.y || 0;
				templateImage.style.transform = `translate(${overlayInfo.x}px, ${overlayInfo.y}px)`;
				templateImage.style.opacity = String(overlayInfo.opacity || 0.8);
				x = overlayInfo.x;
				y = overlayInfo.y;
				z = Math.min(Math.max(z, minZoom), 1);
				pos();

				overlayMenu.setAttribute('opened', 'true');;
				break;
		}
	}
	onMainContentResize();
}

function onMainContentResize() {
	minZoom = Math.min(innerWidth / canvas.width, mainContent.offsetHeight / canvas.height) / 100;
	pos();
}

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
				instance.requestPixelPlacers(Math.max(intX - placersRadius / 2, 0), Math.max(intY - placersRadius / 2),
					Math.min(placersRadius, WIDTH - intX), Math.min(placersRadius, HEIGHT - intY))
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

export function setOnline(/**@type {Number}*/count) {
	onlineCounter.textContent = String(count);
	sendPostsFrameMessage("onlineCounter", count);
}

export function setCanvasLocked(/**@type {boolean}*/locked, /**@type {string|null}*/reason=null) {
	canvasLock.style.display = locked ? "flex" : "none";
	if (reason) {
		// TODO: Find a more elegant solution
		alert(reason);
	}
}

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
			runAudio(AUDIOS.invalid)
		}
		return
	}
	runAudio((cooldownEndDate||0) > Date.now() ? AUDIOS.invalid : AUDIOS.highlight)
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

// Modal settings (mute, place chat)
if (localStorage.muted !== "true") { // Prefer false
	localStorage.muted = "false";
}
if (localStorage.placeChat !== "false") { // Prefer true
	localStorage.placeChat = "true";
}
let muted = localStorage.muted === "true";
let placeChat = localStorage.placeChat === "true";
window.addEventListener("DOMContentLoaded", function() {
	muteButtonImage.src = muted ? "/svg/muted.svg" : "/svg/unmuted.svg";
	placeChatButtonImage.style.opacity = placeChat ? "1" : "0.6";
});
muteButton.addEventListener("click", function() {
	muted = !muted;
	localStorage.muted = +muted;
	muteButtonImage.src = muted ? "/svg/muted.svg" : "/svg/unmuted.svg";
});
placeChatButton.addEventListener("click", function() {
	placeChat = !placeChat
	localStorage.placeChat = String(placeChat)
	placeChatButtonImage.style.opacity = placeChat ? "1" : "0.6"
});

/**
 * @param {HTMLAudioElement} audio 
 */
export async function runAudio(audio) {
	if (muted) {
		return;
	}
	audio.currentTime = 0;
	await audio.play().catch((/** @type {any} */ e) => console.error(e));
}

// Client state
let onCooldown = false;
let PEN = -1;

let focused = true;
window.addEventListener("blur", () => {
	focused = false
});
window.addEventListener("focus", () => {
	focused = true
});


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
	if (!instance.tryPutPixel(e, x, y, PEN)) {
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
	runAudio(AUDIOS.cooldownStart)

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
		runAudio(AUDIOS.invalid)
	}
});

placeCancelButton.addEventListener("click", function(e) {
	if (!e.isTrusted) {
		return;
	}

	runAudio(AUDIOS.closePalette)
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
	const left = Math.floor(((cooldownEndDate||0) - Date.now()) / 1000);
	placeButton.innerHTML = initialConnect
		? cooldownEndDate === null // They have made initial connect
			? `<span style="color:#f50; white-space: nowrap;">${await translate("connectingFail")}</span>` // They connected but now have disconnected
			: left > 0
				? `<svg xmlns="http://www.w3.org/2000/svg" data-name="icons final" viewBox="0 0 20 20" style="height: 1.1rem;vertical-align:top"><path d="M13.558 14.442l-4.183-4.183V4h1.25v5.741l3.817 3.817-.884.884z"></path><path d="M10 19.625A9.625 9.625 0 1119.625 10 9.636 9.636 0 0110 19.625zm0-18A8.375 8.375 0 1018.375 10 8.384 8.384 0 0010 1.625z"></path></svg> ${
						("" + Math.floor(left/3600)).padStart(2, "0")}:${("" + Math.floor((left / 60)) % 60).padStart(2, "0")}:${("" + left % 60).padStart(2, "0")}` // They are connected + still connected but in cooldown
				: await translate("placeTile") // They are connected + still connected + after cooldown
		: await translate("connecting") // They are yet to connect

	if ((cooldownEndDate||0) > Date.now() && !onCooldown) {
		onCooldown = true;
	}
	if ((cooldownEndDate||0) < Date.now() && onCooldown) {
		onCooldown = false;
		if (!document.hasFocus()) {
			runAudio(AUDIOS.cooldownEnd)
		}
	}
}, 200)

function showPalette() {
	palette.style.transform = "";
	runAudio(AUDIOS.highlight);
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
		return;
	}
	const i = parseInt(clickedColour.dataset.index);
	if (Number.isNaN(i) || i < PALETTE_USABLE_REGION.start || i >= PALETTE_USABLE_REGION.end) {
		return;
	}
	for (let i = 0; i < colours.children.length; i++) {
		const colour = colours.children[i];
		colour.classList.remove("sel");
	}
	PEN = i;
	canvSelect.style.background = clickedColour.style.background;
	clickedColour.classList.add("sel");
	placeOkButton.classList.add("enabled");
	canvSelect.children[0].style.display = "none";
	canvSelect.style.outline = "8px white solid";
	canvSelect.style.boxShadow = "0px 2px 4px 0px rgb(0 0 0 / 50%)";
	hideIndicators();
	runAudio(AUDIOS.selectColour);
}

/**
 * @param {DataView<ArrayBuffer>} data
 * @param {any} buffer
 */
export function runLengthChanges(data, buffer) {
	let i = 9;
	let boardI = 0;
	let w = data.getUint32(1);
	let h = data.getUint32(5);
	if (w != WIDTH || h != HEIGHT) {
		setSize(w, h);
	}
	board = new Uint8Array(buffer);
	while (i < data.byteLength) {
		let cell = data.getUint8(i++);
		let c = cell >> 6;
		if (c == 1) c = data.getUint8(i++);
		else if (c == 2) c = data.getUint16(i++), i++;
		else if (c == 3) c = data.getUint32(i++), i += 3;
		boardI += c;
		board[boardI++] = cell & 63;
	}
	renderAll();
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

// Live chat channels

function initChannelDrop() {
	let containsMy = false

	channelDrop.children[0].innerHTML = ""
	for (let [code, info] of LANG_INFOS) {
		if (code == lang) containsMy = true
		let el = document.createElement("li")
		el.innerHTML = `<span>${info.name}</span> <img src="${info.flag}" style="height: 24px;">`
		el.dataset.lang = code
		channelDrop.children[0].appendChild(el)
	}

	if (!containsMy) {
		let el = document.createElement("li")
		el.innerHTML = `<span>${lang}</span>`
		el.dataset.lang = lang
		channelDrop.children[0].appendChild(el)
	}
}

const channelList = channelDrop.firstElementChild
channelList?.addEventListener("click", function(e) {
	let target = e.target
	while (target instanceof HTMLElement && target != channelList) {
		if (target.nodeName != "LI") {
			target = target.parentElement;
			continue;
		}

		const lang = target.dataset.lang
		if (!lang) {
			break;
		}
		if (lang != extraLanguage && lang != "en") {
			extraChannel(lang);
		}
		switchLanguageChannel(lang);
		e.stopPropagation();
		channelDropParent.removeAttribute("open");
		break;
	}
});

channelMineButton.addEventListener("click", function(e) {	
	switchLanguageChannel(extraLanguage);
});

channelEnButton.addEventListener("click", function(e) {
	switchLanguageChannel("en");
});

/**
 * @param {string} code
 */
function extraChannel(code) {
	let info = LANG_INFOS.get(code)
	channelMineName.innerText = code.toUpperCase()
	channelMineImg.src = info?.flag || "/svg/flag-unknown.svg";
	//channelMineImg.style.display = ((info?.flag) ? "inline" : "none")
	extraLanguage = code
	cMessages.set(code, cMessages.get(code) || [])
}


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
	else if (instance) {
		// If we don't have any cached messages for this channel, try pre-populate with a few
		const oldestMessage = /**@type {import("./live-chat-elements.js").LiveChatMessage|null}*/(chatMessages.children[0])
		instance.requestLoadChannelPrevious(oldestMessage?.messageId || 0, 32)
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
 * @param {LiveChatMessage[]} messages 
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
		if (chatPreviousAutoLoad === true && chatPreviousLoadDebounce === false) {
			const oldestMessage = /**@type {import("./live-chat-elements.js").LiveChatMessage|null}*/(chatMessages.children[0]);
			instance.requestLoadChannelPrevious(oldestMessage?.messageId || 0);
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
	const oldestMessage = /**@type {import("./live-chat-elements.js").LiveChatMessage|null}*/(chatMessages.children[0]);
	instance.requestLoadChannelPrevious(oldestMessage?.messageId || 0);
	chatPreviousLoadDebounce = true;
	// Keep loading previous for this channel as they scroll up
	chatPreviousAutoLoad = true	;
})

/**
 * @param {LiveChatMessage} message 
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
			runAudio(AUDIOS.closePalette);
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
 * @param {PlaceChatMessage} message
 */
export function addPlaceChatMessage(message) {
	if (!placeChat) {
		return
	}

	console.log(message)

	// Create message
	const placeMessage = document.createElement("placechat")
	placeMessage.innerHTML = `<span title="${(new Date()).toLocaleString()}" style="color: ${CHAT_COLOURS[hash("" + message.senderIntId) & 7]};">[${message.name}]</span><span>${message.txt}</span>`
	placeMessage.style.left = (message.msgPos % WIDTH) + "px"
	placeMessage.style.top = (Math.floor(message.msgPos / WIDTH) + 0.5) + "px"
	canvParent2.appendChild(placeMessage)

	//Remove message after given time
	setTimeout(() => {
		placeMessage.remove();
	}, localStorage.placeChatTime || 7e3)
}


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

messageInput.addEventListener("keydown", function(/**@type {KeyboardEvent}*/ e) {
	if (!e.isTrusted) {
		return
	}

	openChatPanel();
	if (e.key == "Enter" && !e.shiftKey) {
		// ctrl + enter send as place chat, enter send as normal live chat
		if (e.ctrlKey) {
			instance.sendPlaceChatMsg(messageInput.value)
		}
		else {
			instance.sendLiveChatMsg(messageInput.value)
		}
		e.preventDefault()
		messageInput.value = ""
		updateMessageInputHeight()
	}
});
messageInput.addEventListener("focus", openChatPanel);

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

messageTypePanel.children[0].addEventListener("click", function (/**@type {Event}*/e) {
	if (!e.isTrusted) {
		return;
	}

	instance.sendPlaceChatMsg(messageInput.value);
	messageInput.value = "";
});
messageTypePanel.children[1].addEventListener("click", function(/**@type {Event}*/e) {
	if (!e.isTrusted) {
		return;
	}

	instance.sendLiveChatMsg(messageInput.value);
	messageInput.value = "";	
});

// @ts-expect-error
messageInputGifPanel.addEventListener("gifselection", function(/**@type {CustomEvent}*/ e) {
	const gif = e.detail;
	if (!gif) {
		return;
	}
	messageInputGifPanel.removeAttribute("open")
	instance.sendLiveChatMsg(`[gif:${gif.id}:tenor]`);
});


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
	// TODO: Use CSS classes / find a better solution
	// HACK: Ensure no overlap between reply and send features
	messageTypePanel.style.height = "calc(var(--message-input-height) + 62px)"
	messageReplyPanel.setAttribute('closed', 'true')
}


/**
 * @param {ModerationPacket} packet 
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

// Moderation UI

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
modCloseButton.addEventListener("click", closeChatModerate);
modCancelButtonn.addEventListener("click", closeChatModerate);

export function handleCaptchaSuccess() {
	captchaPopup.style.display = "none";
}


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
window.addEventListener("DOMContentLoaded", function (e) {
	updateMessageInputHeight();
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

function defaultServer() {
	delete localStorage.board;
	delete localStorage.server;
	delete localStorage.vip;

	// Handle URL cleanup and page refresh
	const baseUrl = location.toString().split("?")[0];
	if (location.toString().includes("?")) {
		location.replace(baseUrl);
	}
	else {
		location.reload();
	}
}

/**
 * @param {string} serverAddress
 * @param {string} boardAddress
 * @param {string} vip
 * @param {Storage} storage
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
		await theme(/**@type {import("./defaults.js").ThemeInfo}*/(DEFAULT_THEMES.get(forceTheme)), forceVariant, forceEffects)
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
		intermediate.href = "/css/theme-switch.css";
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
		setTimeout(() => document.head.removeChild(intermediate), 200);
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
window.addEventListener("DOMContentLoaded", function(e) {
	let startupThemeSet = DEFAULT_THEMES.get(localStorage.theme || "r/place 2022");
	if (!startupThemeSet) {
		startupThemeSet = DEFAULT_THEMES.get("r/place 2022");
	}
	if (startupThemeSet) {
		theme(startupThemeSet, localStorage.variant, localStorage.effects);
		themeDropName.textContent = "🖌️ " + (localStorage.theme || "r/place 2022");		
	}
	else {
		const errorMessage = "Error: Can't find startup theme set, site may appear broken!";
		console.error(errorMessage, { availableThemes: DEFAULT_THEMES, savedTheme: localStorage.theme });
		alert(errorMessage);
	}
});

const themeDropList = themeDrop.firstElementChild;
themeDropList?.addEventListener("click", function(e) {
	let target = e.target;
	while (target instanceof HTMLElement && target != themeDropList) {
		if (target.nodeName != "LI") {
			target = target.parentElement;
			continue;
		}
		let targetEffects = target.getAttribute("effects");
		let targetVariant = target.getAttribute("variant");
		let targetTheme = target.getAttribute("theme");
		themeDropParent.removeAttribute("open");
		e.stopPropagation();

		if (targetTheme) {
			themeDropName.textContent = '🖌️ ' + targetTheme;
			const newTheme = DEFAULT_THEMES.get(targetTheme);
			if (newTheme) {
				theme(newTheme, targetVariant, targetEffects);
				localStorage.theme = targetTheme;
				localStorage.variant = targetVariant;
				localStorage.effects = targetEffects;
			}
		}
		break;
	}
});

/**
 * @param {number} num
 * @param {number} min
 * @param {number} max
 */
function clamp(num, min, max) {
	return Math.min(Math.max(num, min), max);
}


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
chatButton.addEventListener("click", openChatPanel);

messageOptionsButton.addEventListener("click", function(e) {
	updateMessageInputHeight();
	messageTypePanel.toggleAttribute('closed')
})

// Chat panel
chatCloseButton.addEventListener("click", closeChatPanel);

function closeChatPanel() {
	messageInput.blur()
	messageInputEmojiPanel.removeAttribute("open")
	messageInputGifPanel.removeAttribute("open")
	chatPanel.removeAttribute("open")
	chatPanel.inert = true
}
closeChatPanel()

// Close button / space filler transition to posts view
const mainContentObserver = new ResizeObserver((entries) => {
	onMainContentResize();
});
mainContentObserver.observe(mainContent);

closeButton.addEventListener("click", function() {
	modal.close();
	closeChatPanel();
	document.body.id = "out";
	onMainContentResize();
})

spaceFiller.addEventListener("click", function() {
	if (document.body.id != "out") {
		return;
	}
	document.body.id = "";
	onMainContentResize();
})

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
	if (connProblems) {
		connProblems.style.opacity = "1";
	}
}, 5000)

// Ads
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
// WsCapsule logic
/**@type {WsCapsule}*/var instance = new WsCapsule(
	WebSocket.prototype.send,
	addEventListener,
	Function.prototype.call.bind(Function.prototype.call)	
);
/**@type {(messageId:number, senderId:number)=>void}*/export let chatReport = (/**@type {number}*/messageId, /**@type {number}*/senderId) => instance.chatReport(messageId, senderId);
/**@type {(messageId:number, reaction:string)=>void}*/export let chatReact = (/**@type {number}*/ messageId, /**@type {string}*/reaction) => instance.chatReact(messageId, reaction);
// Hook up cross frame / parent window IPC request handlers
addMessageHandler("fetchLinkKey", instance.fetchLinkKey);
addMessageHandler("openChatPanel", openChatPanel);
addMessageHandler("scrollToPosts", scrollToPosts);
addMessageHandler("defaultServer", defaultServer);
addMessageHandler("openOverlayMenu", openOverlayMenu);
addMessageHandler("resizePostsFrame", resizePostsFrame);

// Blank default render and canvas size init before we have loaded board
setSize(DEFAULT_WIDTH, DEFAULT_HEIGHT);
renderAll();
if (chatName) {
	namePanel.style.visibility = "hidden"
}