import { Marked } from "marked"
import { DEFAULT_AUTH } from "./defaults"
import DOMPurify from "dompurify"

// Contains shared resources across pages
export const BADGE_ICONS = [ "badges/based.svg", "badges/trouble_maker.svg", "badges/veteran.svg", "badges/admin.svg", "badges/moderator.svg", "badges/noob.svg", "badges/script_kiddie.svg", "badges/ethical_botter.svg", "badges/gay.svg", "badges/discord_member.svg", "badges/100_pixels_placed", "badges/1000_pixels_placed", "badges/5000_pixels_placed", "badges/2000_pixels_placed", "badges/100000_pixels_placed", "badges/1000000_pixels_placed" ]
export const ACCOUNT_TIER_NAMES = {
	0: "accountTierFree",
	1: "accountTierBronze",
	2: "accountTierSilver",
	4: "accountTierGold",
	8: "accountTierModerator",
	16: "accountTierAdministrator"
}

export const TRANSLATIONS = {
	en: {
		// Game
		connecting: "Connecting...",
		connectingFail: "Could not connect!",
		disconnectedFromServer: "Disconnected from server",
		downloadingImage: "Downloading image...",
		placeTile: "Place a tile",
		donate: "Donate",
		myAccount: "My Account",
		chat: "Chat",
		liveChat: "Live Chat:",
		nicknameToContinue: "Enter a nickname to continue:",
		changeChannel: "Change channel:",
		captchaPrompt: "Solve this small captcha to help keep rplace.live fun for all...",
		webappInstall: "Install rplace.live web app",
		connectionProblems: "Connection problems?",
		tryClickingHere: "try clicking here",
		orTweetUs: "Or tweet us",
		pleaseBeRespectful: "Please be respectful and try not to spam!",
		enterNickname: "Enter nickname...",
		enterMessage: "Enter message...",
		signInInstead: "Sign in instead",
		createNewAccount: "Create a new account",
		mention: "Mention",
		replyTo: "Reply to",
		addReaction: "Add reaction",
		report: "Report",
		block: "Block",
		unblock: "Unblock",
		changeMyName: "Change my name",
		putOnCanvas: "🫧 Put on canvas",
		sendInLiveChat: "📨 Send in live chat",
		overlayMenu: "Overlay menu",
		modalAboutContent: "There is an empty canvas.<br><br>You may place a tile upon it, but you must wait to place another.<br><br>Individually you can create something.<br><br>Together you can create something more.",
		overlayMenuDesciption: "Visualise your build with a template image!",
		messageNotFound: "Message could not be loaded",
		placedBy: "Placed by:",
		lockMessage: "This canvas is locked... You can't place pixels here anymore",
		adHidden: "Ad hidden for 14 days!",
		specialEventTitle: "Special event - August 21st!",
		copiedToClipboard: "Copied to clipboard!",
		
		// Posts
		rplaceLivePosts: "rplace.live posts",
		searchKeyword: "Search keyword",
		createPost: "Create post",
		communityPosts: "Community posts",
		sortBy: "Sort by:",
		hideSensitive: "Hide sensitive:",
		date: "Date",
		upvotes: "Upvotes",

		// Accounts
		couldntSignIn: "Couldn't sign in",
		couldntSignUp: "Couldn't sign up",
		couldntVerifySignIn: "Couldn't verify sign in",
		couldntLoadAccountProfile: "Couldn't load account profile",
		signinError: "Sign in error",
		accountTierFree: "Free",
		accountTierBronze: "Bronze",
		accountTierSilver: "Silver",
		accountTierGold: "Gold",
		accountTierModerator: "Moderator",
		accountTierAdministrator: "Administrator",
		deleteAccountAreYouSure: "Warning: You are about to delete your account. This can not be undone, are you sure you want to continue?",
		deleteAccountEnterEmail: "Enter your email below to confirm account deletion:",
		
		// Auth
		"auth.signup.ipAddress": "Failed to resolve IP address",
		"auth.signup.rateLimit": "Too many signup attempts. Please try again later.",
		"auth.signup.invalidUsername": "Invalid username",
		"auth.signup.invalidEmail": "Invalid email",
		"auth.signup.accountExists": "An account with the specified details already exists",
		"auth.login.invalidCredentials": "Invalid credentials",
		"auth.verify.rateLimit": "Too many failed attempts. Please try again later.",
		"auth.verify.invalidCode": "Invalid or expired verification code",
		"auth.verify.accountNotFound": "Account not found",
		"auth.link.invalidKey": "Invalid or expired link key"
	}
}
export const lang = navigator.language.split("-")[0]

