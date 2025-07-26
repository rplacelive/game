import { LitElement, html } from "lit-element"
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { styleMap } from "lit/directives/style-map.js";
import { DEFAULT_SERVER, EMOJIS, CUSTOM_EMOJIS } from "./defaults.js";
import { toCapitalised, lerp, translate, generateRandomId } from "./shared.js";
import { openAccountFrame } from "./services/account-manager.js";

class Spoiler extends HTMLElement {
	constructor() {
		super();
		this.addEventListener("click", () => {
			this.show();
		})
	}

	show() {
		this.removeAttribute("hidden");
	}

	static get observedAttributes() {
		return ["hidden"];
	}
}
customElements.define("r-spoiler", Spoiler)

class Gif extends LitElement {
	static get properties() {
		return {
			source: { type: String },
			key: { type: String },
			gifData: { type: Object },
			isLoading: { type: Boolean },
		};
	}

	constructor() {
		super()
		this.source = ""
		this.key = ""
		this.gifData = null
		this.isLoading = true
	}

	createRenderRoot() {
		return this
	}

	connectedCallback() {
		super.connectedCallback()
		this.fetchGifData()
	}

	updated(changedProperties) {
		super.updated(changedProperties)
		if (changedProperties.has("source") || changedProperties.has("key")) {
			this.fetchGifData()
		}
	}

	async fetchGifData() {
		this.isLoading = true
		const httpServerUrl = (localStorage.server || DEFAULT_SERVER)
			.replace("wss://", "https://").replace("ws://", "http://")
		const url = `${httpServerUrl}/gifs/${this.key}?source='${this.source}'`

		try {
			const response = await fetch(url)
			const gifResult = await response.json()
			this.gifData = gifResult
		}
		catch (error) {
			console.error('Error fetching gif data:', error)
		}
		finally {
			this.isLoading = false
		}
	}

	render() {
		return html`
			${this.isLoading
				? html`<div>(Loading GIF...)</div>`
				: this.gifData
					? this.createGifTag(this.gifData)
					: html`<div>(Error loading GIF)</div>`}`
	}

	createGifTag(gif) {
		return html`
			<video style="aspect-ratio: ${gif.width}/${gif.height}" autoplay loop muted playsinline alt="${gif.description}">
				<source src="${gif.source}" type="video/webm">
				${gif.sourceFallback ? html`<source src="${gif.sourceFallback}" type="video/mp4"/>` : ""}
			</video>`
	}
}

customElements.define("r-gif", Gif);
  
class ClipboardCopy extends HTMLElement {
	constructor() {
		super()
	}

	static get observedAttributes() {
		return ["href"]
	}

	async connectedCallback() {
		const clipbardSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
		clipbardSvg.setAttribute("viewBox", "0 0 48 48")
		clipbardSvg.setAttribute("width", "30")
		clipbardSvg.setAttribute("height", "30")
		clipbardSvg.setAttribute("opacity", "0.6")
		clipbardSvg.innerHTML = "<path d=\"M9 43.95q-1.2 0-2.1-.9-.9-.9-.9-2.1V10.8h3v30.15h23.7v3Zm6-6q-1.2 0-2.1-.9-.9-.9-.9-2.1v-28q0-1.2.9-2.1.9-.9 2.1-.9h22q1.2 0 2.1.9.9.9.9 2.1v28q0 1.2-.9 2.1-.9.9-2.1.9Zm0-3h22v-28H15v28Zm0 0v-28 28Z\"/>"
		this.appendChild(clipbardSvg)
		const copyStatusSpan = document.createElement("span")
		copyStatusSpan.className = "copy-status"
		// TODO: Use CSS
		copyStatusSpan.style.opacity = "0"
		copyStatusSpan.style.position = "absolute"
		copyStatusSpan.textContent = await translate("copiedToClipboard")
		this.appendChild(copyStatusSpan)

		this.addEventListener("click", (event) => {
			const source = this.getAttribute("href")
			if (!source) {
				return;
			}

			event.stopPropagation();
			navigator.clipboard.writeText(source);
			copyStatusSpan.animate([
				{ opacity: 1 },
				{ scale: 1.1 }
			], { duration: 1000, iterations: 1, });
		})
	}
}
customElements.define("r-clipboard-copy", ClipboardCopy);

class CloseIcon extends HTMLElement {
	constructor() {
		super()
	}

