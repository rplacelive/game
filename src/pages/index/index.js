import { DEFAULT_BOARD, DEFAULT_SERVER, ADS,  COMMANDS, CUSTOM_EMOJIS, DEFAULT_HEIGHT, DEFAULT_PALETTE_KEYS, DEFAULT_THEMES, DEFAULT_WIDTH, EMOJIS, LANG_INFOS, MAX_CHANNEL_MESSAGES, PUNISHMENT_STATE, PLACEMENT_MODE, RENDERER_TYPE } from "../../defaults.js";
import { lang, translate, translateAll, $, stringToHtml, blobToBase64, base64ToBlob, toCapitalised }  from "../../shared.js";
import { showLoadingScreen, hideLoadingScreen } from "./loading-screen.js";
import { clearCaptchaCanvas, updateImgCaptchaCanvas, updateImgCaptchaCanvasFallback } from "./captcha-canvas.js";
import { boardRenderer, canvasCtx, zoomIn, moveTo, setPlaceChatPosition, setMinZoom, pos, x, y, z, minZoom, setX, setY, setZ, setViewportRenderer } from "./viewport.js";
import { placeChat } from "./game-settings.js";
import { runAudio, playSample, getNaturalNotes, selectColourSample } from "./game-audio.js";
import { enableMelodicPalette, enableNewOverlayMenu } from "./secret-settings.js";
import { AUDIOS } from "./game-defaults.js";
import { addIpcMessageHandler, handleIpcMessage, sendIpcMessage, makeIpcRequest } from "shared-ipc";
import { openOverlayMenu } from "./overlay-menu.js";
import { TurnstileWidget } from "../../services/turnstile-manager.js";
import { theme } from "./game-themes.js";
import { BOARD, canvasLocked, CHANGES, chatName, connectStatus, COOLDOWN, cooldownEndDate, HEIGHT, intId, intIdNames, intIdPositions, onCooldown, PALETTE, PALETTE_USABLE_REGION, passkeyAuthState, placementMode, RAW_BOARD, setCooldown, setPasskeyAuthState, setPlacementMode, SOCKET_PIXELS, supportsCanvasPixelReports, WIDTH, placePixel, sendDefaultCaptchaResult, sendServerMessage, setDefaultCaptchaHandlers, makeServerRequest, connect } from "./game-state.js";
import { generateIndicators, generatePalette, hideIndicators, showPalette } from "./palette.js";
import { authenticatePasskey, getPasskeyStatus, registerPasskey, supportsPasskeys } from "./passkeys.js";
import { findMentionQuery, findTextEdit, formatMention, isMention, normaliseBlockedUsers,
	isBlocked, rebaseMentionTokens, serialiseMentionTokens } from "./chat-helpers.js";
import "./popup.js";

import FingerprintJS from "@fingerprintjs/fingerprintjs";
import DisableDevtool from "disable-devtool";
import { BoardRendererSphere } from "./board-renderer-sphere.js";
import { getOwnPunishments, listPunishments, resolvePunishmentAppeal, sendModerationAction, submitPunishmentAppeal } from "./moderation-api.js";
import { enablePopoverDismissal, hidePopover, isPopoverOpen, positionPopover, showPopover } from "./popover.js";

if (import.meta.env.PROD) {
	DisableDevtool({
		md5: "60961bf94b2a5d69f98efa9c2ab2caf9",
		disableMenu: false
	})
}

const params = new URLSearchParams(window.location.search);
const boardParam = params.get("board");
const serverParam = params.get("server");
if (boardParam && serverParam) {
	if (localStorage.server != serverParam || localStorage.board != boardParam) {
		localStorage.server = serverParam;
		localStorage.board = boardParam;
		history.pushState(null, "", location.origin);
		window.location.reload();
	}
}
const debugParam = params.get("debug");
if (debugParam) {
	alert("Debug mode active: Errors will be output in alerts.");

	window.addEventListener("unhandledrejection", (e) => {
		prompt("Received window unhandledRejection event", JSON.stringify({
			type: e.type,
			reason: e.reason
		}, null, 2));
	});
	window.addEventListener("error", (e) => {
		prompt("Received window error event", JSON.stringify({
			type: e.type,
			error: e.error,
			message: e.message
		}, null, 2));
	});
}

// HTML Elements
const postsFrame = /**@type {HTMLIFrameElement}*/($("#postsFrame"));
const more = /**@type {HTMLElement}*/($("#more"));
const spaceFiller = /**@type {HTMLElement}*/($("#spaceFiller"));
const mainContent = /**@type {HTMLElement}*/($("#maincontent"));
const viewport = /**@type {HTMLElement}*/($("#viewport"));
const viewportCanvas = /**@type {HTMLCanvasElement}*/($("#viewportCanvas"));
const canvParent1 = /**@type {HTMLElement}*/($("#canvparent1"));
const canvParent2 = /**@type {HTMLElement}*/($("#canvparent2"));
const canvSelect = /**@type {HTMLElement}*/($("#canvselect"));
const canvSelectImage = /**@type {HTMLImageElement}*/($("#canvSelectImage"));
const canvas = /**@type {HTMLCanvasElement}*/($("#canvas"));
const placeChatMessages = /**@type {HTMLElement}*/($("#placeChatMessages"));
const colours = /**@type {HTMLElement}*/($("#colours"));
const modal = /**@type {HTMLDialogElement}*/($("#modal"));
const modalCloseButton = /**@type {HTMLButtonElement}*/($("#modalCloseButton")); 
const modalInstallButton = /**@type {HTMLButtonElement}*/($("#modalInstallButton"));
const modalCopyrightButton = /**@type {HTMLButtonElement}*/($("#modalCopyrightButton"));
const placerInfoDialog = /**@type {HTMLDialogElement}*/($("#placerInfoDialog"));
const placerInfoCloseButton = /**@type {HTMLElement}*/($("#placerInfoCloseButton"));
const placerInfoStatus = /**@type {HTMLElement}*/($("#placerInfoStatus"));
const placerInfoDetails = /**@type {HTMLElement}*/($("#placerInfoDetails"));
const placerInfoPosition = /**@type {HTMLElement}*/($("#placerInfoPosition"));
const placerInfoName = /**@type {HTMLElement}*/($("#placerInfoName"));
const placerInfoUserId = /**@type {HTMLElement}*/($("#placerInfoUserId"));
const canvasReportDialog = /**@type {HTMLDialogElement}*/($("#canvasReportDialog"));
const canvasReportForm = /**@type {HTMLFormElement}*/($("#canvasReportForm"));
const canvasReportCloseButton = /**@type {HTMLElement}*/($("#canvasReportCloseButton"));
const canvasReportPosition = /**@type {HTMLElement}*/($("#canvasReportPosition"));
const canvasReportReason = /**@type {HTMLTextAreaElement}*/($("#canvasReportReason"));
const canvasReportLimit = /**@type {HTMLElement}*/($("#canvasReportLimit"));
const canvasReportStatus = /**@type {HTMLElement}*/($("#canvasReportStatus"));
const canvasReportSubmitButton = /**@type {HTMLButtonElement}*/($("#canvasReportSubmitButton"));
const canvasReportCancelButton = /**@type {HTMLButtonElement}*/($("#canvasReportCancelButton"));
const templateImage = /**@type {HTMLImageElement}*/($("#templateImage"));
const overlayMenuOld = /**@type {HTMLElement}*/($("#overlayMenuOld"));
const overlayMenuOldCloseButton = /**@type {HTMLElement}*/($("#overlayMenuOldCloseButton"));
const onlineCounter = /**@type {HTMLElement}*/($("#onlineCounter"));
const canvasLock = /**@type {HTMLElement}*/($("#canvasLock"));
const lockMessageLabel = /**@type {HTMLElement}*/($("#lockMessageLabel"));
const namePanel = /**@type {HTMLElement}*/($("#namePanel"));
const namePanelCloseButton = /**@type {HTMLButtonElement}*/($("#namePanelCloseButton"));
const nameInput = /**@type {HTMLInputElement}*/(document.getElementById("nameInput"));
const placeButton = /**@type {HTMLButtonElement}*/($("#place"));
const placeOkButton = /**@type {HTMLButtonElement}*/($("#pok"));
const placeCancelButton = /**@type {HTMLButtonElement}*/($("#pcancel"));
const palette = /**@type {HTMLElement}*/($("#palette"));
const channelButton = /**@type {HTMLButtonElement}*/($("#channelButton"));
const channelDropMenu = /**@type {HTMLElement}*/($("#channelDropMenu"));
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
const passkeyMenu = /**@type {HTMLElement}*/($("#passkeyMenu"));
const passkeyMenuTitle = /**@type {HTMLElement}*/($("#passkeyMenuTitle"));
const passkeyMenuMessage = /**@type {HTMLElement}*/($("#passkeyMenuMessage"));
const passkeyMenuButton = /**@type {HTMLButtonElement}*/($("#passkeyMenuButton"));
const messageInput = /**@type {HTMLTextAreaElement}*/($("#messageInput"));
const messageInputMirror = /**@type {HTMLElement}*/($("#messageInputMirror"));
const messageTypePanel = /**@type {HTMLElement}*/($("#messageTypePanel"));
const messageInputGifPanel = /**@type {import("../../shared-elements.js").GifPanel}*/($("#messageInputGifPanel"));
const messageReplyPanel = /**@type {HTMLElement}*/($("#messageReplyPanel"));
const messageReplyLabel = /**@type {HTMLElement}*/($("#messageReplyLabel"));
const messageCancelReplyButton = /**@type {HTMLButtonElement}*/($("#messageCancelReplyButton"));
const punishmentNote = /** @type {HTMLElement}*/($("#punishmentNote"));
const punishmentUserId = /** @type {HTMLElement}*/($("#punishmentUserId"));
const punishmentStartDate = /** @type {HTMLElement}*/($("#punishmentStartDate"));
const punishmentEndDate = /** @type {HTMLElement}*/($("#punishmentEndDate"));
const punishmentReason = /** @type {HTMLElement}*/($("#punishmentReason"));
const punishmentAppeal = /** @type {HTMLElement}*/($("#punishmentAppeal"));
const punishmentAppealConversation = /** @type {HTMLElement}*/($("#punishmentAppealConversation"));
const punishmentAppealForm = /** @type {HTMLFormElement}*/($("#punishmentAppealForm"));
const punishmentAppealMessage = /** @type {HTMLTextAreaElement}*/($("#punishmentAppealMessage"));
const punishmentAppealLimit = /** @type {HTMLElement}*/($("#punishmentAppealLimit"));
const punishmentAppealSubmitButton = /** @type {HTMLButtonElement}*/($("#punishmentAppealSubmitButton"));
const punishmentMenu = /** @type {HTMLElement}*/($("#punishmentMenu"));
const moderationMenu = /**@type {HTMLInputElement}*/($("#moderationMenu"));
const modUserId = /**@type {HTMLInputElement}*/($("#modUserId"));
const modMessageId = /**@type {HTMLInputElement}*/($("#modMessageId"));
const modMessagePreview = /**@type {HTMLInputElement}*/($("#modMessagePreview"));
const modDurationH = /**@type {HTMLInputElement}*/($("#modDurationH"));
const modDurationM = /**@type {HTMLInputElement}*/($("#modDurationM"));
const modDurationS = /**@type {HTMLInputElement}*/($("#modDurationS"));
const modAffectsAll = /**@type {HTMLInputElement}*/($("#modAffectsAll"));
const modReason = /**@type {HTMLInputElement}*/($("#modReason"));
const modCloseButton = /**@type {HTMLButtonElement}*/$("#modCloseButton");
const modCancelButton = /**@type {HTMLButtonElement}*/$("#modCancelButton");
const captchaPopup = /**@type {HTMLDialogElement}*/($("#captchaPopup"));
const modActionForm = /**@type {HTMLInputElement}*/($("#modActionForm"));
const modActionDelete = /**@type {HTMLInputElement}*/($("#modActionDelete"));
const modActionKick = /**@type {HTMLInputElement}*/($("#modActionKick"));
const modActionMute = /**@type {HTMLInputElement}*/($("#modActionMute"));
const modActionBan = /**@type {HTMLInputElement}*/($("#modActionBan"));
const modActionCaptcha = /**@type {HTMLInputElement}*/($("#modActionCaptcha"));
const moderationReviewDialog = /**@type {HTMLDialogElement}*/($("#moderationReviewDialog"));
const moderationReviewCloseButton = /**@type {HTMLElement}*/($("#moderationReviewCloseButton"));
const moderationMutesTab = /**@type {HTMLButtonElement}*/($("#moderationMutesTab"));
const moderationBansTab = /**@type {HTMLButtonElement}*/($("#moderationBansTab"));
const moderationReviewStatus = /**@type {HTMLElement}*/($("#moderationReviewStatus"));
const moderationReviewList = /**@type {HTMLElement}*/($("#moderationReviewList"));
const moderationReviewMoreButton = /**@type {HTMLButtonElement}*/($("#moderationReviewMoreButton"));
const chatPanel = /**@type {HTMLElement}*/($("#chatPanel"));
const messageEmojisPanel = /**@type {HTMLElement}*/($("#messageEmojisPanel"));
const messageInputEmojiPanel = /**@type {HTMLElement}*/($("#messageInputEmojiPanel"));
const overlayInput = /**@type {HTMLInputElement}*/($("#overlayInput"));
const overlaySliderValue = /**@type {HTMLElement}*/($("#overlaySliderValue"));
const chatContext = /**@type {HTMLElement}*/($("#chatContext"));
enablePopoverDismissal(chatContext);
const userNote = /**@type {HTMLElement}*/($("#userNote"));
const mentionUserButton = /**@type {HTMLButtonElement}*/($("#mentionUserButton"));
const replyUserButton = /**@type {HTMLButtonElement}*/($("#replyUserButton"));
const blockUserButton = /**@type {HTMLButtonElement}*/($("#blockUserButton"));
const changeMyNameButton = /**@type {HTMLElement}*/($("#changeMyNameButton"));
const connProblems = /**@type {HTMLElement}*/($("#connproblems"));
const connProblemsResetButton = /**@type {HTMLElement}*/($("#connProblemsResetButton"));
const chatAd = /**@type {HTMLAnchorElement}*/($("#chatAd"));
const chatAdCloseButton = /**@type {HTMLAnchorElement}*/($("#chatAdCloseButton"));
const chatAdLabel = /**@type {HTMLAnchorElement}*/($("#adLabel"));
const chatCloseButton = /**@type {HTMLButtonElement}*/($("#chatCloseButton"));
const helpButton = /**@type {HTMLButtonElement}*/($("#helpbtn"));
const closeButton = /**@type {HTMLButtonElement}*/($("#closebtn"));
const chatButton = /**@type {HTMLButtonElement}*/($("#chatbtn"));
const messageAddEmojiButton = /**@type {HTMLButtonElement}*/($("#messageAddEmojiButton"));
const messageAddGifButton = /**@type {HTMLButtonElement}*/($("#messageAddGifButton"));
const messageOptionsButton = /**@type {HTMLButtonElement}*/($("#messageOptionsButton"));
const themeDrop = /**@type {HTMLElement}*/($("#themeDrop"));
const themeDropName = /**@type {HTMLElement}*/($("#themeDropName"));
const themeDropParent = /**@type {HTMLElement}*/($("#themeDropParent"));
const advancedViewMenu = /**@type {HTMLElement}*/($("#advancedViewMenu"));
const spectateMenu = /**@type {HTMLElement}*/($("#spectateMenu"));
const spectateCloseButton = /**@type {HTMLElement}*/($("#spectateCloseButton"));
const spectateUserIdInput = /**@type {HTMLInputElement}*/($("#spectateUserIdInput"));
const spectateStatusLabel = /**@type {HTMLElement}*/($("#spectateStatusLabel"));
const secretSettingsDialog = /**@type {HTMLDialogElement}*/($("#secretSettingsDialog"));

