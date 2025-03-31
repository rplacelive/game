import { DEFAULT_PALETTE_KEYS, PUNISHMENT_STATE, AUDIOS, MAX_CHANNEL_MESSAGES, CHAT_COLOURS, DEFAULT_PALETTE_USABLE_REGION, DEFAULT_PALETTE, DEFAULT_WIDTH, DEFAULT_HEIGHT, DEFAULT_COOLDOWN, COMMANDS } from "./defaults.js";
import { canvasLocked, chatName, COOLDOWN, cooldownEndDate, HEIGHT, initialConnect, intId, intIdNames, intIdPositions, online, PALETTE, PALETTE_USABLE_REGION, WIDTH } from "./game-state.js";
import { addChatMessages, addLiveChatMessage, addPlaceChatMessage, applyPunishment, boardAlreadyRendered, chatCancelReplies, cMessages, currentChannel, currentReply, generateIndicators, generatePalette, handleCaptchaSuccess, handleEmojiCaptcha, handleLiveChatCommand, handleTextCaptcha, handleTurnstile, handleTurnstileSuccess, lastMouseMove, mx, my, pos, preloadedBoard, renderAll, runLengthChanges, runLengthDecodeBoard, set, setCanvasLocked, setChatName, seti, setOnline, setSize, x, y } from "./index.js";
import { hideLoadingScreen, showLoadingScreen } from "./loading-screen.js";
import { DEFAULT_SERVER, lang, PublicPromise, translate, hash } from "./shared.js";

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
// TODO: Bring back
//if ("serviceWorker" in navigator) {
//	navigator.serviceWorker.register("./sw.js?v=5.0")
//}

// TODO: Make wscapsule return these functions instead for extra encapsulation
// Encapsulated & functions injected by wscapsule
/**@type {Function|null}*/export let fetchLinkKey = null;
/**@type {Function|null}*/export let setName = null;
/**@type {Function|null}*/export let requestPixelPlacers = null;
/**@type {((anchorMsgId:number, msgCount?:number)=>void)|null}*/export let requestLoadChannelPrevious = null;
/**@type {((messageId:number, senderId:number)=>void)|null}*/export let chatReport = null;
/**@type {Function|null}*/export let chatReact = null;
/**@type {((e: Event, x:number, y:number, colour:number)=>boolean)|null}*/export let tryPutPixel = null;
/**@type {((message:string)=>void)|null}*/ export let sendLiveChatMsg = null;
/**@type {((message:string)=>void)|null}*/ export let sendPlaceChatMsg = null;