	connectedCallback() {
		this.innerHTML = `
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" class="active">
				<path d="M18.442 2.442l-.884-.884L10 9.116 2.442 1.558l-.884.884L9.116 10l-7.558 7.558.884.884L10 10.884l7.558 7.558.884-.884L10.884 10l7.558-7.558z" class=""></path>
			</svg>`
		this.tabIndex = 0
		this.addEventListener("keydown", function(event) {
			if (event.key == "Enter" || event.key == " ") {
				this.click()
			}
		})
	}
}
customElements.define("r-close-icon", CloseIcon)

class EmojiPanel extends LitElement {
	constructor() {
		super()
	}

	connectedCallback() {
		super.connectedCallback()
		this.classList.add("context-menu")
		this.classList.add("context-panel")
	}

	/**
	 * @param {Map<any, any>} changedProperties
	 */
	willUpdate(changedProperties) {
		if (changedProperties.has("class")) {
			this.classList.add("context-menu")
			this.classList.add("context-panel")
		}
	}

	createRenderRoot() {
		return this
	}

	render() {
		const values = []
		return html`
			<header class="emojis-header">
				<h3>Select an emoji:</h3>
				<r-close-icon @click=${this.#notifyClose}></r-close-icon>
			</header>
			<div class="emojis-body">
				<ul class="emojis-container">
					${EMOJIS.entries().map(([emojiKey, value]) => {
							let entry = null
							if (!values.includes(value)) {
								entry = html`<li title=${emojiKey}>
										<button type="button" @click=${() => this.#notifySelection(emojiKey, value)}>${value}</button>
									</li>`
							}
							values.push(value)
							return entry
						}
					)}
				</ul>
				<hr>
				<h4>Custom emojis:</h4>
				<ul class="emojis-container">
					${CUSTOM_EMOJIS.entries().map(([emojiKey, value]) =>
						html`<li title=${emojiKey}>
								<button type="button" @click=${() => this.#notifySelection(emojiKey, value)}>${unsafeHTML(value)}</button>
							</li>`
					)}
				</ul>
			</div>`
	}

	#notifyClose() {
		const event = new CustomEvent("close", {
			bubbles: true,
			composed: true
		})
		this.dispatchEvent(event)
	}

	#notifySelection(key, value) {
		const event = new CustomEvent("emojiselection", {
			detail: { key, value },
			bubbles: true,
			composed: true
		})
		this.dispatchEvent(event)
	}
}
customElements.define("r-emoji-panel", EmojiPanel)


/** @typedef {{ next: string, results: GifData[] }} GifResponse */
/** @typedef {{ id: string, source: string, preview: string, width: number, height: number, description: string, sourceFallback: string }} GifData */
class GifPanel extends LitElement {
	static properties = {
		searchTerm: { type: String, attribute: false },
		gifs: { type: Array, attribute: false },
		isLoading: { type: Boolean, attribute: false },
		error: { type: String, attribute: false },
		limit: { state: true },
		next: { state: true }
	}

	static DEFAULT_SEARCH_TERM = "excited"
	#columnCount

	constructor() {
		super();
		/**@type {string}*/this.searchTerm = GifPanel.DEFAULT_SEARCH_TERM;
		/**@type {GifData[]}*/this.gifs = [];
		/**@type {boolean}*/this.isLoading = false;
		/**@type {string|null}*/this.error = null;
		/**@type {string|null}*/this.next = null;
		/**@type {number}*/this.limit = 16;
		/**@type {number}*/this.#columnCount = 1;

		this.classList.add("context-menu", "context-panel");
	}

	connectedCallback() {
		super.connectedCallback();

		const resizeObserver = new ResizeObserver(() => {
			const columnCount = this.#columnCount;
			const newColumnCount = this.#calculateColumns();
			if (columnCount != newColumnCount) {
				this.requestUpdate();
			}
		});
		resizeObserver.observe(this);

		this.addEventListener("scroll", this.#onScroll);
	}

	#onScroll() {
		const scrollPosition = this.scrollTop + this.clientHeight;
		const bottomThreshold = this.scrollHeight - 64;

		if (scrollPosition >= bottomThreshold && !this.isLoading) {
			this.fetchGifs();
		}
	}

	willUpdate(changedProperties) {
		if (changedProperties.has("class")) {
			this.classList.add("context-menu", "context-panel");
		}
	}

	async fetchGifs({ search: searchTerm = this.searchTerm, next = this.next, limit = this.limit } = {}) {
		this.isLoading = true;
		this.error = null;

		try {
			const params = new URLSearchParams();
			params.set("q", encodeURIComponent(searchTerm));
			params.set("limit", String(limit));
			if (next) {
				params.set("pos", next);
			}

			const httpServerUrl = (localStorage.server || DEFAULT_SERVER)
				.replace("wss://", "https://").replace("ws://", "http://")
			const url = `${httpServerUrl}/gifs/search?${params}`;
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			/**@type {GifResponse}*/const gifResponse = await response.json();
			this.gifs = this.gifs.concat(gifResponse.results)
			this.next = gifResponse.next;
			this.searchTerm = searchTerm
		}
		catch (error) {
			console.error("GIF fetch failed:", error);
			this.error = "Failed to load GIFs. Please try again.";
		}
		finally {
			this.isLoading = false;
		}
	}