// View state
/**@type {TurnstileWidget|null}*/let currentTurnstileWidget = null;
/**@type {{ x: number, y: number, z: number }|null}*/let spectateStartState = null;
/**@type {boolean}*/let passkeyAuthBusy = false;
let placerInfoRequestId = 0;
/**@type {number|null}*/let selectedCanvasReportPosition = null;
const reportTextEncoder = new TextEncoder();
/**@type {import("./moderation-api.js").PunishmentRecord|null}*/let currentPunishmentRecord = null;
/**@type {"mute"|"ban"}*/let moderationReviewType = "mute";
/**@type {Map<("mute"|"ban"), import("./moderation-api.js").PunishmentRecord[]>}*/
const moderationReviewRecords = new Map([["mute", []], ["ban", []]]);
/**@type {Map<("mute"|"ban"), number>}*/
const moderationReviewOffsets = new Map([["mute", 0], ["ban", 0]]);
/**@type {Map<("mute"|"ban"), boolean>}*/
const moderationReviewHasMore = new Map([["mute", false], ["ban", false]]);
/**@type {Set<("mute"|"ban")>}*/
const moderationReviewLoading = new Set();

function getHttpServerUrl() {
	return (localStorage.server || DEFAULT_SERVER)
		.replace("wss://", "https://").replace("ws://", "http://");
}

async function updatePasskeyMenu(message = "") {
	if (passkeyAuthState === "completed" || passkeyAuthState === "not-required") {
		passkeyMenu.removeAttribute("open");
		passkeyAuthBusy = false;
		passkeyMenuButton.disabled = false;
		return;
	}

	passkeyMenu.setAttribute("open", "true");
	passkeyMenuButton.disabled = passkeyAuthBusy || passkeyAuthState === "unsupported";

	if (passkeyAuthBusy) {
		passkeyMenuTitle.textContent = await translate("passkeyInProgress");
		passkeyMenuMessage.textContent = await translate("passkeyBrowserPrompt");
		passkeyMenuButton.textContent = await translate("waiting");
	}
	else if (passkeyAuthState === "unsupported") {
		passkeyMenuTitle.textContent = await translate("passkeysUnavailable");
		passkeyMenuMessage.textContent = message || await translate("passkeysUnsupportedMessage");
		passkeyMenuButton.textContent = await translate("unavailable");
	}
	else if (passkeyAuthState === "failed") {
		passkeyMenuTitle.textContent = await translate("passkeyFailed");
		passkeyMenuMessage.textContent = message || await translate("passkeyFailedMessage");
		passkeyMenuButton.textContent = await translate("tryAgain");
	}
	else {
		passkeyMenuTitle.textContent = await translate("passkeyRequired");
		passkeyMenuMessage.textContent = message || await translate("passkeyRequiredMessage");
		passkeyMenuButton.textContent = await translate("continue");
	}
}

async function refreshPasskeyStatus() {
	try {
		const status = await getPasskeyStatus(getHttpServerUrl());
		if (status.authenticated) {
			setPasskeyAuthState("completed");
		}
		else if (status.required) {
			setPasskeyAuthState("required");
		}
		else {
			setPasskeyAuthState("not-required");
		}
	}
	catch {
		// Older or non-passkey servers should behave as they did before.
		setPasskeyAuthState("not-required");
	}
}

async function startPasskeyAuth() {
	if (passkeyAuthBusy || passkeyAuthState === "completed" || passkeyAuthState === "unsupported") {
		return;
	}

	if (!supportsPasskeys()) {
		setPasskeyAuthState("unsupported", await translate("passkeysSecureSessionMessage"));
		return;
	}

	passkeyAuthBusy = true;
	updatePasskeyMenu();

	try {
		const serverUrl = getHttpServerUrl();
		const status = await getPasskeyStatus(serverUrl);
		if (!status.required || status.authenticated) {
			setPasskeyAuthState(status.authenticated ? "completed" : "not-required");
			return;
		}

		if (status.hasCredentials) {
			await authenticatePasskey(serverUrl);
		}
		else {
			await registerPasskey(serverUrl);
		}
		await refreshPasskeyStatus();
	}
	catch (error) {
		const message = error instanceof Error ? error.message : await translate("passkeyFailedDefault");
		setPasskeyAuthState("failed", message);
	}
	finally {
		passkeyAuthBusy = false;
		updatePasskeyMenu();
	}
}

function passkeyReadyForActions() {
	return passkeyAuthState === "not-required" || passkeyAuthState === "completed";
}

function requirePasskeyForAction() {
	if (passkeyReadyForActions()) {
		return true;
	}
	updatePasskeyMenu();
	if (passkeyAuthState === "required" || passkeyAuthState === "failed") {
		startPasskeyAuth();
	}
	return false;
}

passkeyMenuButton.addEventListener("click", (e) => {
	if (!(e instanceof Event) || !e.isTrusted) {
		return;
	}
	startPasskeyAuth();
});

window.addEventListener("palette", (/**@type {Event}*/e) => {
	generatePalette();
	const binds = (localStorage.paletteKeys || DEFAULT_PALETTE_KEYS);
	generateIndicators(binds);
	// Board might have already been drawn with old palette so we need to draw it again
	if (boardAlreadyRendered === true) {
		renderAll();
	}
});
window.addEventListener("cooldownend", (/**@type {Event}*/e) => {
	if (!document.hasFocus()) {
		runAudio(AUDIOS.cooldownEnd);
	}
	updatePlaceButton();
});
window.addEventListener("cooldownstart", (/**@type {Event}*/e) => {
	updatePlaceButton();
});
window.addEventListener("fetchboardfail", (/**@type {Event}*/e) => {
	if (!(e instanceof CustomEvent)) {
		throw new Error("Window event was not of type CustomEvent");
	}
	const { type } = e.detail;

	if (type === "timeout") {
		showLoadingScreen("timeout");
	}
	else {
		showLoadingScreen();
	}
});
window.addEventListener("boardloaded", async (/**@type {Event}*/e) => {
	renderAll();
	hideLoadingScreen();
});
window.addEventListener("size", (/**@type {Event}*/e) => {
	if (!(e instanceof CustomEvent)) {
		throw new Error("Window event was not of type CustomEvent");
	}
	const { width, height } = e.detail;

	sizeChanged(width, height);
});
window.addEventListener("online", (/**@type {Event}*/e) => {
	if (!(e instanceof CustomEvent)) {
		throw new Error("Window event was not of type CustomEvent");
	}
	const { count } = e.detail;

	onlineCounter.textContent = String(count);
	sendIpcMessage(postsFrame, "onlineCounter", count);
});
window.addEventListener("canvaslocked", (/**@type {Event}*/e) => {
	if (!(e instanceof CustomEvent)) {
		throw new Error("Window event was not of type CustomEvent");
	}
	const { locked, reason } = e.detail;

	setCanvasLocked(locked);
	if (typeof reason === "string" && reason !== "") {
		// TODO: This is a UX nightmare in dire need of a more elegant solution
		alert(reason);
	}
});
window.addEventListener("passkeyauthstate", (/**@type {Event}*/e) => {
	if (!(e instanceof CustomEvent)) {
		throw new Error("Window event was not of type CustomEvent");
	}
	updatePasskeyMenu(e.detail.message);
	updatePlaceButton();
});
window.addEventListener("intid", () => {
	refreshPasskeyStatus();
});
window.addEventListener("pixels", (/**@type {Event}*/e) => {
	if (!(e instanceof CustomEvent)) {
		throw new Error("Window event was not of type CustomEvent");
	}
	const { pixels } = e.detail;

	for (const pixel of pixels) {
		drawPixel(pixel.position, pixel.colour);
	}
});
window.addEventListener("rejectedpixel", (/**@type {Event}*/e) => {
	if (!(e instanceof CustomEvent)) {
		throw new Error("Window event was not of type CustomEvent");
	}
	const { position, colour } = e.detail;

	drawPixel(position, colour);
});
window.addEventListener("spectatedpixel", (/**@type {Event}*/e) => {
	if (!(e instanceof CustomEvent)) {
		throw new Error("Window event was not of type CustomEvent");
	}
	const { position } = e.detail;

	const x = position % WIDTH;
	const y = Math.floor(position / WIDTH);
	zoomIn();
	moveTo(x, y);
});
window.addEventListener("chatname", (/**@type {Event}*/e) => {
	namePanel.style.visibility = "hidden";
});
window.addEventListener("livechatmessage", (/**@type {Event}*/e) => {
	if (!(e instanceof CustomEvent)) {
		throw new Error("Window event was not of type CustomEvent");
	}
	const { message, channel } = e.detail;

	if (!cMessages.has(channel)) {
		cMessages.set(channel, []);
	}

	const newMessage = createLiveChatMessageElement(
		message.messageId,
		message.content,
		message.senderIntId,
		message.sendDate,
		message.senderChatName,
		message.repliesTo,
		message.reactions
	);

	applyLiveChatMessageInteractivity(newMessage, channel);
	if (isMention(message.content, chatName, intId) && message.senderIntId !== intId && !isBlocked(message.senderIntId, blockedUsers)) {
		incrementChannelMention(channel);
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
});
window.addEventListener("placechatmessage", (e) => {
	if (!(e instanceof CustomEvent)) {
		throw new Error("Window event was not of type CustomEvent");
	}
	const { message } = e.detail;

	if (!placeChat) {
		return
	}

	// Create message
	const placeMessage = /**@type {import("./game-elements.js").PlaceChat}*/(document.createElement("r-place-chat"));
	placeMessage.positionIndex = message.positionIndex;
	placeMessage.content = message.content;
	placeMessage.senderIntId = message.senderIntId;
	placeMessage.senderChatName = message.senderChatName;
	placeMessage.sendDate = Date.now();

	// Position message
	const posX = (message.positionIndex % WIDTH);
	const posY = Math.floor(message.positionIndex / WIDTH);
	setPlaceChatPosition(placeMessage, posX, posY);
	placeChatMessages.appendChild(placeMessage);

	//Remove message after given time
	setTimeout(() => {
		placeMessage.remove();
	}, localStorage.placeChatTime || 7e3);
});
window.addEventListener("livechatdelete", (/**@type {Event}*/e) => {
	if (!(e instanceof CustomEvent)) {
		throw new Error("Window event was not of type CustomEvent");
	}
	const { messageId } = e.detail;

	for (const channel of cMessages.values()) {
		for (const messageEl of channel) {
			if (messageEl.messageId !== messageId) {
				continue;
			}
			channel.splice(channel.indexOf(messageEl), 1);
			messageEl.remove();
		}
	}
});
window.addEventListener("livechatreaction", (/**@type {Event}*/e) => {
	if (!(e instanceof CustomEvent)) {
		throw new Error("Window event was not of type CustomEvent");
	}
	const { messageId, reactorId, reactionKey } = e.detail;

	for (const channel of cMessages.values()) {
		for (const messageEl of channel) {
			if (messageEl.messageId !== messageId) {
				continue;
			}

			const currentReactions = messageEl.reactions;
			const reactors = currentReactions?.get(reactionKey) || new Set();
			if (![...reactors].find((reactor) => reactor.intId == reactorId)) {
				const newReactions = currentReactions ? new Map(currentReactions) : new Map();
				reactors.add({ intId: reactorId, chatName: intIdNames.get(reactorId) ?? null });
				newReactions.set(reactionKey, reactors);
				messageEl.reactions = newReactions;
			}
		}
	}
});

function handleTextCaptcha(/**@type {[number,string[],Uint8Array]}*/[ captchaId, options, imageData ]) {
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
			captchaSubmitted = true;
			sendDefaultCaptchaResult(captchaId, text);
			captchaOptions.style.pointerEvents = "none";
		})
	}
	captchaPopup.showModal();
	captchaOptions.style.pointerEvents = "all";

	const imageBlob = new Blob([imageData], { type: "image/png" });
	if (webGLSupported) {
		updateImgCaptchaCanvas(imageBlob)
	}
	else {
		updateImgCaptchaCanvasFallback(imageBlob)
	}
}
addIpcMessageHandler("handleTextCaptcha", handleTextCaptcha);
function handleEmojiCaptcha(/**@type {[number,string[],Uint8Array]}*/[captchaId, options, imageData]) {
	captchaOptions.innerHTML = "";

	let captchaSubmitted = false;
	for (const emoji of options) {
		const buttonParent = document.createElement("button");
		buttonParent.classList.add("captcha-options-button");
		buttonParent.setAttribute("value", emoji);
		const emojiImg = document.createElement("img");
		emojiImg.src = `./tweemoji/${emoji.codePointAt(0)?.toString(16)}.png`;
		emojiImg.alt = emoji;
		emojiImg.title = emoji;
		emojiImg.fetchPriority = "high";
		emojiImg.addEventListener("load", (event) => {
			buttonParent.classList.add("loaded");
		})
		buttonParent.appendChild(emojiImg);
		captchaOptions.appendChild(buttonParent);

		function submitCaptcha() {
			if (captchaSubmitted || !emoji) {
				return console.error("Could not send captcha response. No emoji?")
			}
			captchaSubmitted = true;
			sendDefaultCaptchaResult(captchaId, emoji);
			captchaOptions.style.pointerEvents = "none";
			clearCaptchaCanvas();
		}
		buttonParent.addEventListener("click", submitCaptcha);
		emojiImg.addEventListener("click", submitCaptcha);
		buttonParent.addEventListener("touchend", submitCaptcha);
		emojiImg.addEventListener("touchend", submitCaptcha);
	}

	captchaPopup.showModal();
	captchaOptions.style.pointerEvents = "all";
	const imageBlob = new Blob([imageData], { type: "image/png" });
	if (webGLSupported) {
		updateImgCaptchaCanvas(imageBlob);
	}
	else {
		updateImgCaptchaCanvasFallback(imageBlob);
	}
}
addIpcMessageHandler("handleEmojiCaptcha", handleEmojiCaptcha);
function handleCaptchaSuccess() {
	captchaPopup.close();
}
addIpcMessageHandler("handleCaptchaSuccess", handleCaptchaSuccess);
setDefaultCaptchaHandlers(handleTextCaptcha, handleEmojiCaptcha, handleCaptchaSuccess);
function handleTurnstile(/**@type {[number,string]}*/[captchaId, siteKey]) {
	const siteVariant = document.documentElement.dataset.variant;
	const turnstileTheme = siteVariant === "dark" ? "dark" : "light";
	turnstileMenu.setAttribute("open", "true");

	// Clean up any existing widget
	if (currentTurnstileWidget) {
		currentTurnstileWidget.destroy();
	}

	const turnstileContainer = document.getElementById("turnstileContainer");
	currentTurnstileWidget = new TurnstileWidget(turnstileContainer, {
		sitekey: siteKey,
		theme: turnstileTheme,
		language: lang,
		onVerify: (/**@type {string}*/token) => {
			sendServerMessage("sendTurnstileResult", { captchaId, result: token });
		},
		onError: (/**@type {Error}*/error) => {
			console.error("Turnstile error:", error);
		},
		onLoad: (/**@type {string}*/widgetId) => {
			console.log("Turnstile loaded successfully");
		}
	});
}
addIpcMessageHandler("handleTurnstile", handleTurnstile);
function handleTurnstileSuccess() {
	turnstileMenu.removeAttribute("open")
}
addIpcMessageHandler("handleTurnstileSuccess", handleTurnstileSuccess);
window.addEventListener("turnstilechallenge", event => handleTurnstile(event.detail));
window.addEventListener("turnstilesuccess", handleTurnstileSuccess);
/** @type {Set<("mute"|"ban")>} */
const activePunishmentTypes = new Set();