const TRANSLATION_EXPIRY = 3 * 24 * 60 * 60 * 1000 // 3 days
function openTranslationDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open("translationsDB", 1)
		request.onupgradeneeded = event => {
			const db = event.target.result
			db.createObjectStore("translations", { keyPath: "lang" })
		};
		request.onsuccess = event => resolve(event.target.result)
		request.onerror = event => reject(event.target.error)
	})
}

/**
 * @param {any} lang
 */
function getCachedTranslation(lang) {
	return new Promise(async (resolve, reject) => {
		const db = await openTranslationDB()
		const transaction = db.transaction("translations", "readonly")
		const store = transaction.objectStore("translations")
		const request = store.get(lang)
		request.onsuccess = (/** @type {{ target: { result: any; }; }} */ event) => resolve(event.target.result)
		request.onerror = (/** @type {{ target: { error: any; }; }} */ event) => reject(event.target.error)
	})
}

/**
 * @param {any} lang
 * @param {any} data
 */
function setCachedTranslation(lang, data) {
	return new Promise(async (resolve, reject) => {
		const db = await openTranslationDB()
		const transaction = db.transaction("translations", "readwrite")
		const store = transaction.objectStore("translations")
		const request = store.put({ lang, data, timestamp: Date.now() })
		request.onsuccess = () => resolve()
		request.onerror = (/** @type {{ target: { error: any; }; }} */ event) => reject(event.target.error)
	})
}

/**
 * @param {string} lang
 */
async function fetchTranslations(lang) {
	// Fast: Pull from local object
	if (TRANSLATIONS[lang]) {
		return TRANSLATIONS[lang]
	}
	try {
		// Med: Fall back to indexDB caches
		const cachedTranslation = await getCachedTranslation(lang)
		const now = Date.now()
		if (cachedTranslation && (now - cachedTranslation.timestamp) <= TRANSLATION_EXPIRY) {
			TRANSLATIONS[lang] = cachedTranslation.data
			return cachedTranslation.data
		}
		// Slow: Fall back to requesting translation file
		const response = await fetch(`translations/${lang}.json`)
		if (!response.ok) {
			throw new Error(`Translations for ${lang} not found`)
		}
		const translation = await response.json()
		await setCachedTranslation(lang, translation)
		TRANSLATIONS[lang] = translation
		return translation
	}
	catch (error) {
		console.log(error)
		return TRANSLATIONS["en"]
	}
}

/**
 * @param {string} key
 */
export async function translate(key) {
	let translations = TRANSLATIONS[lang]
	if (!translations) {
		translations = await fetchTranslations(lang)
	}
	return translations?.[key] ?? TRANSLATIONS["en"]?.[key] ?? key
}

export async function translateAll() {
	let translations = TRANSLATIONS[lang]
	if (!translations) {
		translations = await fetchTranslations(lang)
	}
	const elements = document.querySelectorAll("[translate]")
	elements.forEach((element) => {
		const key = element.getAttribute("translate")
		const translation = translations?.[key] ?? TRANSLATIONS["en"]?.[key] ?? key
		if (element.nodeName === "INPUT" || element.nodeName === "TEXTAREA") {
			if (element.getAttribute("type") == "text") {
				element.placeholder = translation || element.placeholder
			}
			else {
				element.value = translation || element.value
			}
		}
		else {
			element.innerHTML = translation || element.innerHTML
		}
	})
}

// Preload default language translations
fetchTranslations(lang)

export class PublicPromise {
	constructor() {
		this.promise = new Promise((resolve, reject) => {
			this.resolve = resolve
			this.reject = reject
		})
	}
}