	#clearGifs() {
		this.gifs = [];
		this.next = null;
	}

	/**
	 * @param {Event} e 
	 */
	#onSearchChange(e) {
		this.#clearGifs()
		const input = e.target;
		const searchValue = input ? input.value : GifPanel.DEFAULT_SEARCH_TERM;
		this.fetchGifs({ search: searchValue, limit: 8 });
	}

	createRenderRoot() {
		return this;
	}

	// Calculate number of columns based on container width
	#calculateColumns() {
		const containerWidth = this.offsetWidth;
		const columnWidth = 150;
		const numColumns = Math.max(Math.floor(containerWidth / columnWidth), 1);
		return numColumns;
	}

	// Split gifs into columns
	#splitGifsIntoColumns() {
		const numColumns = this.#calculateColumns();
		const columns = /**@type {GifData[][]}*/(Array.from({ length: numColumns }, () => []));
	
		// Fill columns in a way that maintains order across resizes
		this.gifs.forEach((gif, index) => {
			const columnIndex = Math.floor(index / Math.ceil(this.gifs.length / numColumns));
			columns[columnIndex]?.push(gif);
		});
	
		return columns;
	}
	
	render() {
		const columns = this.#splitGifsIntoColumns();
		this.#columnCount = columns.length;
		return html`
			<header class="panel-header">
				<div style="display: flex; flex-direction: row; justify-content: space-between;">
					<h3>Select a GIF:</h3>
					<r-close-icon @click=${this.#notifyClose}></r-close-icon>
				</div>
				<input type="search" class="search-input" placeholder="Search Tenor GIFs"
					@change=${this.#onSearchChange} ?disabled=${this.isLoading}>
			</header>
			<div class="gif-grid">
				${columns.map(column => html`
					<ul class="gif-column">
						${column.map(gif => html`
							<li class="gif-item">
								<button type="button" @click=${() => this.#notifySelection(gif)}>
									<video class="gif-player" autoplay loop muted playsinline
										poster=${gif.preview} style="aspect-ratio: ${gif.width}/${gif.height}">
										<source src=${gif.source} type="video/webm">
										${gif.sourceFallback ? html`<source src=${gif.sourceFallback} type="video/mp4">` : ""}
										<img src=${gif.preview} alt=${gif.description}>
									</video>
								</button>
							</li>
						`)}
					</ul>
				`)}
			</div>
			${this.error ? html`
				<div class="error-state">
					${this.error}
				</div>
			` : ""}
			<footer>
				<small>Powered by <a href="https://tenor.com" target="_blank">Tenor</a></small>
			</footer>`;
	}

	#notifyClose() {
		this.#clearGifs()
		this.dispatchEvent(new CustomEvent("close", {
			bubbles: true,
			composed: true
		}));
	}

	/**
	 * @param {GifData} gif 
	 */
	#notifySelection(gif) {
		const event = new CustomEvent("gifselection", {
			detail: gif,
			bubbles: true,
			composed: true
		});
		this.dispatchEvent(event);
	}
}
customElements.define("r-gif-panel", GifPanel);

class CanvasShareEmbed extends LitElement {
	static properties = {
		serverUrl: { type: String, attribute: "serverurl" },
		boardUrl: { type: String, attribute: "boardurl" },
		canvasInfo: { state: true }
	}

	constructor() {
		super();
		this.serverUrl = "";
		this.boardUrl = "";
		this.canvasInfo = null;
	}

	createRenderRoot() {
		return this;
	}

	async connectedCallback() {
		super.connectedCallback();
		await this.loadCanvasData();
	}

	async loadCanvasData() {
		try {
			const httpServerUrl = this.serverUrl.replace("wss://", "https://").replace("ws://", "http://");
			const response = await fetch(httpServerUrl);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			this.canvasInfo = await response.json();
		}
		catch (error) {
			console.error("Failed to load canvas data:", error);
			this.canvasInfo = null;
		}
	}