/**
 * @param {HTMLElement} container
 * @param {"left"|"right"} displaySide
 * @param {number} senderIntId
 * @param {string|null} senderChatName
 * @param {string} message
 * @param {number|null} date
 */
async function appendAppealMessage(container, displaySide, senderIntId, senderChatName, message, date) {
	const appealMessage = /** @type {import("./game-elements.js").LiveChatMessage} */(
		document.createElement("r-live-chat-message"));
	appealMessage.dataset.displaySide = displaySide;
	appealMessage.dataset.explicitTime = typeof date === "number" && Number.isFinite(date)
		? new Date(date).toLocaleString() : await translate("unknownTime");
	appealMessage.messageId = -1;
	appealMessage.senderIntId = senderIntId;
	appealMessage.senderChatName = senderChatName;
	appealMessage.content = message;
	appealMessage.sendDate = typeof date === "number" && Number.isFinite(date) ? date / 1000 : 0;
	container.append(appealMessage);
}

/** @param {import("./moderation-api.js").PunishmentRecord|null} record */
async function renderPlayerAppeal(record) {
	currentPunishmentRecord = record;
	punishmentAppealConversation.replaceChildren();
	punishmentAppealConversation.hidden = true;
	punishmentAppealForm.hidden = true;
	punishmentAppealMessage.disabled = false;
	punishmentAppealSubmitButton.disabled = true;
	punishmentAppealMessage.value = "";
	punishmentAppealLimit.textContent = "0 / 1000 bytes";

	if (!record) {
		punishmentAppeal.textContent = await translate("appealNotMatched");
		return;
	}
	if (!record.appealMessage && record.finishDate > Date.now()) {
		punishmentAppeal.textContent = await translate("appealSubmitOnce");
		punishmentAppealForm.hidden = false;
		return;
	}
	if (!record.appealMessage) {
		punishmentAppeal.textContent = await translate("appealNotSubmitted");
		return;
	}

	punishmentAppeal.textContent = await translate(`appeal${toCapitalised(record.appealStatus)}`);
	punishmentAppealConversation.hidden = false;
	await appendAppealMessage(punishmentAppealConversation, "left", intId, chatName || await translate("you"),
		record.appealMessage, record.appealSubmittedAt);
	if (record.appealStatus !== "pending") {
		const knownModerator = typeof record.appealResponderIntId === "number" &&
			Number.isInteger(record.appealResponderIntId) && record.appealResponderIntId >= 0;
		const moderatorIntId = knownModerator ? record.appealResponderIntId : -1;
		const moderatorName = knownModerator ? record.appealResponderChatName : await translate("unknownModerator");
		await appendAppealMessage(punishmentAppealConversation, "right", moderatorIntId, moderatorName,
			record.appealResponse || await translate("noResponseRecorded"), record.appealRespondedAt);
	}
}

/** @param {{state:number, startDate:number, endDate:number}} info */
async function loadPlayerAppeal(info) {
	punishmentAppeal.textContent = await translate("loadingAppealStatus");
	punishmentAppealForm.hidden = true;
	try {
		const data = await getOwnPunishments();
		const type = (info.state & PUNISHMENT_STATE.ban) === PUNISHMENT_STATE.ban ? "ban" : "mute";
		const records = Array.isArray(data?.records) ? data.records : [];
		const exact = records.find(record => record.type === type &&
			Math.floor(record.startDate / 1000) * 1000 === info.startDate &&
			Math.floor(record.finishDate / 1000) * 1000 === info.endDate);
		const fallback = records.find(record => record.type === type && record.finishDate > Date.now());
		await renderPlayerAppeal(exact || fallback || null);
	}
	catch (error) {
		currentPunishmentRecord = null;
		punishmentAppeal.textContent = await translate("appealServiceUnavailable");
		console.error("Couldn't load punishment appeal:", error);
	}
}

window.addEventListener("punishment", async (/**@type {Event}*/e) => {
	if (!(e instanceof CustomEvent)) {
		throw new Error("Window event was not of type CustomEvent");
	}
	const info = e.detail;
	const type = (info.state & PUNISHMENT_STATE.ban) === PUNISHMENT_STATE.ban ? "ban" : "mute";
	const active = info.endDate > Date.now();
	if (active) activePunishmentTypes.add(type);
	else activePunishmentTypes.delete(type);

	if (type === "mute") {
		punishmentNote.innerHTML = await translate("mutedNotice");
	}
	else {
		punishmentNote.innerHTML = await translate("bannedNotice");
	}
	if (!active) punishmentNote.textContent = await translate(`${type}Ended`);
	messageInput.disabled = activePunishmentTypes.size > 0;
	if (activePunishmentTypes.has("ban")) setCanvasLocked(true, await translate("bannedFromPlacing"));
	else if (!canvasLocked && spectateStartState === null) setCanvasLocked(false);

	punishmentUserId.textContent = `${await translate("yourUserId")} #${intId}`;
	punishmentStartDate.textContent = `${await translate("startedOn")} ${new Date(info.startDate).toLocaleString()}`;
	punishmentEndDate.textContent = `${await translate("endingOn")} ${new Date(info.endDate).toLocaleString()}`;
	punishmentReason.textContent = `${await translate("reasonLabel")} ${info.reason}`;
	void loadPlayerAppeal(info);
	punishmentMenu.setAttribute("open", "true");
});

punishmentAppealMessage.addEventListener("input", () => {
	const byteLength = reportTextEncoder.encode(punishmentAppealMessage.value.trim()).byteLength;
	punishmentAppealLimit.textContent = `${byteLength} / 1000 bytes`;
	punishmentAppealSubmitButton.disabled = byteLength === 0 || byteLength > 1000;
});
punishmentAppealForm.addEventListener("submit", async event => {
	event.preventDefault();
	if (!currentPunishmentRecord) return;
	const message = punishmentAppealMessage.value.trim();
	const byteLength = reportTextEncoder.encode(message).byteLength;
	if (byteLength === 0 || byteLength > 1000) return;
	punishmentAppealMessage.disabled = true;
	punishmentAppealSubmitButton.disabled = true;
	punishmentAppeal.textContent = await translate("submittingAppeal");
	try {
		const result = await submitPunishmentAppeal(
			currentPunishmentRecord.type, currentPunishmentRecord.punishmentId, message);
		await renderPlayerAppeal(result.appeal);
	}
	catch (error) {
		punishmentAppealMessage.disabled = false;
		punishmentAppealSubmitButton.disabled = false;
		punishmentAppeal.textContent = error instanceof Error ? error.message : await translate("couldNotSubmitAppeal");
	}
});
window.addEventListener("spectating", (/**@type {Event}*/e) => {
	if (!(e instanceof CustomEvent)) {
		throw new Error("Window event was not of type CustomEvent");
	}
	const { userIntId } = e.detail;

	startedSpectating(userIntId);
});
window.addEventListener("unspectating", (/**@type {Event}*/e) => {
	if (!(e instanceof CustomEvent)) {
		throw new Error("Window event was not of type CustomEvent");
	}
	const { userIntId, reason } = e.detail;

	stoppedSpectating(userIntId, reason);
})
window.addEventListener("disconnect", (/**@type {Event}*/e) => {
	if (!(e instanceof CustomEvent)) {
		throw new Error("Window event was not of type CustomEvent");
	}
	const { code, reason } = e.detail;

	if (code === 1006 && !sessionStorage.loadError) {
		sessionStorage.loadError = "1";
		window.location.reload();
		console.log("Unexpected disconnect code 10006: Attempting automated reload");
	}

	console.log("Disconnected from server with code:", code, `(${reason})`);
	showLoadingScreen("disconnected", reason);
});
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

function scrollToPosts() {
	postsFrame.scrollIntoView({ behavior: "smooth", block: "start", inline: "start" })
}
function openOverlayMenuOld() {
	if (enableNewOverlayMenu === true) {
		openOverlayMenu();
	}
	else {
		overlayMenuOld.setAttribute("open", "true");
	}
}

// Load more posts on scroll down
more.addEventListener("scroll", function(/**@type {any}*/ e) {
	const moreMaxScroll = more.scrollHeight - more.clientHeight
	if (moreMaxScroll - more.scrollTop < 256) {
		sendIpcMessage(postsFrame, "tryLoadBottomPosts");
	}
	// Dialog positioning is messed up as it only sees iframe window, this is cursed but it works
	const dialogTopHeight = Math.max(more.scrollTop - spaceFiller.offsetHeight + window.innerHeight / 2,
		spaceFiller.offsetHeight / 2)
		sendIpcMessage(postsFrame, "updateDialogTop", dialogTopHeight);
}, { passive: true })

const placeContext = /**@type {HTMLElement}*/($("#placeContext"));
placeContext.addEventListener("mousedown", function(e) {
	e.stopPropagation();
});
const placeContextReportButton = /**@type {HTMLButtonElement}*/($("#placeContextReportButton"));
placeContextReportButton.disabled = !supportsCanvasPixelReports;
if (!supportsCanvasPixelReports) {
	void translate("pixelReportsOfficialOnly").then(title => placeContextReportButton.title = title);
}
placeContextReportButton.addEventListener("click", async function() {
	if (!supportsCanvasPixelReports) {
		return;
	}
	const pixelX = Math.floor(Number(placeContext.dataset.x));
	const pixelY = Math.floor(Number(placeContext.dataset.y));
	const inBounds = Number.isFinite(pixelX) && Number.isFinite(pixelY) &&
		pixelX >= 0 && pixelX < WIDTH && pixelY >= 0 && pixelY < HEIGHT;
	selectedCanvasReportPosition = inBounds ? pixelX + pixelY * WIDTH : null;
	hidePopover(placeContext);
	canvasReportPosition.textContent = `${pixelX}, ${pixelY}`;
	canvasReportForm.reset();
	canvasReportReason.disabled = !inBounds;
	canvasReportStatus.textContent = inBounds ? "" : await translate("outsideCanvas");
	canvasReportStatus.hidden = inBounds;
	canvasReportSubmitButton.disabled = true;
	canvasReportCancelButton.textContent = await translate("cancel");
	canvasReportLimit.textContent = "0 / 280 bytes";
	if (!canvasReportDialog.open) {
		canvasReportDialog.showModal();
	}
	if (inBounds) {
		canvasReportReason.focus();
	}
});
const placeContextInfoButton = /**@type {HTMLButtonElement}*/($("#placeContextInfoButton"));
placeContextInfoButton.addEventListener("click", function(e) {
	const px = Number(placeContext.dataset.x);
	const py = Number(placeContext.dataset.y);
	hidePopover(placeContext);
	showPlacerInfo(px, py);
});
if (!localStorage.vip?.startsWith("!")) {
	const placeContextModItem = /**@type {HTMLElement}*/($("#placeContextModItem"));
	placeContextModItem.setAttribute("hidden", "");
}
/**
 * @param {number} x 
 * @param {number} y 
 * @returns 
 */
async function showPlacerInfo(x, y) {
	const requestId = ++placerInfoRequestId;
	const pixelX = Math.floor(x);
	const pixelY = Math.floor(y);
	const id = intIdPositions.get(pixelX + pixelY * WIDTH);

	placerInfoStatus.textContent = await translate("lookingUpPlacer");
	placerInfoStatus.hidden = false;
	placerInfoDetails.hidden = true;
	if (!placerInfoDialog.open) {
		placerInfoDialog.showModal();
	}

	if (id === undefined) {
		placerInfoStatus.textContent = await translate("couldNotFindPlacer");
		return;
	}
	let name = intIdNames.get(id);
	if (name === undefined) {
		// Query server
		const httpServerUrl = (localStorage.server || DEFAULT_SERVER)
			.replace("wss://", "https://").replace("ws://", "http://");
		try {
			const res = await fetch(`${httpServerUrl}/users/${id}`);
			if (!res.ok) {
				throw new Error(`Could not fetch user info: ${res.status} ${res.statusText}`)
			}
			const user = await res.json();
			if (!user) {
				throw new Error("User was null")
			}
			name = user.chatName;
		}
		catch(e) {
			if (requestId === placerInfoRequestId) {
				placerInfoStatus.textContent = await translate("couldNotFindPlacer");
			}
			console.error("Couldn't show placer info:", e);
			return;
		}
	}
	if (requestId !== placerInfoRequestId) {
		return;
	}

	placerInfoPosition.textContent = `${pixelX}, ${pixelY}`;
	placerInfoName.textContent = name || "anon";
	placerInfoUserId.textContent = `#${id}`;
	placerInfoStatus.hidden = true;
	placerInfoDetails.hidden = false;
}
placerInfoCloseButton.addEventListener("click", function() {
	placerInfoDialog.close();
});