export class PublicPromiseSync {	
	#promise

	constructor() {
		this.#promise = new Promise((resolve, reject) => {
			this.resolve = resolve
			this.reject = reject
		})
		this.locked = false
	}

	async acquireAwaitPromise() {
		if (this.locked) {
			throw new Error("This promise is already being awaited.")
		}
		this.locked = true
		try {
			const result = await this.#promise
			this.locked = false
			return result
		}
		catch (error) {
			this.locked = false
			throw error
		}
	}
}


/**@type {import("marked").MarkedExtension}*/ const markedMarkdownConfig = {
	hooks: {
		preprocess(markdown) {
			return sanitise(markdown)
		},
	},
	extensions: [
		{
			name: "spoiler",
			level: "inline",
			start(src) {
				return src.indexOf("||")
			},
			tokenizer(src) {
				const match = /^\|\|([\s\S]+?)\|\|/.exec(src);
				if (match) {
					return {
						type: "spoiler",
						raw: match[0],
						text: match[1]?.trim(),
						tokens: []
					}
				}
				return undefined
			},
			renderer(token) {
				let tokens = null;
				if (token.tokens && token.tokens.length > 0) {
					tokens = token.tokens
				}
				else {
					tokens = /**@type {import("marked").Token[]}*/([{
						type: "text",
						raw: token.text,
						text: token.text
					}])
				}
				const parsedContent = this.parser.parseInline(tokens);
				return `<r-spoiler hidden="true">${parsedContent}</r-spoiler>`;				
			},
		},
		{
			name: "gif",
			level: "inline",
			start(src) {
				return src.indexOf("[gif:")
			},
			tokenizer(src) {
				const match = /^\[gif:([a-zA-Z0-9_-]+):([a-zA-Z_-]+)\]/.exec(src)
				if (match) {
					return {
						type: "gif",
						raw: match[0],
						gifId: match[1],
						gifSource: match[2]
					}
				}
				return undefined
			},
			renderer(token) {
				return `<r-gif key="${token.gifId}" source="${token.gifSource}"></r-gif>`
			}
		},
		{
			name: "underline",
			level: "inline",
			start(src) {
				return src.indexOf("__");
			},
			tokenizer(src) {
				const match = /^__([^_\n]+?)__/.exec(src);
				if (match) {
					return {
						type: "underline",
						raw: match[0],
						text: match[1]?.trim(),
						tokens: []
					};
				}
				return undefined;
			},
			renderer(token) {
				let tokens = null;
				if (token.tokens && token.tokens.length > 0) {
					tokens = token.tokens
				}
				else {
					tokens = /**@type {import("marked").Token[]}*/([{
						type: "text",
						raw: token.text,
						text: token.text
					}])
				}
				const parsedContent = this.parser.parseInline(tokens);
				return `<u>${parsedContent}</u>`;
			}
		}	
	],
	renderer: {
		heading({ tokens, depth }) {
			const text = this.parser.parseInline(tokens);
			if (depth >= 1 && depth <= 3) {
				return `<h${depth}>${text}</h${depth}>`;
			}
			return text;
		},
		link(token) {
			return this.parser.parseInline(token.tokens) || token.text;
		},
		image(token) {
			return token.text || `[image:${token.href}:]`;
		},
		html(token) {
			return token.text;
		},
		table(token) {
			const header = token.header.map(cell => cell.text).join(' | ');
			const separator = token.align.map(align => 
				align === 'left' ? ':---' : 
				align === 'right' ? '---:' : 
				align === 'center' ? ':---:' : '---'
			).join(' | ');
			const body = token.rows.map(row => 
				row.map(cell => cell.text).join(' | ')
			).join('\n');
			return `| ${header} |\n| ${separator} |\n${body}`;
		}
	},
	async: true
}

/**
 * @param {string} text
 */
