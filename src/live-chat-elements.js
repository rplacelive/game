import { LitElement, html } from "lit-element"
import { styleMap } from "lit-html/directives/style-map.js"
import { until } from "lit/directives/until.js"
import { unsafeHTML } from "lit/directives/unsafe-html.js"
import { CHAT_COLOURS, EMOJIS, CUSTOM_EMOJIS } from "./defaults.js"
import { sanitise, translate, hash, $, markdownParse } from "./shared.js"
import { chatMentionUser, chatModerate, chatReply, cMessages, currentChannel, onChatContext, pos, x, y, intIdNames, chatReport, chatReact } from "./index.js"

export class LiveChatMessage extends LitElement {
	static properties = {
		messageId: { type: Number, reflect: true, attribute: "messageid" },
		senderId: { type: String, reflect: true, attribute: "senderid" },
		name: { type: String, reflect: true, attribute: "name" },
		sendDate: { type: Number, reflect: true, attribute: "senddate" },
		repliesTo: { type: Number, reflect: true, attribute: "repliesto" },
		content: { type: String, reflect: true, attribute: "content" },
		reactions: { type: Object, attribute: false },
		openedReactionDetails: { type: String, attribute: false },
		class: { reflect: true }
	}
	
	constructor() {
		super()
		this.messageId = null
		this.senderId = null
		this.name = null
		this.sendDate = null
		/**@type {number|null}*/this.repliesTo = null
		this.content = null
		/**@type {Map<string, Set<number>>|null}*/ this.reactions = null
		this.replyingMessage = null
		this.openedReactionDetails = ""
		this.addEventListener("contextmenu", this.#handleContextMenu)
	}

	connectedCallback() {
		super.connectedCallback()
		this.classList.add("message")
	}

	createRenderRoot() {
		return this
	}

	/**
	 * @param {{ messageId: any; txt: any; senderId: any; name: any; sendDate: any; repliesTo?: null | undefined; }} data
	 */
	fromMessage(data) {
		const { messageId, txt, senderId, name, sendDate, repliesTo = null } = data
		this.messageId = messageId
		this.senderId = senderId
		this.name = name
		this.sendDate = sendDate
		this.repliesTo = repliesTo
		this.content = txt
	}

	/**
	 * @param {Map<any, any>} changedProperties
	 */
	willUpdate(changedProperties) {
		if (changedProperties.has("repliesTo") && this.repliesTo !== null) {
			this.replyingMessage = this.#findReplyingMessage()
		}
		if (changedProperties.has("class")) {
			this.classList.add("message")
		}
	}


	/**
	 * @param {string} message Raw message text
	 * @returns {any} Lit HTML output
	 */
	async #parseMessage(message) {
		if (!message) {
			return null
		}

		message = sanitise(message);
		let parsedHTML = await markdownParse(message);

		// Handle emojis
		parsedHTML = parsedHTML.replaceAll(/:([a-z-_]{0,16}):/g, (full, source) => {
			const matches = parsedHTML.match(new RegExp(`:${source}:`, "g"));
			const isLargeEmoji = matches && matches.length === 1 && !parsedHTML.replace(full, "").trim();
			const size = isLargeEmoji ? "48" : "16"
			return `<img src="custom_emojis/${source}.png" alt=":${source}:" title=":${source}:" width="${size}" height="${size}">`;
		})	

		// Handle coordinates and generate final lit HTML
		const formattedMessage = this.#parseCoordinates(parsedHTML);
		return html`${formattedMessage}`
	}

	/**
	 * 
	 * @param {string} parsedHTML 
	 * @returns {any} Lit HTML fragment
	 */
	#parseCoordinates(parsedHTML) {
		const regex = /(\d+),\s*(\d+)/g // Matches coordinate patterns like "10, 20"
		const parts = []
		let lastIndex = 0