canvasReportReason.addEventListener("input", function() {
	const byteLength = reportTextEncoder.encode(canvasReportReason.value.trim()).byteLength;
	canvasReportLimit.textContent = `${byteLength} / 280 bytes`;
	canvasReportSubmitButton.disabled = byteLength === 0 || byteLength > 280;
	canvasReportStatus.hidden = true;
});
canvasReportForm.addEventListener("submit", async function(e) {
	e.preventDefault();
	const reason = canvasReportReason.value.trim();
	const byteLength = reportTextEncoder.encode(reason).byteLength;
	if (selectedCanvasReportPosition === null || byteLength === 0 || byteLength > 280) {
		canvasReportStatus.textContent = await translate("reportReasonTooLong");
		canvasReportStatus.hidden = false;
		return;
	}
	try {
		sendServerMessage("reportCanvasPixel", {
			position: selectedCanvasReportPosition,
			reason
		}, e);
		canvasReportReason.disabled = true;
		canvasReportSubmitButton.disabled = true;
		canvasReportCancelButton.textContent = await translate("close");
		canvasReportStatus.textContent = await translate("reportSent");
		canvasReportStatus.hidden = false;
	}
	catch(error) {
		canvasReportStatus.textContent = await translate("reportSendFailed");
		canvasReportStatus.hidden = false;
		console.error("Couldn't report canvas pixel:", error);
	}
});
canvasReportCloseButton.addEventListener("click", function() {
	canvasReportDialog.close();
});
canvasReportCancelButton.addEventListener("click", function() {
	canvasReportDialog.close();
});

// Modal
// Prompt user if they want to install site as PWA if they press the modal button
/**@type {Event|null}*/
let pwaPrompter = null
modalInstallButton.disabled = true
window.addEventListener("beforeinstallprompt", function(e) {
	e.preventDefault()
	pwaPrompter = e
	modalInstallButton.disabled = false
})
modalInstallButton.addEventListener("click", () => {
	// @ts-expect-error PWAPrompter.prompt is still an experimental javascript feature for some reason
	pwaPrompter?.prompt();
});
modalCloseButton.addEventListener("click", function() {
	modal.close();
});
modalCopyrightButton.addEventListener("click", function() {
	secretSettingsDialog.showModal();
});

// Keybinds
document.body.addEventListener("keydown", function(/**@type {KeyboardEvent}*/e) {
	if (!e.isTrusted) {
		return;
	}

	// Handle keybindings
	if (!document.activeElement || !("value" in document.activeElement)) {
		//"Shift+O" to open overlay menu
		if (e.key === "O" && e.shiftKey) {
			e.preventDefault();
			overlayMenuOld.toggleAttribute("open");
		}
		else if (e.key === "M" && e.shiftKey && localStorage.vip?.startsWith("!")) {
			e.preventDefault();
			moderationMenu.toggleAttribute("open");
		}
		else if (e.key === "R" && e.shiftKey && localStorage.vip?.startsWith("!")) {
			e.preventDefault();
			openModerationReview();
		}
		else if (e.key === "V" && e.shiftKey && boardRenderer) {
			e.preventDefault();
			advancedViewMenu.toggleAttribute("open");
		}
		else if (e.key === "S" && e.shiftKey && localStorage.vip?.startsWith("!")) {
			e.preventDefault();
			spectateMenu.toggleAttribute("open");
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
			setZ(z + 0.02);
			pos();
		}
		else if (e.key === "-") {
			e.preventDefault();
			setZ(z - 0.02);
			pos();
		}

		// Move around with arrow keys
		let moveEaseI = 10;
		const repeatFunc = setInterval(function() {
			// We use 55 because: 10/55+9/55+8/55+7/55+6/55+5/55+4/55+3/55+2/55+1/55 = 1
			const step = moveEaseI / 55;
			switch (e.code) {
			case "ArrowLeft":
				setX(x - step);
				break;
			case "ArrowUp":
				setY(y - step);
				break;
			case "ArrowRight":
				setX(x + step);
				break;
			case "ArrowDown":
				setY(y + step);
				break;
			}
			pos();
			moveEaseI--;
			if (moveEaseI <= 0) {
				clearInterval(repeatFunc);
			}
		}, 16);
	}

	//Begin palette commands
	if (onCooldown || canvasLocked || placementMode !== PLACEMENT_MODE.selectPixel) {
		return;
	}

	//"Enter" key to place selected block without using mouse
	if (e.key == "Enter" && (!document.activeElement || !("value" in document.activeElement))) {
		handlePixelPlace(e);
		return;
	}

	//Keyboard shortcuts for selecting palette colours
	let keyIndex = null;
	if (document.activeElement != document.body) {
		return;
	}
	keyIndex = (localStorage.paletteKeys || DEFAULT_PALETTE_KEYS).indexOf(e.key)
	if (keyIndex == -1) {
		return;
	}
	if (palette.style.transform == "translateY(100%)") {
		showPalette();
	}
	for (let c = 0; c < colours.children.length; c++) {
		const indicator = /**@type {HTMLElement}*/(colours.children[c].firstChild);
		indicator.style.visibility = "visible"
	}
	let colourI = [...Array.from(colours.children)]
		.indexOf(colours.children[keyIndex]);
	if (colourI < 0) {
		return;
	}
	selectColour(keyIndex);
});

/**
 * @param {boolean} locked 
 * @param {string|null} lockMessage
 */
function setCanvasLocked(locked, lockMessage=null) {
	canvasLock.style.display = locked ? "flex" : "none";

	if (locked) {
		placeOkButton.classList.remove("enabled");
		unselectColour();

		if (!lockMessage) {
			translate("lockMessage").then((translated) => {
				lockMessageLabel.textContent = translated;
			});	
		}
		else {
			lockMessageLabel.textContent = lockMessage;
		}
	}
	else {
		placeOkButton.classList.add("enabled");
	}
	placeOkButton.disabled = locked;
}

/**
 * @param {number} width
 * @param {number} height
 */
function sizeChanged(width, height) {
	canvas.width = width;
	canvas.height = height;
	canvParent1.style.width = width + "px";
	canvParent1.style.height = height + "px";
	canvParent2.style.width = width + "px";
	canvParent2.style.height = height + "px";
	placeChatMessages.style.width = width + "px";
	placeChatMessages.style.width = height + "px";
	setX(+localStorage.x || width / 2);
	setY(+localStorage.y || height / 2);
	setZ(+localStorage.z || 0.2);

	for (const [key, value] of new URLSearchParams(window.location.search)) {
		switch (key) { // Only for numeric value params
			case "x": {
				setX(parseInt(value, 10) || 0);
				pos();
				break;
			}
			case "y": {
				setY(parseInt(value, 10) || 0);
				pos(); break;
			}
			case "z": {
				setZ(parseInt(value, 10) || 0);
				pos()
				break;
			}
			case "overlay": {
				overlayInfo = JSON.parse(value);
				const imageData = base64ToBlob(overlayInfo.data, overlayInfo.type);
				templateImage.src = URL.createObjectURL(imageData);
				overlayInfo.x = overlayInfo.x || 0;
				overlayInfo.y = overlayInfo.y || 0;
				templateImage.style.transform = `translate(${overlayInfo.x}px, ${overlayInfo.y}px)`;
				templateImage.style.opacity = String(overlayInfo.opacity || 0.8);
				setX(overlayInfo.x);
				setY(overlayInfo.y);
				setZ(Math.min(Math.max(z, minZoom), 1));
				pos();
				openOverlayMenuOld();
				break;
			}
		}
	}
	onMainContentResize();
}

function onMainContentResize() {
	setMinZoom(Math.min(innerWidth / canvas.width, viewport.offsetHeight / canvas.height) / 100);
	pos();
}

// Canvas rendering
let boardAlreadyRendered = false
function renderAll() {
	const img = new ImageData(canvas.width, canvas.height)
	const data = new Uint32Array(img.data.buffer)
	if (BOARD) {
		for (let i = 0; i < BOARD.length; i++) {
			data[i] = PALETTE[BOARD[i]]
		}

		// Pass data to WebGL board renderer
		if (RAW_BOARD && CHANGES && SOCKET_PIXELS) {
			boardRenderer?.setSources(RAW_BOARD, CHANGES, SOCKET_PIXELS, new Uint32Array(PALETTE), WIDTH, HEIGHT);
		}
	}
	if (canvasCtx) {
		canvasCtx.putImageData(img, 0, 0);
		// HACK: Workaround for blank-canvas bug on chrome on M1 chips
		canvasCtx.getImageData(0, 0, 1, 1);
		boardAlreadyRendered = true;
	}
}
/**@type {Uint32Array}*/const u32Colour = new Uint32Array(1);
/**@type {Uint8Array}*/const u8ArrColour = new Uint8Array(u32Colour.buffer);
/**
 * @param {number} index 
 * @param {number} colour 
 */
function drawPixel(index, colour) {
	u32Colour[0] = PALETTE[colour];

	if (canvasCtx) {
		// Canvas2D renderer
		const x = index % WIDTH;
		const y = Math.floor(index / WIDTH);
		canvasCtx.fillStyle = "#" + (u8ArrColour[0] < 16 ? "0" : "") + u8ArrColour[0].toString(16) + (u8ArrColour[1] < 16 ? "0" : "") + u8ArrColour[1].toString(16) + (u8ArrColour[2] < 16 ? "0" : "") + u8ArrColour[2].toString(16) + (u8ArrColour[3] < 16 ? "0" : "") + u8ArrColour[3].toString(16);
		canvasCtx.clearRect(x, y, 1, 1);
		canvasCtx.fillRect(x, y, 1, 1);
	}
	if (boardRenderer) {
		// WebGL renderer
		boardRenderer.redrawSocketPixel(index, colour);
	}
}

// Client state
let focused = true;
let selectedColour = -1;

/**
 * @param {boolean} state 
 */
function setFocused(state) {
	// TODO: Suspend clientside cooldown
	if (focused !== state) {
		focused = state;
	}
}
window.addEventListener("blur", () => {
	setFocused(false);
});
window.addEventListener("focus", () => {
	setFocused(true);
});
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState === "visible") {
		setFocused(true);
	}
	else {
		setFocused(false);
	}
});

canvSelectImage.addEventListener("dragstart", (e) => {
	e.preventDefault();
	return false;
})

let placementPending = false;
/**
 * @param {Event} e
 */
async function handlePixelPlace(e) {
	if (!(e instanceof Event) || !e.isTrusted) {
		return
	}
	if (placementPending || !focused || connectStatus !== "connected" || (cooldownEndDate !== null && cooldownEndDate > Date.now())) {
		return;
	}
	if (!placeOkButton.classList.contains("enabled")) {
		return;
	}
	if (!requirePasskeyForAction()) {
		return;
	}
	// Send place to websocket
	const position = Math.floor(x) + Math.floor(y) * WIDTH;
	const colour = selectedColour;
	placementPending = true;
	try {
		// This acknowledges the worker send, not authoritative server acceptance.
		if (!await placePixel(position, colour, e)) return;
	}
	catch (error) {
		console.warn("Could not submit placement", error);
		return;
	}
	finally {
		placementPending = false;
	}

	// Predict only after worker acceptance; server rejection still corrects it.
	// TODO: Note client-server latency will make real cooldown a little bigger
	const now = Date.now();
	const clientServerLatency = 50; // TODO: Use ping to determine this better
	setCooldown(now + COOLDOWN + clientServerLatency);
	drawPixel(position, colour);

	// Apply on client-side
	hideIndicators();
	placeOkButton.classList.remove("enabled");
	canvSelect.style.background = "";
	canvSelect.children[0].style.display = "block";
	canvSelect.style.outline = "";
	canvSelect.style.boxShadow = "";
	palette.style.transform = "translateY(100%)";
	runAudio(AUDIOS.cooldownStart);

	if (!mobile) {
		unselectColour();
	}
}
placeOkButton.addEventListener("click", handlePixelPlace);
/**
 * @param {Event} e
 */
function handlePlaceButtonClicked(e) {
	if (!(e instanceof Event) || !e.isTrusted) {
		return;
	}

	if (connectStatus === "connected" && (cooldownEndDate !== null && cooldownEndDate < Date.now())) {
		if (!requirePasskeyForAction()) {
			return;
		}
		zoomIn()
		showPalette()

		// Persistent colours on mobile platforms
		if (isColourSelected()) {
			placeOkButton.classList.add("enabled");
			canvSelect.style.background = colours.children[selectedColour].style.background;
			canvSelect.children[0].style.display = "none";
			canvSelect.style.outline = "8px white solid";
			canvSelect.style.boxShadow = "0px 2px 4px 0px rgb(0 0 0 / 50%)";
		}
	}
	else {
		runAudio(AUDIOS.invalid)
	}
}
placeButton.addEventListener("click", handlePlaceButtonClicked);
/**
 * @param {Event} e 
 */
function handlePlaceCancelClicked(e) {
	if (!(e instanceof Event) || !e.isTrusted) {
		return;
	}

	runAudio(AUDIOS.closePalette);
	canvSelect.style.background = "";
	palette.style.transform = "translateY(100%)";
	if (isColourSelected()) {
		unselectColour();
	}
	placeOkButton.classList.remove("enabled");
	canvSelect.children[0].style.display = "block";
	canvSelect.style.outline = "";
	canvSelect.style.boxShadow = "";
	hideIndicators();
}
placeCancelButton.addEventListener("click", handlePlaceCancelClicked);

// Cooldown handling
/**@type {Timer|null}*/let cooldownInterval = null;
/**@type {number|null}*/let currentResolution = null;
/**
 * Renders the pixel place button with the current cooldown state,
 * (READ ONLY) will not affect any cooldown state directly
 */