export function sanitise(text) {
	return text
		// HTML
		.replaceAll(/&/g,"&amp;")
		.replaceAll(/</g,"&lt;")
		.replaceAll(/"/g,"&quot;")
		// Javascript URLs
		.replaceAll(/\?|javascript:/gi, "")
		// Null characters
		.replaceAll(/[\u200B-\u200D\uFEFF]/g, "");
}

/**
 * @param {string} text
 * @returns {Promise<string>} Sanitised parsed HTML message
 */
export async function markdownParse(text, config = markedMarkdownConfig) {
	// Parse markdown syntax
	const markedInstance = new Marked();
	markedInstance.use(config);
	let parsedHTML = await markedInstance.parse(text); 

	// Sanitise HTML
	parsedHTML = DOMPurify.sanitize(parsedHTML, {
		ALLOWED_TAGS: [],
		ALLOWED_ATTR: [ "hidden" ],

		// Whitelist
		ADD_TAGS: [ "r-gif", "r-spoiler", "h1", "h2", "h3", "b", "i", "e", "em", "strong", "del", "br", "p", "span", "ul", "ol", "li", "u", "blockquote", "code", "pre" ],
		ADD_ATTR: [ "key", "source", "hidden" ],

		// Explicit enforcements
		FORBID_ATTR: [ "style", "on*", "href", "src", "srcset" ],
		ALLOW_DATA_ATTR: false,
		ALLOW_ARIA_ATTR: false,

		// Custom r- elements handling
		CUSTOM_ELEMENT_HANDLING: {
			tagNameCheck: /^r-/i,
			attributeNameCheck: /^(key|source|hidden)$/i,
			allowCustomizedBuiltInElements: false
		}
	});

	return parsedHTML;
}

// Utility functions for dialog & iframes
/**
 * Creates an instance of the specified iframe page on the topmost
 * level window with the specified ID
 * @param {string} src 
 * @param {string} id
 * @returns {Promise<HTMLIFrameElement>} 
 */
export function createTopLevelFrame(src, id) {
	return new Promise((resolve, reject) => {
		const topWindow = window.top;
		if (!topWindow) {
			const error = "Unable to access top-level window";
			console.error("Couldn't open account frame:", error);
			return reject(error);
		}
		if (topWindow.document.getElementById(id)) {
			return reject();
		}
	
		const iframe = topWindow.document.createElement("iframe");
		iframe.src = src;
		iframe.id = id;
		iframe.classList.add("iframe-modal");
		iframe.addEventListener("load", () => {
			resolve(iframe);
		});
		topWindow.document.body.appendChild(iframe)
	})
}
/**
 * Attempts to remove a top level instantiated frame from the DOM
 * @param {string} id 
 * @returns {boolean} Removal success
 */
export function removeTopLevelFrame(id) {
	const topWindow = window.top;
	if (!topWindow) {
		console.error("Couldn't remove top level frame: Unable to access top-level window");
		return false;
	}

	const iframe = topWindow.document.getElementById(id);
	if (!iframe || !(iframe instanceof HTMLIFrameElement)) {
		console.error("Couldn't remove top level frame: Frame not found");
		return false;
	}

	iframe.remove();
	return true;
}

// Utility functions for Auth DB IndexedDB caches
const currentAuthUrl = new URL(localStorage.auth || DEFAULT_AUTH) // i.e server.rplace.live/auth
const currentAuthDb = `${currentAuthUrl.host}${currentAuthUrl.pathname}`

function openCurrentAuthDB() {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(currentAuthDb, 2)
		request.onupgradeneeded = event => {
			const db = event.target.result
			db.createObjectStore("profiles", { keyPath: "id" })
			db.createObjectStore("users", { keyPath: "id" })
		}
		request.onsuccess = event => resolve(event.target.result)
		request.onerror = event => reject(event.target.error)
	})
}

/**
 * @param {any} storeName
 * @param {any} key
 */
function getCachedData(storeName, key) {
	return new Promise(async (resolve, reject) => {
		const db = await openCurrentAuthDB()
		const transaction = db.transaction(storeName, "readonly")
		const store = transaction.objectStore(storeName)
		const request = store.get(key)
		request.onsuccess = (/** @type {{ target: { result: any; }; }} */ event) => resolve(event.target.result)
		request.onerror = (/** @type {{ target: { error: any; }; }} */ event) => reject(event.target.error)
	})
}