	render() {
		if (!this.canvasInfo) {
			return html`<div class="canvas-embed">...</div>`;
		}

		const { instance, canvas } = this.canvasInfo;
		const { name, icon } = instance;
		const { width, height, cooldown } = canvas;

		// Construct the URL for clipboard copy
		const serverParam = encodeURIComponent(this.serverUrl);
		const boardParam = encodeURIComponent(this.boardUrl);
		const shareUrl = `https://rplace.live/?server=${serverParam}&board=${boardParam}`;
		return html`
			<div class="canvas-embed">
				<a href="${shareUrl}" class="canvas-link">
					<div class="canvas-info">
						<p class="canvas-name">${name}</p>
						<p class="canvas-description">${width}x${height} (cooldown: ${cooldown})</p>
					</div>
				</a>
				<r-clipboard-copy title="Copy canvas URL to clipboard" href="${shareUrl}"></r-clipboard-copy>
			</div>`;
	}
}
customElements.define("r-canvas-share-embed", CanvasShareEmbed);

export class EditList extends LitElement {
	static properties = {
		data: { state: true },
	};

	constructor() {
		super();
		this.data = {};
	}

	createRenderRoot() {
		return this
	}

	/**
	 * @param {string} key 
	 * @param {any} value 
	 */
	updateEntry(key, value) {
		const newData = { ...this.data, [key]: value };
		this.data = newData;
		this.dispatchEvent(new CustomEvent("change", { detail: this.data }));
		this.dispatchEvent(new CustomEvent("itemchange", {
			detail: { key, value },
			bubbles: true,
			composed: true
		}));
	}

	/**
	 * @param {string} key 
	 */
	removeEntry(key) {
		const { [key]: _, ...rest } = this.data;
		this.data = rest;
		this.dispatchEvent(new CustomEvent("change", { detail: this.data }));
		this.dispatchEvent(new CustomEvent("itemremove", {
			detail: { key },
			bubbles: true,
			composed: true
		}));
	}

	addEntry() {
		const newKey = prompt("Enter key for new entry");
		if (!newKey) {
			return;
		}

		this.data = { ...this.data, [newKey]: "" };
		this.dispatchEvent(new CustomEvent("change", { detail: this.data }));
		this.dispatchEvent(new CustomEvent("itemadd", {
			detail: { key: newKey, value: "" },
			bubbles: true,
			composed: true
		}));
	}

	render() {
		return html`
			<ul>
				${Object.entries(this.data).map(([key, value]) => {
					const inputId = (this.getAttribute("id") ?? generateRandomId()) + toCapitalised(key);
					return html`
						<li>
							<label for="${inputId}" title=${key}>
								${key}:
							</label>
							<input
								id=${inputId}
								type="text"
								title="${key}"
								.value=${value}
								@input=${(e) => this.updateEntry(key, e.target.value)}
								placeholder="${key}"
							>
							<button @click=${() => this.removeEntry(key)}>x</button>
						</li>`
					})
				}
			</ul>
			<button @click=${this.addEntry}>+ Add Entry</button>
		`;
	}
}
customElements.define("r-edit-list", EditList);

export class Sidebar extends LitElement {
	static properties = {
		sidebarOpen: { type: Number, state: true },
		sidebarDrag: { type: Number, state: true },
		sidebarDragging: { type: Boolean, state: true },
		mode: { type: String, attribute: "mode" }
	};

	constructor() {
		super();
		this.sidebarDragLastX = 0;
		this.sidebarDragStartX = 0;
		this.sidebarDragStartY = 0;
		this.sidebarOpen = 0;
		this.sidebarDrag = 0;
		this.sidebarDragging = false;
		// "overlay" | "inline-overlay" | "inline"
		this.mode = "inline-overlay";
	}

	createRenderRoot() {
		return this;
	}