async function updatePlaceButton() {
	let innerHTML = "???";
	if (connectStatus === "initial" || connectStatus === "connecting") {
		innerHTML = await translate("connecting");
	}
	else if (connectStatus === "disconnected") {
		innerHTML = `<span style="color:#f50; white-space: nowrap;">${await translate("connectingFail")}</span>`;
		clearCooldownInterval();
	}
	else if (connectStatus === "connected") {
		const now = Date.now();
		const endDate = cooldownEndDate ?? 0;
		const left = endDate - now;
		const leftS = Math.floor(left / 1000);

		if (!passkeyReadyForActions()) {
			innerHTML = await translate("passkeyAuthenticate");
			clearCooldownInterval();
		}
		else if (left > 0) {
			if (leftS >= 1) {
				const h = String(Math.floor(leftS / 3600)).padStart(2, "0");
				const m = String(Math.floor((leftS / 60) % 60)).padStart(2, "0");
				const s = String(leftS % 60).padStart(2, "0");
				innerHTML = `
					<svg xmlns="http://www.w3.org/2000/svg" data-name="icons final" viewBox="0 0 20 20" style="height: 1.1rem; vertical-align: top;">
						<path d="M13.558 14.442l-4.183-4.183V4h1.25v5.741l3.817 3.817-.884.884z"></path>
						<path d="M10 19.625A9.625 9.625 0 1119.625 10 9.636 9.636 0 0110 19.625zm0-18A8.375 8.375 0 1018.375 10 8.384 8.384 0 0010 1.625z"></path>
					</svg> ${h}:${m}:${s}`;
				startCooldownInterval(500);
			}
			else {
				innerHTML = `<span style="color:#f50;">${left}ms</span>`;
				startCooldownInterval(100);
			}
		}
		else {
			innerHTML = await translate("placeTile");
			clearCooldownInterval();
		}
	}

	placeButton.innerHTML = innerHTML;
	placeButton.disabled = onCooldown && passkeyReadyForActions();
}

/**
 * @param {number} resolution 
 */
function startCooldownInterval(resolution) {
	if (cooldownInterval && currentResolution === resolution) {
		return;
	}
	clearCooldownInterval();
	currentResolution = resolution;
	cooldownInterval = setInterval(updatePlaceButton, resolution);
}
function clearCooldownInterval() {
	if (cooldownInterval) {
		clearInterval(cooldownInterval);
		cooldownInterval = null;
		currentResolution = null;
	}
}

/**
 * @param {number} colourIndex 
 */
function runSelectColourAudio(colourIndex) {
	if (selectColourSample) {
		let note = selectColourSample.baseNote;
		if (enableMelodicPalette) {
			const naturals = getNaturalNotes(4, PALETTE.length);
			note = naturals[colourIndex];
		}

		playSample(selectColourSample.audioBuffer, selectColourSample.baseNote, note);	
	}
	else {
		runAudio(AUDIOS.selectColour);
	}
}

/**
 * @param {number} colourIndex 
 */
function selectColour(colourIndex) {
	// Clear select from old colour
	const oldColour = colours.children[selectedColour];
	if (oldColour) {
		oldColour.classList.remove("sel");
	}

	// Apply new selection
	selectedColour = colourIndex;
	const clickedColour = colours.children[selectedColour];
	canvSelect.style.background = clickedColour.style.background;
	clickedColour.classList.add("sel");
	placeOkButton.classList.add("enabled");
	canvSelect.children[0].style.display = "none";
	canvSelect.style.outline = "8px white solid";
	canvSelect.style.boxShadow = "0px 2px 4px 0px rgb(0 0 0 / 50%)";
	runSelectColourAudio(colourIndex);
}

function unselectColour() {
	colours.children[selectedColour].classList.remove("sel");
	selectedColour = -1;
}

function isColourSelected() {
	return selectedColour !== -1;
}

/**
 * @param {Event} e
 */
function handleColourClicked(e) {
	if (!(e instanceof Event) || !e.isTrusted) {
		return;
	}
	const clickedColour = /**@type {HTMLElement}*/(e.target);
	if (!clickedColour || !clickedColour.dataset.index) {
		return;
	}
	const i = parseInt(clickedColour.dataset.index);
	if (Number.isNaN(i) || i < PALETTE_USABLE_REGION.start || i >= PALETTE_USABLE_REGION.end) {
		return;
	}
	selectColour(i);
	hideIndicators();
}
colours.addEventListener("click", handleColourClicked);

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
/** @type {Map<string, import("./game-elements.js").LiveChatMessage[]>} */const cMessages = new Map([
	[extraLanguage, []],
	["en", []]
]);
const channelMentionCounts = new Map();
/** @param {string} channel @returns {number} */
function getChannelMentionCount(channel) {
	return channelMentionCounts.get(channel) || 0;
}
function createBadgeElement(className) {
	const badge = document.createElement("span");
	badge.className = className;
	badge.hidden = true;
	return badge;
}
/** @param {HTMLElement} container @param {string} badgeId @returns {HTMLElement} */
function ensureChannelBadge(container, badgeId) {
	let badge = container.querySelector(`#${badgeId}`);
	if (!badge) {
		badge = createBadgeElement("channel-mention-badge");
		badge.id = badgeId;
		container.style.position = "relative";
		container.appendChild(badge);
	}
	return badge;
}
/** @param {HTMLElement} listItem @returns {HTMLElement} */
function ensureDropdownBadge(listItem) {
	let badge = listItem.querySelector(".channel-mention-badge");
	if (!badge) {
		badge = createBadgeElement("channel-mention-badge inline");
		listItem.appendChild(badge);
	}
	return badge;
}
function updateChannelBadges() {
	const mineCount = getChannelMentionCount(extraLanguage);
	const enCount = getChannelMentionCount("en");
	const mineBadge = ensureChannelBadge(channelMineButton, "channelMineBadge");
	mineBadge.textContent = mineCount > 99 ? "99+" : String(mineCount);
	mineBadge.hidden = mineCount === 0;

	const enBadge = ensureChannelBadge(channelEnButton, "channelEnBadge");
	enBadge.textContent = enCount > 99 ? "99+" : String(enCount);
	enBadge.hidden = enCount === 0;

	const totalOthers = Array.from(channelMentionCounts.entries())
		.filter(([ch]) => ch !== currentChannel)
		.reduce((sum, [, n]) => sum + n, 0);
	const dropParentBadge = ensureChannelBadge(channelDropParent, "channelDropBadge");
	dropParentBadge.textContent = totalOthers > 99 ? "99+" : String(totalOthers);
	dropParentBadge.hidden = totalOthers === 0;

	for (const li of channelDropMenu.children) {
		if (!(li instanceof HTMLElement)) continue;
		const code = li.dataset.lang;
		if (!code) continue;
		const count = getChannelMentionCount(code);
		const badge = ensureDropdownBadge(li);
		badge.textContent = count > 99 ? "99+" : String(count);
		badge.hidden = count === 0;
	}
}
/** @param {string} channel */
function incrementChannelMention(channel) {
	if (!channel || channel === currentChannel) return;
	channelMentionCounts.set(channel, (channelMentionCounts.get(channel) || 0) + 1);
	updateChannelBadges();
}
/** @param {string} channel */
function clearChannelMentions(channel) {
	if (channelMentionCounts.has(channel)) {
		channelMentionCounts.delete(channel);
		updateChannelBadges();
	}
}
let chatPreviousLoadDebounce = false;
let chatPreviousAutoLoad = false;
let currentChannel = lang;
extraChannel(extraLanguage);
initChannelDrop();
switchLanguageChannel(currentChannel);

// Live chat channels
function initChannelDrop() {
	let containsMy = false;

	channelDropMenu.innerHTML = "";
	for (const [code, info] of LANG_INFOS) {
		if (code == lang) {
			containsMy = true;
		}
		const el = document.createElement("li");
		el.innerHTML = `<button type="button"><span>${info.name}</span> <img src="${info.flag}" style="height: 24px;"></button>`;
		el.dataset.lang = code;
		channelDropMenu.appendChild(el);
	}

	if (!containsMy) {
		const el = document.createElement("li");
		el.innerHTML = `<span>${lang}</span>`;
		el.dataset.lang = lang;
		channelDropMenu.appendChild(el);
	}
}