export const wscapsule = ((send, addEventListener, call) => {
	let svUri = localStorage.server || DEFAULT_SERVER
	if (localStorage.vip) {
		if (!svUri.endsWith("/")) svUri += "/"
		svUri += localStorage.vip
	}
	const ws = new WebSocket(svUri)
	Object.defineProperty(window, 'WebSocket', {
		configurable: false,
		writable: false,
		value: class {
			constructor() {
				window.location.reload()
			}
		}
	})

	/**
	 * @param {number} messageId
	 * @param {any} senderId
	 */
	function _chatReport(messageId, senderId) {
		const reason = prompt("Enter the reason for why you are reporting this message (max 280 chars)\n\n" +
			`Additional info:\nMessage ID: ${messageId}\nSender ID: ${senderId}\n`)
		if (!reason || !reason.trim()) {
			return
		}
		const reportBuffer = encoder.encode("XXXXX" + reason)
		reportBuffer[0] = 14
		reportBuffer[1] = messageId >> 24
		reportBuffer[2] = messageId >> 16
		reportBuffer[3] = messageId >> 8
		reportBuffer[4] = messageId & 255
		call(send, ws, reportBuffer)
		alert("Report sent!\nIn the meantime you can block this user by 'right clicking / press hold on the message' > 'block'")
	}
	chatReport = _chatReport

	/**
	 * @param {number} messageId
	 * @param {string} reactKey
	 */
	function _chatReact(messageId, reactKey) {
		const reactBuffer = encoder.encode("XXXXX" + reactKey)
		reactBuffer[0] = 18
		reactBuffer[1] = messageId >> 24
		reactBuffer[2] = messageId >> 16
		reactBuffer[3] = messageId >> 8
		reactBuffer[4] = messageId & 255
		call(send, ws, reactBuffer)
	}
	chatReact = _chatReact

	/**
	 * @param {string} answer 
	 */
	function sendCaptchaResult(answer) {
		call(send, ws, encoder.encode("\x10" + answer))
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
			
			/**@type {number|null}*/let repliesTo = null;
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
					senderIntId
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
	
		/**@type {LiveChatMessage[]}*/const messages = [];
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
	
			messages.push(/**@type {LiveChatMessage}*/{
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

	ws.onopen = function(e) {
		initialConnect = true
		if (automated) {
			console.error("Unsupported environment. Connection can not be guarenteed")
			function reportUsage() {
				const activityBuffer = encoder.encode(`\x1eWindow outer width: ${window.outerWidth}\nWindow inner width: ${window.innerWidth}\n` +
					`Window outer height: ${window.outerHeight}\nWindow inner height: ${window.innerHeight}\nLast mouse move: ${new Date(lastMouseMove).toISOString()}\n` +
					`Mouse X (mx): ${mx}\nMouse Y (my): ${my}\nLocal storage: ${JSON.stringify(localStorage, null, 4)}`)
				call(send, ws, activityBuffer)
			}
			setInterval(reportUsage, 3e5) // 5 mins
			reportUsage()
		}
	}
	ws.onmessage = async function({data}) {
		delete sessionStorage.err
		data = new DataView(await data.arrayBuffer())

		switch (data.getUint8(0)) {
		case 0: {
			let pi = 1
			const paletteLength = data.getUint8(pi++)
			PALETTE = [...new Uint32Array(data.buffer.slice(pi, pi += paletteLength * 4))]
			PALETTE_USABLE_REGION.start = data.getUint8(pi++)
			PALETTE_USABLE_REGION.end = data.getUint8(pi++)
			generatePalette()
			const binds = (localStorage.paletteKeys || DEFAULT_PALETTE_KEYS)
			generateIndicators(binds)
			// Board might have already been drawn with old palette so we need to draw it again
			if (boardAlreadyRendered === true) {
				renderAll()
			}
			break
		}
		case 1: {
			cooldownEndDate = data.getUint32(1) * 1000 // Current cooldown
			COOLDOWN = data.getUint32(5)

			// New server packs canvas width and height in code 1, making it 17
			if (data.byteLength == 17) {
				const width = data.getUint32(9);
				const height = data.getUint32(13);
				WIDTH = width;
				HEIGHT = height;
				setSize(width, height);
				const board = await preloadedBoard
				if (board) {
					runLengthDecodeBoard(board, width * height);
					hideLoadingScreen();
				}
				// TODO: Handle else condition
			}
			break
		}
		case 2: {
			// Old server "changes" packet - preloadedBoard = http board, data = changes
			runLengthChanges(data, await preloadedBoard)
			hideLoadingScreen()
			break
		}
		case 3: { // Online
			online = data.getUint16(1);
			setOnline(online);
			break
		}
		case 5: { // Pixel with included placer
			let i = 1
			while (i < data.byteLength) {
				let position = data.getUint32(i); i += 4
				seti(position, data.getUint8(i)); i += 1
				intIdPositions.set(position, data.getUint32(i)); i += 4
			}
			break
		}
		case 6: { // Pixel without included placer
			let i = 0
			while (i < data.byteLength - 2) {
				seti(data.getUint32(i += 1), data.getUint8(i += 4))
			}
			break
		}
		case 7: { // Rejected pixel
			cooldownEndDate = data.getUint32(1) * 1000
			seti(data.getUint32(5), data.getUint8(9))
			break
		}
		case 8: { // Canvas restriction
			canvasLocked = !!data.getUint8(1);
			const reason = decoder.decode(data.buffer.slice(2))
			setCanvasLocked(canvasLocked, reason);
			break;
		}
		case 9: { // Placer info region
			let i = data.getUint32(1);
			const regionWidth = data.getUint8(5);
			const regionHeight = data.getUint8(6);

			let dataI = 7
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
			break
		}
		case 12: { // Name info
			for (let i = 1; i < data.byteLength;) {
				let pIntId = data.getUint32(i); i += 4;
				let pNameLen = data.getUint8(i); i++;
				let pName = decoder.decode(data.buffer.slice(i, (i += pNameLen)));

				intIdNames.set(pIntId, pName)
				// Occurs either if server has sent us name it has remembered from a previous session,
				// or we have just sent server packet 12 name update, and it is sending us back our name
				if (pIntId == intId) {
					chatName = pName;
					setChatName(chatName);
				}
			}
			break
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
			break
		}
		case 16: { // Captcha success
			handleCaptchaSuccess();
			break
		}
		case 17: {// Live chat delete
			const messageId = data.getUint32(1)
			for (const channel of cMessages.values()) {
				for (const messageEl of channel) {
					if (messageEl.messageId !== messageId) continue
					channel.splice(channel.indexOf(messageEl), 1)
					messageEl.remove()
				}
			}
			break
		}
		case 18: { // Live chat reaction
			const messageId = data.getUint32(1)
			const reactorId = data.getUint32(5)
			const reactionKey = decoder.decode(data.buffer.slice(9))
			for (const channel of cMessages.values()) {
				for (const messageEl of channel) {
					if (messageEl.messageId !== messageId) {
						continue
					}

					const currentReactions = messageEl.reactions
					const reactors = currentReactions?.get(reactionKey) || new Set()
					if (!reactors.has(reactorId)) {
						const newReactions = currentReactions ? new Map(currentReactions) : new Map()
						reactors.add(reactorId)
						newReactions.set(reactionKey, reactors)
						messageEl.reactions = newReactions
					}
				}
			}
			break
		}
		case 20: { // Text capcha
			const textsSize = data.getUint8(1)
			const texts = decoder.decode(new Uint8Array(data.buffer).slice(2, textsSize + 2)).split("\n");
			const imageData = new Uint8Array(data.buffer).slice(2 + textsSize);
			handleTextCaptcha(texts, imageData, sendCaptchaResult);
			break;
		}
		case 21: { // Math captcha
			console.error("Math captcha not yet supported. Ignoring.")
			break
		}
		case 22: { // Emoji captcha
			const emojisSize = data.getUint8(1)
			const emojis = decoder.decode(new Uint8Array(data.buffer).slice(2, emojisSize + 2)).split("\n")
			const imageData = new Uint8Array(data.buffer).slice(2 + emojisSize)
			handleEmojiCaptcha(emojis, imageData, sendCaptchaResult);
			break
		}
		case 23: { // Challenge
			let a=data.getUint32(1),b=5+a,c=data.buffer.slice(5,5+a),f=new Uint8Array(9),u=new DataView(f.buffer)
			;window.challengeData=new Uint8Array(data.buffer.slice(b));let d=await Object.getPrototypeOf(async function(){}).constructor(atob(decoder.decode(c)))()
			;delete window.challengeData;u.setUint8(0,23);u.setBigInt64(1,d);call(send,ws,u.buffer);
			break
		}
		case 24: { // Turnstile
			const siteKey = decoder.decode(data.buffer.slice(1));
			handleTurnstile(siteKey, (/**@type {string}*/token) => {
				call(send, ws, encoder.encode("\x18" + token));
			});
			break;
		}
		case 25: { // Turnstile success
			handleTurnstileSuccess();
			break
		}
		case 110: {
			const requestsLength = linkKeyRequests.length
			if (!requestsLength) {
				console.error("Could not resolve link key, no existing link key requests could be found")
				break
			}
			const instanceId = data.getUint32(1)
			const linkKey = decoder.decode(data.buffer.slice(5))
			linkKeyRequests[requestsLength - 1].resolve({ linkKey, instanceId })
			break
		}
		}
	}
	ws.onclose = async function(e) {
		console.error(e);
		cooldownEndDate = null;
		if (e.code == 1006 && !sessionStorage.err) {
			sessionStorage.err = "1";
			window.location.reload();
		}
		showLoadingScreen("disconnected", e.reason);
	}

	/**
	 * @type {any[]}
	 */
	let linkKeyRequests = []
	async function _fetchLinkKey() {
		const linkKeyRequest = new PublicPromise()
		linkKeyRequests.push(linkKeyRequest)
		call(send, ws, new Uint8Array([110]))
		const linkInfo = await linkKeyRequest.promise
		return linkInfo
	}
	fetchLinkKey = _fetchLinkKey
	window["fetchLinkKey"] = _fetchLinkKey

	/**
	 * @param {string | any[]} uname
	 */
	function _setName(uname) {
		if (uname.length > 16) return
		uname ||= "anon"

		const nameBuf = encoder.encode("\x0C" + uname)
		call(send, ws, nameBuf)
	}
	setName = _setName

	// Requests all the pixel placers for a given region from the server to be loaded into
	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} width
	 * @param {number} height
	 */
	function _requestPixelPlacers(x, y, width, height) {
		if (ws.readyState !== ws.OPEN) {
			return
		}
		const placerInfoBuf = new DataView(new Uint8Array(7).buffer)
		placerInfoBuf.setUint8(0, 9)
		placerInfoBuf.setUint32(1, x + y * WIDTH)
		placerInfoBuf.setUint8(5, width)
		placerInfoBuf.setUint8(6, height)
		call(send, ws, placerInfoBuf)
	}
	requestPixelPlacers = _requestPixelPlacers

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
	tryPutPixel = _tryPutPixel;

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

		const encodedChannel = encoder.encode(currentChannel)
		const encodedMsg = encoder.encode(message)

		let msgArray = new Uint8Array(1 + 1 + 2 + encodedMsg.byteLength + 1
			+ encodedChannel.byteLength + (currentReply ? 4 : 0))
		let msgView = new DataView(msgArray.buffer)

		let offset = 0;
		msgView.setUint8(offset++, 15)
		msgView.setUint8(offset++, 0) // type
		msgView.setUint16(offset, encodedMsg.byteLength) // msg length
		offset += 2
		msgArray.set(encodedMsg, offset)
		offset += encodedMsg.byteLength
		msgView.setUint8(offset, encodedChannel.byteLength)
		offset += 1
		msgArray.set(encodedChannel, offset)
		offset += encodedChannel.byteLength
		if (currentReply != null) {
			msgView.setUint32(offset, currentReply)
		}

		chatCancelReplies()
		call(send, ws, msgView)
	}
	sendLiveChatMsg = _sendLiveChatMsg;

	/**
	 * @param {string} message
	 */
	function _sendPlaceChatMsg(message) { // message put on the canvas
		const encodedMsg = encoder.encode(message)

		let msgArray = new Uint8Array(1 + 1 + 2 + encodedMsg.byteLength + 4)
		let msgView = new DataView(msgArray.buffer)
		let offset = 0
		msgView.setUint8(offset++, 15)
		msgView.setUint8(offset++, 1) // type
		msgView.setUint16(offset, encodedMsg.byteLength)
		offset += 2
		msgArray.set(encodedMsg, offset)
		offset += encodedMsg.byteLength
		msgView.setUint32(offset, Math.floor(y) * WIDTH + Math.floor(x))

		call(send, ws, msgView)
	}
	sendPlaceChatMsg = _sendPlaceChatMsg

	function _requestLoadChannelPrevious(anchorMsgId = 0, msgCount = 64) {
		const encChannel = encoder.encode(currentChannel);
		let view = new DataView(new Uint8Array(6 + encChannel.byteLength).buffer);
		view.setUint8(0, 13);
		view.setUint32(1, anchorMsgId);
		view.setUint8(5, msgCount|128); // 128 = before (most significant bit)
		for (let i = 0; i < encChannel.byteLength; i++) {
			view.setUint8(6 + i, encChannel[i]);
		}
		call(send, ws, view.buffer);
	}
	requestLoadChannelPrevious = _requestLoadChannelPrevious

	// TODO: Reimplement this
	const modOptionsButton = document.getElementById("modOptionsButton");
	call(addEventListener, modOptionsButton, "click", function() {
		alert ("Not implemented!")
		throw new Error("Moderation options not implemented")
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
	})

}).bind(undefined, WebSocket.prototype.send, addEventListener, btoa.call.bind(btoa.call));