		for (const match of parsedHTML.matchAll(regex)) {
			const [fullMatch, x, y] = match
			const startIndex = match.index

			// Push the text before the match
			if (startIndex > lastIndex) {
				parts.push(unsafeHTML(parsedHTML.slice(lastIndex, startIndex)))
			}

			const href = `${window.location.pathname}?x=${x}&y=${y}`
			parts.push(html`<a href="${href}" @click=${(/**@type {MouseEvent}*/e) => 
				this.#handleCoordinateClick(e, parseInt(x, 10), parseInt(y, 10))}>${x},${y}</a>`)

			lastIndex = startIndex + fullMatch.length
		}

		// Push any text following matches
		if (lastIndex < parsedHTML.length) {
			parts.push(unsafeHTML(parsedHTML.slice(lastIndex)))
		}

		return html`${parts}`
	}

	/**
	 * @returns {{ name: string; content: string; fake?: boolean } | null}
	 */
	#findReplyingMessage() {
		if (!cMessages.has(currentChannel)) {
			return { name: "[ERROR]", content: "Channel not found", fake: true };
		}

		const message = cMessages.get(currentChannel)?.find(msg => msg.messageId === this.repliesTo)
		if (!message) {
			const fakeMessage = {
				name: "[ERROR]",
				content: "...",
				fake: true
			};
			translate("messageNotFound").then(translated => fakeMessage.content = translated);
			return fakeMessage;
		}

		return message;
	}
	
	#scrollToReply() {
		if (!this.replyingMessage || this.replyingMessage.fake) {
			return
		}

		const reply = /**@type {LiveChatMessage}*/(this.replyingMessage);
		reply.setAttribute("highlight", "true");
		setTimeout(() => reply.removeAttribute("highlight"), 500);
		reply.scrollIntoView({ behavior: "smooth", block: "nearest" });
	}

	/**
	 * @param {MouseEvent} e
	 * @param {number} newX 
	 * @param {number} newY 
	 */
	#handleCoordinateClick(e, newX, newY) {
		e.preventDefault();
		const params = new URLSearchParams(window.location.search);
		params.set("x", String(x));
		params.set("y", String(y));
		const newUrl = `${window.location.pathname}?${params.toString()}`;
		window.history.pushState({}, "", newUrl);
		pos(newX, newY);
	}

	#handleNameClick() {
		if (this.messageId > 0) {
			chatMentionUser(this.senderId);
		}
	}
	
	#handleContextMenu(/**@type {MouseEvent}*/e) {
		e.preventDefault();
		if (this.messageId > 0) {
			onChatContext(e, this.senderId, this.messageId);
		}
	}
	
	#handleReply() {
		chatReply(this.messageId, this.senderId);
	}
	
	#handleReport() {
		chatReport(this.messageId, this.senderId);
	}
	
	#handleModerate() {
		chatModerate("delete", this.senderId, this.messageId, this);
	}

	#handleReact() {
		// Open react panel singleton element
		const chatReactionsPanel = /**@type {HTMLElement}*/($("#chatReactionsPanel"));
		chatReactionsPanel.setAttribute("open", "true");
		
		const bounds = this.getBoundingClientRect();
		const panelHeight = chatReactionsPanel.offsetHeight;
		const viewportHeight = window.innerHeight;
		const topPosition = Math.min(bounds.y, viewportHeight - panelHeight - 8); // Ensure it stays on screen
	
		// Apply position
		chatReactionsPanel.style.right = "8px";
		chatReactionsPanel.style.top = `${Math.max(8, topPosition)}px`; // Ensure it doesn't go off the top
	
		// @ts-expect-error
		chatReactionsPanel.addEventListener("emojiselection", (/**@type {CustomEvent}*/e) => {
			this.#onReactEmojiSelected(e);
			chatReactionsPanel.removeAttribute("open");
		})
	}

	#onReactEmojiSelected(/**@type {CustomEvent}*/e) {
		const { key } = e.detail;
		if (chatReact) {
			chatReact(this.messageId, key);
		}
	}
	
	#renderName() {
		const nameStyle = {
			color: this.messageId === 0 ? undefined : CHAT_COLOURS[hash("" + this.senderId) & 7]
		}
		
		return html`
			<span 
				class="name ${this.messageId === 0 ? "rainbow-glow" : ""}" style=${styleMap(nameStyle)}
				title=${new Date(this.sendDate * 1000).toLocaleString()}
				@click=${this.#handleNameClick}>[${this.name || ("#" + this.senderId)}]</span>`
	}
	
	#renderReply() {
		if (!this.repliesTo || !this.replyingMessage) {
			return null
		}
		
		return html`
			<p class="reply" @click=${this.#scrollToReply}>
				↪️ ${this.replyingMessage.name} ${this.replyingMessage.content}
			</p>`
	}
	
	#renderActions() {
		if (this.messageId <= 0) {
			return null
		}

		const renderActionButton = async (/**@type {string}*/src, /**@type {string}*/ titleKey, /**@type {unknown}*/ clickHandler) => {
			const title = await translate(titleKey)
			return html`
				<img class="action-button icon-image" src="${src}"
					title="${title}" tabindex="0" @click="${clickHandler}">
			`
		}

		return html`
			<div class="actions">
				${until(renderActionButton("svg/reply-action.svg", "replyTo", this.#handleReply), html`<span>...</span>`)}
				${until(renderActionButton("svg/react-action.svg", "addReaction", this.#handleReact), html`<span>...</span>`)}
				${until(renderActionButton("svg/report-action.svg", "report", this.#handleReport), html`<span>...</span>`)}
				${localStorage.vip?.startsWith("!") ? until(renderActionButton("svg/moderate-action.svg", "Moderation options", this.#handleModerate), html`<span>Loading...</span>`) : null}
			</div>`
	}

	#renderReactions() {
		if (this.reactions == null) {
			return null
		}

		return html`
			<ul class="reactions">
				${this.reactions.entries().map(([emojiKey, reactors]) => {
					let emojiEl = null
					if (EMOJIS.has(emojiKey)) {
						emojiEl = html`<span class="emoji ${this.openedReactionDetails === emojiKey ? "expanded" : ""}">${EMOJIS.get(emojiKey)}</span>`
					}
					else if (CUSTOM_EMOJIS.has(emojiKey)) {
						emojiEl = html`<img src="custom_emojis/${emojiKey}.png" class="emoji ${this.openedReactionDetails === emojiKey ? "expanded" : ""}" alt=":${emojiKey}:" title=":${emojiKey}:" width="18" height="18">`
					}
					if (!emojiEl) {
						return null
					}
					return html`
						<li class="reaction ${this.openedReactionDetails == emojiKey ? "expanded" : ""}">
							<details class="reaction-details" ?open=${this.openedReactionDetails === emojiKey} @toggle=${(/**@type {Event}*/e) => {
								if (e.target?.open) {
									this.openedReactionDetails = emojiKey
								}
								else if (this.openedReactionDetails === emojiKey) {
									this.openedReactionDetails = ""
								}
							}}>
								<summary>
									<div class="emoji-container">
										${emojiEl}
										<span class="emoji-reactors-count">${reactors.size}</span>
										${this.openedReactionDetails == emojiKey ? html`<p>:${emojiKey}:</p>` : null}
									</div>
								</summary>
								<div class="reaction-body">
									<hr>
									<h3>Added by:</h3>
									<ul class="reactors">
										${reactors.entries().map(([reactorId]) => html`
											<li class="reactor" title=${"User ID: #" + reactorId}>
												${intIdNames.has(reactorId)
													? intIdNames.get(reactorId)
													: "#" + reactorId}
											</li>`)}
									</ul>
								</div>
							</details>
						</li>`
				})}
			</ul>
		`
	}

	#renderMessage() {
		return html `<span class="content">${until(this.#parseMessage(this.content), html`...`)}</span>`
	}
		
	render() {
		return html`
			${this.#renderReply()}
			${this.#renderName()}
			${this.#renderMessage()}
			${this.#renderReactions()}
			${this.#renderActions()}`
	}
}
customElements.define("r-live-chat-message", LiveChatMessage)