channelDropMenu.addEventListener("click", function(e) {
	e.stopPropagation();

	let target = e.target
	while (target instanceof HTMLElement && target != channelDropMenu) {
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

channelButton.addEventListener("click", function(e) {
	e.stopPropagation();
	channelDropParent.toggleAttribute("open");
});

channelMineButton.addEventListener("click", function() {
	switchLanguageChannel(extraLanguage);
});

channelEnButton.addEventListener("click", function() {
	switchLanguageChannel("en");
});

/**
 * @param {string} code
 */
function extraChannel(code) {
	let info = LANG_INFOS.get(code);
	channelMineName.innerText = code.toUpperCase();
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
	clearChannelMentions(selected);
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
			messageRenderPromises.push(messageEl.updateComplete);
			chatMessages.appendChild(messageEl);
		}
		Promise.all(messageRenderPromises).then(() => {
			chatMessages.scrollTo(0, chatMessages.scrollHeight);
		})
	}

	// If we don't have any cached messages for this channel, try pre-populate with a few
	const oldestMessage = /**@type {import("./game-elements.js").LiveChatMessage|null}*/(chatMessages.children[0]);
	sendServerMessage("requestLoadChannelPrevious", {
		channel: currentChannel,
		anchorMsgId: oldestMessage?.messageId || 0,
		msgCount: 32
	});
}

/**
 * @param {number} messageId
 * @param {string} content
 * @param {number} senderId
 * @param {number} sendDate
 * @param {string|null} senderChatName
 * @param {number|null} repliesTo
 * @param {Map<string, Set<number>>|null} reactions
 * @returns {import("./game-elements.js").LiveChatMessage}
 */
function createLiveChatMessageElement(messageId, content, senderId, sendDate, senderChatName = null, repliesTo = null, reactions = null) {
	const message = /**@type {import("./game-elements.js").LiveChatMessage}*/(document.createElement("r-live-chat-message"));
	message.messageId = messageId;
	message.content = content;
	message.senderIntId = senderId;
	message.senderChatName = senderChatName;
	message.sendDate = sendDate;
	message.repliesTo = repliesTo;
	message.reactions = reactions ? new Map(
		Array.from(reactions, ([key, userIds]) => [
			key,
			new Set([...userIds].map(userId => ({ intId: userId, chatName: intIdNames.get(userId) ?? null })))
		])
	) : null;
	return message;
}

/**
 * @param {import("./game-elements.js").LiveChatMessage} message
 * @param {string} channel
 * @return {import("./game-elements.js").LiveChatMessage}
 */
function applyLiveChatMessageInteractivity(message, channel = "") {
	// Register event handlers
	message.addEventListener("coordinate-click", (/**@type {Event}*/e) => {
		if (!(e instanceof CustomEvent)) {
			throw new Error("Message event was not of type CustomEvent");
		}
		const newX = e.detail.x ?? x;
		const newY = e.detail.y ?? y;

		const params = new URLSearchParams(window.location.search);
		params.set("x", String(newX));
		params.set("y", String(newY));
		const newUrl = `${window.location.pathname}?${params.toString()}`;
		window.history.pushState({}, "", newUrl);
		pos(newX, newY);
	});
	message.addEventListener("name-click", (/**@type {Event}*/e) => {
		if (!(e instanceof CustomEvent)) {
			throw new Error("Message event was not of type CustomEvent");
		}
		const { messageId, senderId } = e.detail;
		if (messageId > 0) {
			chatMentionUser(senderId);
		}
	});
	message.addEventListener("context-menu", (/**@type {Event}*/e) => {
		const mouseEvent = /**@type {import("./game-elements.js").LiveChatMouseEvent}*/(e);

		if (mouseEvent.messageId > 0) {
			onChatContext(mouseEvent, mouseEvent.senderId, mouseEvent.messageId);
		}
	});
	message.addEventListener("report-click", (/**@type {Event}*/e) => {
		if (!(e instanceof CustomEvent)) {
			throw new Error("Message event was not of type CustomEvent");
		}
		const { messageId, senderId } = e.detail;
		chatReport(messageId, senderId);
	});
	message.addEventListener("reply-click", (/**@type {Event}*/e) => {
		if (!(e instanceof CustomEvent)) {
			throw new Error("Message event was not of type CustomEvent");
		}
		const { messageId, senderId } = e.detail;
		chatReply(messageId, senderId);
	});
	message.addEventListener("react-click", (/**@type {Event}*/e) => {
		if (!(e instanceof CustomEvent)) {
			throw new Error("Message event was not of type CustomEvent");
		}
		const { messageId, messageElement } = e.detail;

		// Open react panel singleton element
		const chatReactionsPanel = /**@type {HTMLElement}*/($("#chatReactionsPanel"));
		chatReactionsPanel.setAttribute("open", "true");
		
		const bounds = messageElement.getBoundingClientRect();
		const panelHeight = chatReactionsPanel.offsetHeight;
		const viewportHeight = window.innerHeight;
		const topPosition = Math.min(bounds.y, viewportHeight - panelHeight - 8); // Ensure it stays on screen
	
		// Apply position
		chatReactionsPanel.style.right = "8px";
		chatReactionsPanel.style.top = `${Math.max(8, topPosition)}px`; // Ensure it doesn't go off the top
	
		chatReactionsPanel.addEventListener("emojiselection", (/**@type {Event}*/e) => {
			if (!(e instanceof CustomEvent)) {
				throw new Error("Emoji selection event was not of type CustomEvent");
			}

			const { key } = e.detail;
			if (chatReact) {
				chatReact(messageId, key);
			}
			chatReactionsPanel.removeAttribute("open");
		});

		chatReactionsPanel.addEventListener("close", () => {
			chatReactionsPanel.removeAttribute("open");
		})
	});
	message.addEventListener("moderate-click", (/**@type {Event}*/e) => {
		if (!(e instanceof CustomEvent)) {
			throw new Error("Message event was not of type CustomEvent");
		}
		const { senderId, messageId, messageElement } = e.detail;
		chatModerate("delete", senderId, messageId, messageElement);
	});

	// Apply user blocking — use normalised numeric list (see chat-helpers.js)
	if (message.senderIntId !== 0 && isBlocked(message.senderIntId, blockedUsers)) {
		message.style.color = "transparent";
		message.style.textShadow = "0px 0px 6px black";
	}

	if (isMention(message.content, chatName, intId)) {
		message.setAttribute("mention", "true");
		if (message.senderIntId !== intId && !isBlocked(message.senderIntId, blockedUsers)) {
			runAudio(AUDIOS.closePalette);
		}
	}

	return message;
}

// Name panel
namePanelCloseButton.addEventListener("click", () => {
	namePanel.style.visibility = "hidden";
});
nameInput.addEventListener("keydown", function(e) {
	if (e.key == "Enter") {
		nameInput.blur();
		sendServerMessage("setName", nameInput.value);
	}
	else if (e.key == "Escape") {
		namePanel.style.visibility = "hidden";
	}
	else if (e.key == "Backspace" && nameInput.value.length == 0) {
		namePanel.style.visibility = "hidden";
	}
});
nameInput.addEventListener("input", function() {
	nameInput.value = nameInput.value.replace(/\W+/g, "").toLowerCase()
});
const nameButton = /**@type {HTMLButtonElement}*/($("#nameButton"));
nameButton.addEventListener("click", function() {
	nameInput.blur();
	sendServerMessage("setName", nameInput.value);
});

/**
 * @param {string} command
 * @param {string} message
 */
function handleLiveChatCommand(command, message) {
	switch (command) {
		case "name": {
			namePanel.style.visibility = "visible";
			nameInput.value = message.slice(5).trim();
			break;
		}
		case "vip": {
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
			showPlacerInfo(x, y);
			break;
		}
		case "help": {
			const newMessage = createLiveChatMessageElement(0, `
# Chat Styling Guide ✨
Text in rplace chat can be styled using a simplified version of markdown:
**bold**, *italic*, ||spoilers||, __underline__, \`code\` & ~strikethrough~.

## Text Formatting:
- \`**bold me**\` → **I didn't skip leg day**
- \`*italize me*\` → *whispering sweet nothings*
- \`__underline me__\` → __the terms no-one read__
- \`~strike me out~\` → ~~pineapple pizza is actually ok~~
- \`||spoil the plot||\` → ||Bruce Willis was dead the whole time||
- \`sudo rm -fr /\` → Remove french translations for a faster PC

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
:vip        :name
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
(^ Will set your username to 'zekiah')`, 0, Date.now(), ":HELP@RPLACE.LIVE");
			chatMessages.insertAdjacentElement("beforeend", newMessage);
			break;
		}
	}
}

/**
 * @param {import("./game-state.js").LiveChatHistoryInfo} params - The parameters for adding chat messages.
 */
function addLiveChatMessages({ channel, messages, before }) {
	if (channel !== currentChannel) {
		return;
	}

	/** @type {Promise<void>[]} */
	const messageRenderPromises = [];

	messages.forEach(msgData => {
		const senderChatName = intIdNames.get(msgData.senderIntId) || null;
		/** @type {import("./game-elements.js").LiveChatMessage}*/
		const newMessage = createLiveChatMessageElement(
			msgData.messageId,
			msgData.content,
			msgData.senderIntId,
			msgData.sendDate,
			senderChatName,
			msgData.repliesTo,
			msgData.reactions
		);

		// Apply interactivity to message element
		applyLiveChatMessageInteractivity(newMessage, channel);

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
addIpcMessageHandler("addLiveChatMessages", addLiveChatMessages);
window.addEventListener("livechathistory", event => {
	addLiveChatMessages(event.detail);
});
function handleClientViewport(/**@type {[number, number]}*/[boardRenderer]) {
	if (boardRenderer === RENDERER_TYPE.BoardRenderer3D) {
		throw new Error("Not implemented");
	}
	else if (boardRenderer === RENDERER_TYPE.BoardRendererMesh) {
		throw new Error("Not implemented");
	}
	else if (boardRenderer === RENDERER_TYPE.BoardRendererSphere) {
		const renderer = new BoardRendererSphere(viewportCanvas);
		setViewportRenderer(renderer);
	}
	renderAll();
}
addIpcMessageHandler("handleClientViewport", value => {
	setPlacementMode(value[1]);
	handleClientViewport(value);
});
window.addEventListener("clientviewport", event => {
	handleClientViewport(event.detail);
});
addIpcMessageHandler("handleClientTheme", (/**@type {[string,string,string]}*/[id, variant, effects]) => {
	throw new Error("Not implemented");
});

chatMessages.addEventListener("scroll", () => {
	if (chatMessages.scrollTop < 64) {
		if (chatPreviousAutoLoad === true && chatPreviousLoadDebounce === false) {
			const oldestMessage = /**@type {import("./game-elements.js").LiveChatMessage|null}*/(chatMessages.children[0]);
			sendServerMessage("requestLoadChannelPrevious", {
				channel: currentChannel,
				anchorMsgId: oldestMessage?.messageId || 0
			});
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
	const oldestMessage = /**@type {import("./game-elements.js").LiveChatMessage|null}*/(chatMessages.children[0]);
	sendServerMessage("requestLoadChannelPrevious", {
		channel: currentChannel,
		anchorMsgId: oldestMessage?.messageId || 0
	});
	chatPreviousLoadDebounce = true;
	// Keep loading previous for this channel as they scroll up
	chatPreviousAutoLoad = true	;
})

/** @type {import("./chat-helpers.js").MentionToken[]} */
let messageMentionTokens = [];
let previousMessageInputValue = messageInput.value;

function renderMessageInputMirror() {
	let previousTokenEnd = 0;
	messageMentionTokens = messageMentionTokens
		.filter(token => token.start >= 0 && token.end <= messageInput.value.length &&
			messageInput.value.slice(token.start, token.end) === token.label)
		.sort((first, second) => first.start - second.start)
		.filter(token => {
			if (token.start < previousTokenEnd) return false;
			previousTokenEnd = token.end;
			return true;
		});

	const fragment = document.createDocumentFragment();
	let currentIndex = 0;
	for (const token of messageMentionTokens) {
		fragment.append(document.createTextNode(messageInput.value.slice(currentIndex, token.start)));
		const highlight = document.createElement("span");
		highlight.className = "linked-mention";
		highlight.textContent = token.label;
		fragment.append(highlight);
		currentIndex = token.end;
	}
	fragment.append(document.createTextNode(messageInput.value.slice(currentIndex)));
	messageInputMirror.replaceChildren(fragment);
	messageInputMirror.scrollTop = messageInput.scrollTop;
	messageInputMirror.scrollLeft = messageInput.scrollLeft;
}

function syncMessageInputValue() {
	const nextValue = messageInput.value;
	messageMentionTokens = rebaseMentionTokens(messageMentionTokens,
		findTextEdit(previousMessageInputValue, nextValue));
	previousMessageInputValue = nextValue;
	renderMessageInputMirror();
}

/** @param {string} value */
function setMessageInputValue(value) {
	messageInput.value = value;
	syncMessageInputValue();
	updateMessageInputHeight();
}

function clearMessageInput() {
	messageInput.value = "";
	previousMessageInputValue = "";
	messageMentionTokens = [];
	renderMessageInputMirror();
	updateMessageInputHeight();
}

function getMessageInputWireValue() {
	return serialiseMentionTokens(messageInput.value, messageMentionTokens);
}

messageInput.addEventListener("scroll", () => {
	messageInputMirror.scrollTop = messageInput.scrollTop;
	messageInputMirror.scrollLeft = messageInput.scrollLeft;
});
renderMessageInputMirror();

messageInput.addEventListener("keydown", function(/**@type {KeyboardEvent}*/ e) {
	if (!(e instanceof Event) || !e.isTrusted) {
		return;
	}

	openChatPanel();
	if (e.key == "Escape" && !messageEmojisPanel.hasAttribute("closed")) {
		closeMessageEmojisPanel();
		e.preventDefault();
	}
	else if (e.key == "Enter" && !e.shiftKey) {
		let sent = false;
		// ctrl + enter send as place chat, enter send as normal live chat
		if (e.ctrlKey) {
			sent = sendPlaceChatMsg(messageInput.value, e);
		}
		else {
			sent = sendLiveChatMsg(getMessageInputWireValue(), e);
		}
		e.preventDefault()
		if (sent) {
			clearMessageInput()
		}
	}
});
messageInput.addEventListener("focus", openChatPanel);

/**
 * @param {string} text
 * @returns {{ start: number; end: number }}
 */
function chatInsertText(text) {
	const [ start, end ] = [ messageInput.selectionStart ?? 0, messageInput.selectionEnd ?? 0 ]
	messageInput.setRangeText(text, start, end, "end")
	messageMentionTokens = rebaseMentionTokens(messageMentionTokens, {
		start,
		oldEnd: end,
		newEnd: start + text.length
	})
	previousMessageInputValue = messageInput.value
	renderMessageInputMirror()
	updateMessageInputHeight()
	messageInput.focus()
	return { start, end: start + text.length }
}

/**
 * @param {number} senderId
 */
function chatMentionUser(senderId) {
	if (!Number.isSafeInteger(senderId) || senderId <= 0) return;
	const label = `@${intIdNames.get(senderId) || `#${senderId}`}`;
	const insertedRange = chatInsertText(label + " ");
	messageMentionTokens.push({
		start: insertedRange.start,
		end: insertedRange.start + label.length,
		label,
		intId: senderId
	});
	renderMessageInputMirror();
}

messageTypePanel.children[0].addEventListener("click", function (/**@type {Event}*/e) {
	if (!e.isTrusted) {
		return;
	}

	if (sendPlaceChatMsg(messageInput.value, e)) {
		clearMessageInput();
	}
});
messageTypePanel.children[1].addEventListener("click", function(/**@type {Event}*/e) {
	if (!e.isTrusted) {
		return;
	}

	if (sendLiveChatMsg(getMessageInputWireValue(), e)) {
		clearMessageInput();
	}
});

messageInputGifPanel.addEventListener("gifselection", function(/**@type {Event}*/e) {
	if (!(e instanceof CustomEvent)) {
		throw new Error("Gif selection event was not of type CustomEvent");
	}

	const gif = e.detail;
	if (!gif) {
		return;
	}
	messageInputGifPanel.removeAttribute("open")
	sendLiveChatMsg(`[gif:${gif.id}:tenor]`); // TODO: Put gif URL in ()
});

messageInputGifPanel.addEventListener("close", function(e) {
	messageInputGifPanel.removeAttribute("open");
});

/**
 * @param {string} message 
 * @param {Event} [e]
 */
function sendPlaceChatMsg(message, e) {
	if (!requirePasskeyForAction()) {
		return false;
	}
	const position = Math.floor(y) * WIDTH + Math.floor(x);
	sendServerMessage("sendPlaceChatMsg", { message, position }, e);
	return true;
}

/**
 * @param {string} message 
 * @param {Event} [e]
 * @param {string} channel 
 * @param {number|null} replyId 
 * @returns 
 */
function sendLiveChatMsg(message, e, channel=currentChannel, replyId=currentReplyId) {
	if (!requirePasskeyForAction()) {
		return false;
	}
	// Execute live chat commands
	for (const [command] of COMMANDS) {
		if (message.startsWith(":" + command)) {
			handleLiveChatCommand(command, message);
			return true;
		}
	}

	// VIP key leak detection
	if (localStorage.vip && message.includes(localStorage.vip)) {
		alert("Can't send VIP key in chat. Use ':vip yourvipkeyhere' to apply a VIP key");
		return false;
	}

	sendServerMessage("sendLiveChatMsg", { message, channel, replyId }, e);
	chatCancelReplies();
	return true;
}

/**
 * @param {any} messageId
 * @param {number} senderId
 */
async function chatReply(messageId, senderId) {
	for (const messageEl of cMessages.get(currentChannel) || []) {
		messageEl.removeAttribute("reply")
	}
	currentReplyId = messageId

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

/**
 * @param {number} messageId 
 * @param {number} senderId 
 */
function chatReport(messageId, senderId) {
	const reason = prompt("Enter the reason for why you are reporting this message (max 280 chars)\n\n" +
		`Additional info:\nMessage ID: ${messageId}\nSender ID: ${senderId}\n`)?.trim();
	if (!reason || reason.length === 0) {
		return;
	}
	sendServerMessage("chatReport", { messageId, reason });
	alert("Report sent!\nIn the meantime you can block this user by 'right clicking / press hold on the message' > 'block'");
}

/**
 * @param {number} messageId 
 * @param {string} reactKey 
 */
function chatReact(messageId, reactKey) {
	sendServerMessage("chatReact", { messageId, reactKey });
}

function chatCancelReplies() {
	for (const messageEl of cMessages.get(currentChannel) || []) {
		messageEl.removeAttribute("reply")
	}
	currentReplyId = null
	// TODO: Use CSS classes / find a better solution
	// HACK: Ensure no overlap between reply and send features
	messageTypePanel.style.height = "calc(var(--message-input-height) + 62px)"
	messageReplyPanel.setAttribute("closed", "true")
}

messageCancelReplyButton.addEventListener("click", function(e) {
	chatCancelReplies();
});

// Moderation UI
/**
 * @typedef {"kick" | "mute" | "ban" | "captcha" | "delete"} ModAction
 */
/**
 * @typedef {Object} BaseModOptions
 * @property {ModAction} action
 * @property {string} reason
 */
/**
 * @typedef {BaseModOptions & { action: "kick", memberId: number }} KickOptions
 */
/**
 * @typedef {BaseModOptions & { action: "mute" | "ban", memberId: number, duration: number }} MuteBanOptions
 */
/**
 * @typedef {BaseModOptions & { action: "captcha", memberId: number, affectsAll: boolean }} CaptchaOptions
 */
/**
 * @typedef {BaseModOptions & { action: "delete", messageId: number }} DeleteOptions
 */
/**
 * @typedef {KickOptions | MuteBanOptions | CaptchaOptions | DeleteOptions} ModOptions
 */
const modOptionsButton = /**@type {HTMLButtonElement}*/($("#modOptionsButton"));
modOptionsButton.addEventListener("click", async function() {
	const options = getModOptions();
	if (!options) {
		return;
	}
	modOptionsButton.disabled = true;
	try {
		const result = await sendModerationAction(options, localStorage.vip);
		alert(result.message);
		clearChatModerate();
	}
	catch (error) {
		alert(error instanceof Error ? error.message : "Moderation action failed");
	}
	finally {
		modOptionsButton.disabled = !modReason.value;
	}
});
modMessageId.addEventListener("input", async function(e) {
	// Show loading state immediately
	modMessagePreview.textContent = await translate("loadingMessage");

	// Check local cache first
	let found = null;
	for (const message of (cMessages.get(currentChannel) || [])) {
		if (message.messageId === Number(modMessageId.value)) {
			found = message;
			break;
		}
	}

	if (found) {
		// Display local cached message immediately
		modMessagePreview.innerHTML = found.innerHTML;
	}
	else {
		// Try to fetch the message from the server using live chat history API
		try {
			const httpServerUrl = (localStorage.server || DEFAULT_SERVER)
				.replace("wss://", "https://").replace("ws://", "http://");
			const url = `${httpServerUrl}/live-chat/messages/${modMessageId.value}`;

			const response = await fetch(url);
			if (!response.ok) {
				throw new Error("Message not found");
			}

			const message = await response.json();
			if (message) {
				const chatName = message.sender.chatName ?? null;

				// Use createLiveChatMessage to build the HTML element
				const messageElement = createLiveChatMessageElement(message.id, message.message, message.senderIntId,
					message.date * 1000, chatName, message.repliesTo, null);

				modMessagePreview.innerHTML = "";
				modMessagePreview.appendChild(messageElement);
			}
			else {
				modMessagePreview.textContent = await translate("messageNotFound");
			}
		}
		catch (error) {
			modMessagePreview.textContent = await translate("messageNotFound");
		}
	}
});
/**
 * @returns {ModOptions | null}
 */
function getModOptions() {
	const reason = modReason.value.slice(0, 300);
	const memberId = +modUserId.value;
	const messageId = +modMessageId.value;
	const affectsAll = modAffectsAll.checked;

	if (modActionKick.checked) {
		return { action: "kick", reason, memberId };
	}
	else if (modActionMute.checked || modActionBan.checked) {
		const seconds = (+modDurationS.value || 0);
		const minutes = (+modDurationM.value || 0);
		const hours = (+modDurationH.value || 0);
		const duration = seconds + minutes * 60 + hours * 3600;
		return {
			action: modActionMute.checked ? "mute" : "ban",
			reason,
			memberId,
			duration
		};
	}
	else if (modActionCaptcha.checked) {
		return {
			action: "captcha",
			reason,
			memberId,
			affectsAll
		};
	}
	else if (modActionDelete.checked) {
		return {
			action: "delete",
			reason,
			messageId
		};
	}

	return null;
}
function clearChatModerate() {
	modMessageId.value = "";
	modMessagePreview.innerHTML = "";
	modDurationH.value = "0";
	modDurationM.value = "0";
	modDurationS.value = "0";
	modAffectsAll.checked = false;
	modReason.value = "";
}
function closeChatModerate() {
	moderationMenu.removeAttribute("open");
	clearChatModerate();
}
modCloseButton.addEventListener("click", closeChatModerate);
modCancelButton.addEventListener("click", closeChatModerate);
const modReviewButton = /**@type {HTMLButtonElement}*/($("#modReviewButton"));
modReviewButton.addEventListener("click", function() {
	openModerationReview();
});

modActionForm.addEventListener("change", (e) => {
	if (!(e.target instanceof HTMLInputElement)) {
		return;
	}

	if (e.target.name === "modAction") {
		moderationMenu.setAttribute("mode", e.target.value);
	}
});

modReason.addEventListener("input", function() {
	modOptionsButton.disabled = !modReason.value;
});

/**
 * @param {"delete"|"kick"|"mute"|"ban"|"captcha"} mode
 * @param {number|null} senderId
 * @param {import("./game-elements.js").LiveChatMessage|null} messageElement
 */
function chatModerate(mode, senderId, messageId = null, messageElement = null) {
	clearChatModerate()
	modUserId.value = String(senderId);
	modMessageId.value = String(messageId);
	moderationMenu.setAttribute("open", "true");
	moderationMenu.setAttribute("mode", mode);
	modMessagePreview.innerHTML = messageElement?.innerHTML || "";

	switch(mode) {
		case "delete":
			modActionDelete.checked = true;
			break;
		case "kick":
			modActionKick.checked = true;
			break;
		case "mute":
			modActionMute.checked = true;
			break;
		case "ban":
			modActionBan.checked = true;
			break;
		case "captcha":
			modActionCaptcha.checked = true;
			break;
	}
}

async function renderModerationReview() {
	moderationReviewList.replaceChildren();
	const records = moderationReviewRecords.get(moderationReviewType) || [];
	for (const record of records) {
		const element = /** @type {import("./game-elements.js").PunishmentRecordElement} */(
			document.createElement("r-punishment-record"));
		element.record = record;
		moderationReviewList.append(element);
	}
	if (records.length > 0) moderationReviewStatus.textContent = "";
	else if (!moderationReviewLoading.has(moderationReviewType) &&
		moderationReviewStatus.textContent === await translate("loadingPunishmentRecords")) {
		moderationReviewStatus.textContent = await translate("noPunishmentRecords");
	}
	moderationReviewMoreButton.hidden = !moderationReviewHasMore.get(moderationReviewType);
	moderationReviewMoreButton.disabled = moderationReviewLoading.has(moderationReviewType);
}

async function loadModerationReview(reset=false) {
	const type = moderationReviewType;
	if (moderationReviewLoading.has(type)) return;
	moderationReviewLoading.add(type);
	if (reset) {
		moderationReviewOffsets.set(type, 0);
		moderationReviewRecords.set(type, []);
	}
	moderationReviewStatus.textContent = await translate("loadingPunishmentRecords");
	moderationReviewMoreButton.disabled = true;
	try {
		const offset = moderationReviewOffsets.get(type) || 0;
		const result = await listPunishments(type, offset, localStorage.vip);
		if (type !== moderationReviewType) return;
		const records = reset ? result.records : [
			...(moderationReviewRecords.get(type) || []), ...result.records
		];
		moderationReviewRecords.set(type, records);
		moderationReviewOffsets.set(type, result.nextOffset ?? offset + result.records.length);
		moderationReviewHasMore.set(type, Boolean(result.hasMore));
		moderationReviewStatus.textContent = "";
	}
	catch (error) {
		if (type === moderationReviewType) {
			moderationReviewStatus.textContent = error instanceof Error
				? error.message : await translate("couldNotLoadPunishmentRecords");
		}
	}
	finally {
		moderationReviewLoading.delete(type);
		if (type === moderationReviewType) await renderModerationReview();
	}
}

/** @param {"mute"|"ban"} type */
function selectModerationReviewType(type) {
	moderationReviewType = type;
	moderationMutesTab.setAttribute("aria-selected", String(type === "mute"));
	moderationBansTab.setAttribute("aria-selected", String(type === "ban"));
	void loadModerationReview(true);
}

function openModerationReview() {
	if (!moderationReviewDialog.open) moderationReviewDialog.showModal();
	selectModerationReviewType(moderationReviewType);
}

moderationReviewCloseButton.addEventListener("click", () => moderationReviewDialog.close());
moderationMutesTab.addEventListener("click", () => selectModerationReviewType("mute"));
moderationBansTab.addEventListener("click", () => selectModerationReviewType("ban"));
moderationReviewMoreButton.addEventListener("click", () => void loadModerationReview(false));
moderationReviewList.addEventListener("appeal-decision", async event => {
	if (!(event instanceof CustomEvent)) return;
	const recordElement = /** @type {import("./game-elements.js").PunishmentRecordElement|undefined} */(
		event.composedPath().find(element =>
			element instanceof HTMLElement && element.tagName === "R-PUNISHMENT-RECORD"));
	if (!recordElement) return;
	recordElement.busy = true;
	let reloadAfterFailure = false;
	try {
		await resolvePunishmentAppeal(event.detail.type, event.detail.punishmentId,
			event.detail.decision, event.detail.response, localStorage.vip);
		await loadModerationReview(true);
	}
	catch (error) {
		recordElement.busy = false;
		recordElement.errorMessage = error instanceof Error ? error.message : await translate("couldNotResolveAppeal");
		reloadAfterFailure = typeof error === "object" && error !== null &&
			"status" in error && error.status === 409;
	}
	if (reloadAfterFailure) await loadModerationReview(true);
});

// Chat messages UI
function closeMessageEmojisPanel() {
	messageEmojisPanel.setAttribute("closed", "true");
	messageInput.setAttribute("state", "default");
}

/** @param {{ query: string; start: number; end: number }} mentionQuery */
function showMentionSuggestions(mentionQuery) {
	const matches = Array.from(intIdNames.entries())
		.filter(([userId, name]) => Number.isSafeInteger(userId) && userId > 0 &&
			typeof name === "string" && name.toLowerCase().startsWith(mentionQuery.query))
		.sort(([firstId, firstName], [secondId, secondName]) =>
			firstName.localeCompare(secondName) || firstId - secondId)
		.slice(0, 8);

	for (const [userId, name] of matches) {
		const entryElement = document.createElement("button");
		entryElement.classList.add("message-emojis-suggestion", "message-mention-suggestion");
		entryElement.title = `Mention @${name} as ${formatMention(userId)}`;

		const entryLabel = document.createElement("span");
		entryLabel.textContent = `@${name}`;
		const entryId = document.createElement("small");
		entryId.textContent = `#${userId}`;
		entryElement.append(entryLabel, entryId);

		entryElement.addEventListener("click", function() {
			messageInput.setSelectionRange(mentionQuery.start, mentionQuery.end);
			chatMentionUser(userId);
			closeMessageEmojisPanel();
			updateMessageInputHeight();
		});
		messageEmojisPanel.appendChild(entryElement);
	}

	if (matches.length === 0) return false;
	messageInput.setAttribute("state", "command");
	messageEmojisPanel.removeAttribute("closed");
	return true;
}

let messageInputHeight = messageInput.scrollHeight
function updateMessageInputHeight() {
	messageInput.style.height = "0px";
	const oldHeight = messageInputHeight;
	messageInputHeight = Math.min(messageInput.scrollHeight, 256);
	chatPanel.style.setProperty("--message-input-height", messageInputHeight + "px");
	messageInput.style.height = ""; // unset
	const diffHeight = messageInputHeight - oldHeight;
	chatMessages.scrollBy(0, diffHeight);
}
if (document.readyState !== "loading") {
	updateMessageInputHeight();
}
else {
	window.addEventListener("DOMContentLoaded", updateMessageInputHeight);
}

messageInput.oninput = (/** @type {{ isTrusted: any; }} */ e) => {
	if (!e.isTrusted) {
		return;
	}
	syncMessageInputValue();
	updateMessageInputHeight();

	messageEmojisPanel.innerHTML = "";
	const mentionQuery = findMentionQuery(messageInput.value,
		messageInput.selectionStart ?? messageInput.value.length);
	if (mentionQuery) {
		if (!showMentionSuggestions(mentionQuery)) {
			closeMessageEmojisPanel();
		}
		return;
	}

	let comp = "";
	let search = true;
	let count = 0;
	for (let i = messageInput.value.length - 1; i >= 0; i--) {
		// No emoji code will ever have a space before we reach the opening : (going backwards
		// through string) so we can guess to just stop if seen as we backtrack
		if (messageInput.value[i] == " " && search) {
			comp = "";
			break;
		}
		else if (messageInput.value[i] == ":") {
			count++;
			search = false;
		}
		if (search) {
			comp = messageInput.value[i] + comp;
		}
	}
	// All : already closed, they are probably not trying to do an emoji so we ignore
	if (count % 2 == 0) {
		comp = "";
	}

	if (comp) {
		messageInput.setAttribute("state", "command");
	}
	else {
		closeMessageEmojisPanel();
	}

	/**
	 * @param {any} emojiCode
	 */
	function createEmojiEntry(emojiCode) {
		const entryElement = document.createElement("button");
		entryElement.classList.add("message-emojis-suggestion");
		entryElement.title = `Send this emoji in chat with :${emojiCode}:`;
		const entryLabel = document.createElement("span");
		entryLabel.textContent = `:${emojiCode}:`;
		entryElement.appendChild(entryLabel);
		return entryElement;
	}

	let handled = false;
	for (const [emojiCode, value] of EMOJIS) {
		if (comp && emojiCode.startsWith(comp)) {
			const entryElement = createEmojiEntry(emojiCode);
			const entryValueText = document.createTextNode(value);
			entryElement.appendChild(entryValueText);
			entryElement.addEventListener("click", function() {
				for (let i = messageInput.value.length - 1; i >= 0; i--) {
					if (messageInput.value[i] == ":") {
						setMessageInputValue(messageInput.value.slice(0, i) + value);
						closeMessageEmojisPanel();
						break
					}
				}
			})
			messageEmojisPanel.appendChild(entryElement);
			messageEmojisPanel.removeAttribute("closed");
		}

		if (messageInput.value.includes(":" + emojiCode + ":")) {
			setMessageInputValue(messageInput.value.replace(":" + emojiCode + ":", value));
			messageInput.setAttribute("state", "default");
			handled = true;
		}
	}
	if (!handled) for (const [emojiCode, value] of CUSTOM_EMOJIS) {
		if (comp && emojiCode.startsWith(comp)) {
			const entryElement = createEmojiEntry(emojiCode);
			entryElement.appendChild(stringToHtml(value));
			entryElement.addEventListener("click", function() {
				for (let i = messageInput.value.length - 1; i >= 0; i--) {
					if (messageInput.value[i] == ":") {
						setMessageInputValue(messageInput.value.slice(0, i) + ":" + emojiCode + ":");
						closeMessageEmojisPanel();
						break;
					}
				}
			})
			messageEmojisPanel.appendChild(entryElement);
			messageEmojisPanel.removeAttribute("closed");
		}

		if (messageInput.value.includes(":" + emojiCode + ":")) {
			messageInput.setAttribute("state", "default");
			handled = true;
		}
	}
	if (!handled) for (const [commandCode, value] of COMMANDS) {
		if (comp && commandCode.startsWith(comp)) {
			const entryElement = document.createElement("button");
			entryElement.classList.add("message-emojis-suggestion");
			entryElement.title = `Use this command in chat :${commandCode} [ARGUMENTS]`;
			const entryLabel = document.createElement("span");
			entryLabel.textContent = `:${commandCode}`;
			entryElement.appendChild(entryLabel);
			entryElement.addEventListener("click", function() {
				setMessageInputValue(":" + commandCode);
				closeMessageEmojisPanel();
			})
			entryElement.appendChild(stringToHtml(value))
			messageEmojisPanel.appendChild(entryElement);
			messageEmojisPanel.removeAttribute("closed");
		}

		if (messageInput.value.includes(":" + commandCode)) {
			messageInput.setAttribute("state", "default");
			handled = true;
		}
	}
}

messageInputEmojiPanel.addEventListener("emojiselection", (/**@type {Event}*/e) => {
	if (!(e instanceof CustomEvent)) {
		throw new Error("Emoji selection event was not of type CustomEvent");
	}

	messageInputEmojiPanel.removeAttribute("open")
	if (CUSTOM_EMOJIS.has(e.detail.key)) {
		chatInsertText(`:${e.detail.key}:`)
	}
	else {
		chatInsertText(e.detail.value)
	}
});

messageInputEmojiPanel.addEventListener("close", (e) => {
	messageInputEmojiPanel.removeAttribute("open");
});

// Spectation
spectateCloseButton.addEventListener("click", function(e) {
	spectateMenu.removeAttribute("open");
	sendServerMessage("unspectateUser", undefined);
});
spectateUserIdInput.addEventListener("change", function(e) {
	const spectateUserId = Number(spectateUserIdInput.value);
	if (spectateUserId == intId) {
		alert("Can't spectate user " + spectateUserId);
		return;
	}
	sendServerMessage("spectateUser", spectateUserId);
});

/**
 * @param {number} userIntId
 */
async function startedSpectating(userIntId) {
	spectateStartState = { x, y, z };
	const spectatingChatName = intIdNames.get(userIntId);
	spectateStatusLabel.textContent = (await translate("spectating")) + " " + (spectatingChatName
		? `${spectatingChatName} (#${userIntId})`
		: `#${userIntId}`);
	setCanvasLocked(true);
}
/**
 * @param {number} userIntId
 * @param {string} reason
 */
function stoppedSpectating(userIntId, reason) {
	const startState = spectateStartState ?? { x: WIDTH / 2, y: HEIGHT / 2, z: 0 };
	const spectateEndMaxTransition = 2000;
	const maxTransitionDuration = Math.min(spectateEndMaxTransition, COOLDOWN);

	if (typeof reason === "string" && reason !== "") {
		alert(`Stopped spectating ${userIntId}: ${reason}`);
	}

	// Move back to original position before releasing canvas controls
	moveTo(startState.x, startState.y, startState.z, maxTransitionDuration);
	setTimeout(() => {
		spectateUserIdInput.value = "";
		spectateStatusLabel.textContent = "";
		setCanvasLocked(false);
	}, maxTransitionDuration);
}


// Server configuration & themes
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

// Theme
function initTheme() {
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
}
if (document.readyState !== "loading") {
    initTheme();
}
else {
    window.addEventListener("DOMContentLoaded", initTheme);
}
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
			themeDropName.textContent = "🖌️ " + targetTheme;
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
themeDropParent.addEventListener("click", function(e) {
	e.stopPropagation();
	themeDropParent.toggleAttribute("open");
})

// Old overlay menu
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
	if (!overlayInput.files || !overlayInput.files[0]) {
		return;
	}
	templateImage.src = URL.createObjectURL(overlayInput.files[0]);
	templateImage.style.opacity = "0.8";
}
async function generateOverlayUrl() {
	if (!overlayInput.files) {
		return null;
	}

	const file = overlayInput.files[0];

	overlayInfo.type = file.type;
	overlayInfo.data = await blobToBase64(file);

	return `${location.origin}/?server=${localStorage.server || DEFAULT_SERVER}&board=${localStorage.board || DEFAULT_BOARD}&overlay=${JSON.stringify(overlayInfo)}`;
}
/**@type {Timer|null}*/let overlayFailTimeout = null;
const overlayCopyButton = /**@type {HTMLButtonElement}*/($("#overlayCopyButton"));
overlayCopyButton.addEventListener("click", async function(e) {
	const uriString = await generateOverlayUrl();
	if (!uriString) {
		return;
	}

	if (uriString.length < 2000) {
		navigator.clipboard.writeText(uriString)
		overlayCopyButton.children[2].animate([
			{ opacity: 1 },
			{ scale: 1.1 }
		], { duration: 1000, iterations: 1 });
	}
	else {
		overlayCopyButton.children[2].textContent = await translate("overlayTooBig");
		overlayCopyButton.children[2].animate([
			{ opacity: 1 },
			{ color: "red" }
		], { duration: 1000, iterations: 1 });
		if (overlayFailTimeout) {
			clearTimeout(overlayFailTimeout);
		}
		overlayFailTimeout = setTimeout(async () => {
			overlayCopyButton.children[2].textContent = await translate("copiedToClipboard");
		}, 1000)
	}
});
const overlayXInput = /**@type {HTMLInputElement}*/($("#overlayXInput"));
overlayXInput.addEventListener("change", () => {
	overlayInfo.x = Number(overlayXInput.value);
	templateImage.style.transform = `translate(${overlayInfo.x}px, ${overlayInfo.y}px)`;
});
const overlayYInput = /**@type {HTMLInputElement}*/($("#overlayYInput"));
overlayYInput.addEventListener("change", () => {
	overlayInfo.y = Number(overlayYInput.value);
	templateImage.style.transform = `translate(${overlayInfo.x}px, ${overlayInfo.y}px)`
});
const overlayOpacity = /**@type {HTMLInputElement}*/($("#overlayOpacity"));
overlayOpacity.addEventListener("change", () => {
	overlayInfo.opacity = Number(overlayOpacity.value) / 100;
	templateImage.style.opacity = String(overlayInfo.opacity);
});
overlayOpacity.addEventListener("input", function() {
	overlaySliderValue.style.setProperty("--value", `${overlayOpacity.value}%`);
	overlaySliderValue.dataset.value = overlayOpacity.value;
})
templateImage.addEventListener("dragstart", (e) => {
	e.preventDefault();
	return false;
});
overlayMenuOldCloseButton.addEventListener("click", function() {
	overlayMenuOld.removeAttribute("open");
});

// Chat management — normalise to numbers to avoid string/number mismatch (old code stored ",")
let blockedUsers = normaliseBlockedUsers(localStorage.blocked?.split(",") || []);
/**@type {number|null}*/let targetedIntId = null;
/**@type {number|null}*/let targetedMsgId = null;
/**@type {number|null}*/let currentReplyId = null;
let openedChat = false;

messageAddEmojiButton.addEventListener("click", function() {
	if (!messageInputEmojiPanel.getAttribute("open")) {
		messageInputEmojiPanel.toggleAttribute("open");
		messageInputGifPanel.removeAttribute("open");
	}
	else {
		messageInputEmojiPanel.removeAttribute("open");
	}
});

messageAddGifButton.addEventListener("click", function() {
	if (!messageInputGifPanel.getAttribute("open")) {
		messageInputGifPanel.setAttribute("open", "true");
		messageInputEmojiPanel.removeAttribute("open")
		messageInputGifPanel.fetchGifs();
	}
	else {
		messageInputGifPanel.removeAttribute("open");
	}
});

messageOptionsButton.addEventListener("click", function() {
	updateMessageInputHeight();
	messageTypePanel.toggleAttribute("closed");
})

// Chat panel
function openChatPanel() {
	chatPanel.setAttribute("open", "true")
	if (!openedChat) {
		openedChat = true;
	}
	chatPanel.inert = false;
}
chatButton.addEventListener("click", openChatPanel);

function closeChatPanel() {
	messageInput.blur();
	messageInputEmojiPanel.removeAttribute("open");
	messageInputGifPanel.removeAttribute("open");
	chatPanel.removeAttribute("open");
	chatPanel.inert = true;
}
chatCloseButton.addEventListener("click", closeChatPanel);
closeChatPanel();

function closeChatContexts() {
	hidePopover(chatContext);
	channelDropParent.removeAttribute("open");
}
chatPanel.addEventListener("touchstart", closeChatContexts);
chatPanel.addEventListener("click", closeChatContexts);

// Close button / space filler transition to posts view
const mainContentObserver = new ResizeObserver((entries) => {
	onMainContentResize();
});
mainContentObserver.observe(mainContent);

helpButton.addEventListener("click", () => {
	if (modal.open) {
		modal.close();
	}
	else {
		modal.showModal();
	}
});

function closeGame() {
	// Lazy load posts frame
	if (!postsFrame.src) {
		postsFrame.src = "/posts.html";
	}

	modal.close();
	closeChatPanel();
	document.body.id = "out";
	onMainContentResize();
}
closeButton.addEventListener("click", closeGame);

function openGame() {
	if (document.body.id != "out") {
		return;
	}
	document.body.id = "";
	onMainContentResize();
}
spaceFiller.addEventListener("click", openGame);

/**
 * @param {MouseEvent} e
 * @param {number} senderId
 * @param {any} msgId
 */
async function onChatContext(e, senderId, msgId) {
	e.preventDefault();

	if (isPopoverOpen(chatContext)) {
		hidePopover(chatContext);
	}
	else {
		let msgName = intIdNames.get(senderId);
		const identifier = msgName || ("#" + senderId);
		if (msgName) {
			if (msgName[msgName.length - 1] === "~") {
				msgName = msgName.slice(0, -1);
				userNote.style.display = "block";
				userNote.textContent = (await translate("impersonatingUser")) + msgName;
			}
			else if (msgName[msgName.length - 1] === "✓") {
				msgName = msgName.slice(0, -1);
				userNote.style.display = "block";
				userNote.textContent = (await translate("verifiedUser")) + msgName;
			}
			else {
				userNote.style.display = "none";
			}
		}

		targetedMsgId = msgId;
		targetedIntId = senderId;
		positionPopover(chatContext, e.clientX, e.clientY);
		showPopover(chatContext);
		mentionUserButton.textContent = `${await translate("mention")} ${identifier}`;
		replyUserButton.textContent = `${await translate("replyTo")} ${identifier}`;
		blockUserButton.textContent =
			`${await translate(isBlocked(senderId, blockedUsers) ? "unblock" : "block")} ${identifier}`;

		if (senderId == intId) {
			blockUserButton.disabled = true;
			changeMyNameButton.style.display = "";
		}
		else  {
			blockUserButton.disabled = false;
			changeMyNameButton.style.display = "none";
		}
	}
}
mentionUserButton.addEventListener("click", function(e) {
	if (!targetedIntId) {
		return;
	}

	chatMentionUser(targetedIntId);
	hidePopover(chatContext);
});
replyUserButton.addEventListener("click", function(e) {
	if (!targetedIntId) {
		return;
	}

	chatReply(targetedMsgId, targetedIntId);
	hidePopover(chatContext);
})
blockUserButton.addEventListener("click", function(e) {
	if (targetedIntId == null) return;
	const normalisedTargetId = Number(targetedIntId);
	if (isBlocked(normalisedTargetId, blockedUsers)) {
		blockedUsers.splice(blockedUsers.indexOf(normalisedTargetId), 1);
	}
	else if (normalisedTargetId !== intId) {
		blockedUsers.push(normalisedTargetId);
	}
	localStorage.blocked = blockedUsers.join(",");
	hidePopover(chatContext);
});
changeMyNameButton.addEventListener("click", function(e) {
	if (!intId) {
		return;
	}

	namePanel.style.visibility = "visible";
	nameInput.value = intIdNames.get(intId) || "";
	hidePopover(chatContext);
});

// TODO: For some inconceivably stupid reason this keeps activating on false positives? Find a solution
/*const verifiedAppHash = "f255e4c294a5413cce887407b91062ac162faec4cb1e6e21cdd6e4492fb270f8";
async function checkVerifiedAppStatus() {
	const urlParams = new URLSearchParams(window.location.search);
	const verifyAppValue = urlParams.get("verify-app");
	if (!verifyAppValue) {
		return "none";
	}
	const hashedValue = await sha256(verifyAppValue);
	return hashedValue === verifiedAppHash ?  "valid" : "invalid";
}
checkVerifiedAppStatus().then(status => {

	if (status === "valid") {
		console.log("Successfully verified rplace.live app");
		return;
	}

	const suspiciousContext = (
		window.location !== window.parent.location
		|| typeof window.Android !== "undefined"
		|| typeof window.Kodular !== "undefined"
	);

	function blockAccess() {
		window.location.replace("https://rplace.live/fakeapp");
		viewport.style.opacity = "0.6";
		viewport.style.pointerEvents = "none";
		//alert("Error: App failed verification - game is being accessed via an unofficial or unauthorised site or app\n" +
		//	"Please report to developers or visit the game online at https://rplace.live");
	}

	if (status === "invalid") {
		blockAccess();
		return;
	}
	else if (import.meta.env.MODE !== "development" && suspiciousContext) {
		blockAccess();
		return;
	}
});*/

// Cancel context menu
window.addEventListener("contextmenu", function(e) {
	e.preventDefault();
});


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
		if (e.target == viewport || canvParent2.contains(targetElement)) {
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
connProblemsResetButton.addEventListener("click", function() {
	localStorage.clear();
	history.pushState(null, "", location.origin);
})

// Ads
chatAdCloseButton.addEventListener("click", (e) => {
	e.stopPropagation();

	chatAd.style.display = "none";
	localStorage.noad = Date.now();
	chatAdLabel.style.display = "block";
	chatAdLabel.animate([
		{ opacity: 1 },
		{ scale: 1.1 }
	], { duration: 1000, iterations: 1, });

	setTimeout(() => {
		chatAdLabel.style.display = "none"
	}, 1000);
});

if (localStorage.noad && Date.now() - localStorage.noad < 1.21e9) { // 14 days
	chatAd.style.display = "none"
}
else {
	let adI = Math.floor(Math.random() * ADS.length)
	function cycleAd() {
		const currentAd = ADS[adI % ADS.length];
		const langBanners = /**@type {Record<string, string>}*/(currentAd.banners);
		chatAd.style.setProperty("--adurl", `url(${langBanners[lang] || langBanners["en"]})`);
		chatAd.href = currentAd.url;
		adI++;
	}
	setInterval(cycleAd, 12e4); // 2 mins
	cycleAd();
}

let initialised = false;
async function initialise() {
	if (initialised) {
		return;
	}
	initialised = true;
	console.log("Initialising...");

	// Perform lang translations
	translateAll();

	// Blank default render and canvas size init before we have loaded board
	sizeChanged(DEFAULT_WIDTH, DEFAULT_HEIGHT);
	renderAll();

	// Hook up cross frame / parent window IPC request handlers
	addIpcMessageHandler("fetchLinkKey", () => makeServerRequest("fetchLinkKey"));
	addIpcMessageHandler("openChatPanel", openChatPanel);
	addIpcMessageHandler("scrollToPosts", scrollToPosts);
	addIpcMessageHandler("defaultServer", defaultServer);
	addIpcMessageHandler("openOverlayMenu", openOverlayMenuOld);
	addIpcMessageHandler("resizePostsFrame", resizePostsFrame);
	window.addEventListener("message", handleIpcMessage);

	// We leave 200ms between connections to ensure server has time to accept us again
	let lastDisconnect = parseInt(localStorage.lastDisconnect ?? "0");
	if (isNaN(lastDisconnect)) {
		lastDisconnect = 0;
	}
	const nextSafeConnectDate = lastDisconnect + 200;

	setTimeout(async () => {
		// Start initialising websocket connection
		const fingerprintJS = await FingerprintJS.load();
		const result = await fingerprintJS.get();
		connect(result.visitorId, localStorage.vip);
	}, Math.max(0, nextSafeConnectDate - Date.now()));
}
if (document.readyState !== "loading") {
	initialise();
}
else {
	window.addEventListener("DOMContentLoaded", initialise);
}