/**
 * @param {any} storeName
 * @param {{ id: any; data: any; timestamp: number; }} data
 */
function setCachedData(storeName, data) {
	return new Promise(async (resolve, reject) => {
		const db = await openCurrentAuthDB()
		const transaction = db.transaction(storeName, "readwrite")
		const store = transaction.objectStore(storeName)
		const request = store.put(data)
		request.onsuccess = () => resolve()
		request.onerror = (/** @type {{ target: { error: any; }; }} */ event) => reject(event.target.error)
	})
}

// Responsible for setting and retrieving form DB, will attempt to grab the object from the DB, if it can't
// it will grab the object from the URL and then cache it in the database
/**
 * @param {string} keystore
 * @param {any} id
 * @param {string | URL | Request} url
 * @param {number} expiry
 */
export async function cachedFetch(keystore, id, url, expiry) {
	const now = Date.now()
	let cachedObject = await getCachedData(keystore, id)
	if (!cachedObject || (now - cachedObject.timestamp) > expiry) {
		const res = await fetch(url)
		if (!res.ok) {
			console.error(`Could not fetch object ${id} belonging to ${keystore}: ${res.status} ${res.statusText}:`, await res.json())
			return null
		}

		cachedObject = await res.json()
		await setCachedData(keystore, { id, data: cachedObject, timestamp: now })
	}
	else {
		cachedObject = cachedObject.data
	}

	return cachedObject
}

/**
 * @param {string|URL|globalThis.Request} url
 * @param {string} method
 * @param {any} body
 */
export async function makeRequest(url, method = "GET", body = undefined) {
	try {
		/**@type {RequestInit}*/const fetchOptions = {
			method,
			credentials: "include",
		}
		if (body !== undefined) {
			fetchOptions.headers = {
				"Content-Type": "application/json"
			}
			fetchOptions.body = JSON.stringify(body)
		}
		const response = await fetch(url, fetchOptions)

		if (!response.ok) {
			return { status: "error", data: await response.json() }
		}

		return { status: "success", data: await response.json() }
	}
	catch (error) {
		return { status: "error", data: error }
	}
}

/**
 * Handles form submission and processes the response.
 * 
 * @param {HTMLFormElement} form - The form element to attach the submit handler to.
 * @param {string} endpoint - The API endpoint to send the form data to.
 * @param {Object} [options] - Optional parameters.
 * @param {(elements: HTMLFormControlsCollection) => any} [options.bind] - Binds and transforms form data before submission.
 * @param {(elements: HTMLFormControlsCollection) => boolean | Promise<boolean>} [options.checkCustomValidity] - A custom validity check that can be async.
 * @param {() => void | Promise<void>} [options.preRequest] - Callback invoked before sending the request.
 * @param {(data: any) => void | Promise<void>} [options.onSuccess] - Callback invoked if the request is successful.
 * @param {(data: any) => void | Promise<void>} [options.onError] - Callback invoked if the request returns an error.
 */
export function handleFormSubmit(form, endpoint, { bind, checkCustomValidity, preRequest, onSuccess, onError } = {}) {
	form.addEventListener("submit", async function (e) {
		e.preventDefault()
		const elements = form.elements

		// Check form validity
		if (!form.checkValidity()) {
			form.reportValidity()
			return
		}
		// Custom validity check if provided
		if (typeof checkCustomValidity === "function" && !(await checkCustomValidity(elements))) {
			return
		}

		let formData = Object.fromEntries(new FormData(form).entries())

		// Transform data using bind if provided
		if (typeof bind === "function") {
			formData = bind(elements)
		}
		// Invoke preRequest if provided
		if (typeof preRequest === "function") {
			await preRequest()
		}

		// Make request to the endpoint
		const result = await makeRequest(endpoint, "POST", formData)

		// Handle success or error
		if (result.status === "success" && typeof onSuccess === "function") {
			await onSuccess(result.data)
		}
		else if (result.status === "error" && typeof onError === "function") {
			await onError(result.data)
		}
	})
}