	connectedCallback() {
		super.connectedCallback();

		document.body.addEventListener("touchstart", (e) => {
			this.sidebarDragging = true;
			this.sidebarDragStartX = this.sidebarDragLastX = e.touches[0].clientX;
			this.sidebarDragStartY = e.touches[0].clientY;
		});

		document.body.addEventListener("touchmove", (e) => {
			if (!this.sidebarDragging) {
				return;
			}
			const deltaX = this.sidebarDragStartX - e.touches[0].clientX;
			if (deltaX > 15) {
				this.close();
			}
			const deltaY = this.sidebarDragStartY - e.touches[0].clientY;
			if (deltaY > 16 && this.sidebarDrag < 0.1) {
				this.close();
			}
			const sidebar = /**@type {HTMLElement}*/(this.querySelector(".sidebar"));
			if (sidebar) {
				const deltaX = e.touches[0].clientX - this.sidebarDragLastX;
				this.sidebarDrag = Math.max(0, Math.min(this.sidebarDrag + (deltaX / sidebar.offsetWidth), 1));
				this.sidebarDragLastX = e.touches[0].clientX;
				this.requestUpdate();
			}
		});

		document.body.addEventListener("touchend", () => {
			this.sidebarOpen = this.sidebarDrag > 0.3 ? 1 : 0;
			this.sidebarDragging = false;
			requestAnimationFrame(() => this.#transition());
		});

		window.addEventListener("resize", () => this.requestUpdate(), {
			passive: true
		});
	}

	render() {
		const sidebarStyles = styleMap({
			transform: (this.mode === "overlay" || window.innerWidth < 1200) ? `translateX(${(this.sidebarDrag - 1) * 100}%)` : "translateX(0%)",
			tabIndex: this.sidebarOpen ? "0" : "-1"
		});

		const backgroundStyles = styleMap({
			background: (this.mode === "overlay" || window.innerWidth < 1200) ? `rgba(0, 0, 0, ${0.2 * this.sidebarDrag})` : "rgba(0, 0, 0, 0)",
			pointerEvents: this.sidebarOpen ? "auto" : "none"
		});

		return html`
			<nav class="sidebar" style=${sidebarStyles}>
				<a type="button" href="/posts" style="column-gap: 8px;">
					<svg fill="currentColor" icon-name="home-fill" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"
						width="24" height="24">
						<path
							d="m19.724 6.765-9.08-6.11A1.115 1.115 0 0 0 9.368.647L.276 6.765a.623.623 0 0 0 .35 1.141h.444v10.001c.001.278.113.544.31.74.196.195.462.304.739.303h5.16a.704.704 0 0 0 .706-.707v-4.507c0-.76 1.138-1.475 2.02-1.475.882 0 2.02.715 2.02 1.475v4.507a.71.71 0 0 0 .707.707h5.16c.274-.001.538-.112.732-.307.195-.195.305-.46.306-.736v-10h.445a.618.618 0 0 0 .598-.44.625.625 0 0 0-.25-.702Z">
						</path>
					</svg>
					Posts
				</a>
				<a type="button" href="/">
					<img alt="rplace.live" src="/svg/rplace.svg" width="24" height="24">
					Game
				</a>
				<a type="button" href="/premium">
					<img alt="star" src="/svg/premium.svg" width="24" height="24">
					Premium
				</a>
				<nav class="sidebar-footer">
					<a href="https://rplace.live">rplace.live</a> |
					<a href="./disclaimer.html">disclaimer</a> |
					<a href="https://github.com/rplacelive">github</a>
				</nav>
			</nav>
			<div class="sidebar-background" style=${backgroundStyles} @click=${this.close} @touchstart=${this.close}></div>`;
	}

	open() {
		this.sidebarOpen = 1;
		this.sidebarDragging = false;
		this.#transition();
		this.requestUpdate();
	}

	close() {
		this.sidebarOpen = 0;
		this.sidebarDrag = 0;
		this.sidebarDragging = false;
		this.requestUpdate();
	}

	#transition() {
		this.sidebarDrag = lerp(this.sidebarDrag, this.sidebarOpen, 0.3);
		if ((!this.sidebarOpen && this.sidebarDrag < 0.05) || (this.sidebarOpen && this.sidebarDrag > 0.95)) {
			this.sidebarDrag = Math.round(this.sidebarDrag);
		}
		else {
			requestAnimationFrame(() => this.#transition());
		}

		this.requestUpdate();
	}
}
customElements.define("r-sidebar", Sidebar);

class Header extends LitElement {
	static properties = {
		title: { type: String },
		scrolled: { type: Boolean, state: true }
	};

	constructor() {
		super();
		this.title = "rplace.live";
	}

	createRenderRoot() {
		return this;
	}

	connectedCallback() {
		super.connectedCallback();

		document.addEventListener("scroll", (e) => {
			if (window.scrollY > 0) {
				this.classList.add("scrolled");
			}
			else {
				this.classList.remove("scrolled");
			}
		}, { passive: true });
	}

	render() {
		// @ts-ignore
		const sidebarPresent = typeof window.sidebar !== "undefined";

		return html`
			${sidebarPresent ? html`
				<button id="sidebarButton" type="button" class="header-menu" onclick="sidebar?.open()">
					<img src="./svg/menu.svg" alt="Menu" width="36" height="36">
				</button>` : html``}
			<img src="./images/rplace.png" alt="Rplace logo">
			<h1>${this.title}</h1>
			<button type="button" id="accountButton" class="header-account" @click=${this.#handleAccountButtonClick}>
				<img src="/svg/account.svg" alt="Menu" width="36" height="36">
			</button>`;
	}

	#handleAccountButtonClick() {
		openAccountFrame();
	}
}
customElements.define("r-header", Header, { extends: "header" });