/**
 * @param {string} text - The input string to be hashed
 * @returns {number} The resulting hash value
 */
export function hash(text) {
	return text
		.split("")
		.reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0)
}

/**
 * @param {string} selector - The CSS selector to query for
 * @returns {Element} The selected element
 */
export const $ = (selector) => {
	const element = document.querySelector(selector);
	if (!element) {
		throw new Error(`Element not found for selector: ${selector}`);
	}
	return element;
}

/**
 * @param {string} selector - The CSS selector to query for
 * @returns {NodeList} A NodeList of the selected elements
 */
export const $$ = (selector) => {
	return document.querySelectorAll(selector);
}

/**
 * @param {string} html
 * @returns {HTMLElement}
 */
export function stringToHtml(html, trim = true) {
	const template = document.createElement("template")
	template.innerHTML = html
	const result = template.content.children
	return /**@type {HTMLElement}*/(result.length === 1 ? result[0] : result)
}

/**
 * @template {Record<string|symbol, any>} T - Target object type (indexable)
 * @param {string} storageKey - The localStorage key for the object
 * @param {T} target - The object to be synchronised with localStorage
 * @returns {T} - A proxy-wrapped version of the target object
 */
export function syncLocalStorage(storageKey, target) {
	/** @type {ProxyHandler<T>} */const handler = {
		get(/**@type {T}*/ obj, prop) {
			if (typeof prop === "string" && typeof obj[prop] === "object" && obj[prop] !== null) {
				/**@type {T}*/const nested = obj[prop]
				return new Proxy(nested, handler)
			}
			return obj[prop]
		},
		set(/**@type {Record<string|symbol, any>}*/obj, key, value) {
			obj[key] = value
			localStorage.setItem(storageKey, JSON.stringify(target))
			return true
		}
	}
	return new Proxy(target, handler)
}

/**
 * 
 * @param {Blob} blob 
 * @returns {Promise<string>}
 */
export function blobToBase64(blob) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = function() {
			const result = reader.result;
			if (!result || typeof result !== "string") {
				return reject();
			}

			const base64String = result.split(",")[1]
			resolve(base64String);
		};
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}

/**
 * @param {string} base64
 */
export function base64ToUint8Array(base64) {
	const binary = atob(base64);
	const len = binary.length;
	const bytes = new Uint8Array(len);
	for (let i = 0; i < len; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * @param {string} base64
 * @param {string} mimeType
 */
export function base64ToBlob(base64, mimeType = "") {
	const bytes = base64ToUint8Array(base64);
	return new Blob([bytes], { type: mimeType });
}

/**
 * 
 * @param {object} object 
 * @param {boolean} editable 
 * @returns {string} - HTML source
 */
export function objectToHtml(object, editable = false) {
	let html = ""
	let indent = 1
	let last = false

	/**
	 * 
	 * @param {Record<string, any>} obj 
	 */
	function propToHtml(obj) {
		for (let prop in obj) {
			if (typeof obj[prop] === 'object' && !Array.isArray(obj[prop])) {
				indent++
				html += `<div style="margin-left: ${indent * 8}px"><span>${prop}:</span> ${propToHtml(obj[prop])}</div>\n`
				last = false
			}
			else {
				if (!last) indent--
				last = true
				if (!editable) {
					html += `<div style="margin-left: ${indent * 8}px"><span>${prop}:</span> ${obj[prop]}</div>\n`
				}
				else {
					let input = ""
					switch (typeof obj[prop]) {
						case 'string': input = `<input type="text" value=${obj[prop]}>`; break
						case 'number': input = `<input type="number" value=${Number(obj[prop])}>`; break
						case 'boolean': input = `<input type="checkbox" ${obj[prop] ? 'checked' : ''}>`; break
						case 'object': input = `<button>+ Add new</button>`; break;
					}

					html += `<div style="margin-left: ${indent * 8}px"><span>${prop}:</span> ${input}</div>\n`
				}
			}
		}
	}
	propToHtml(object)

	return html
}
