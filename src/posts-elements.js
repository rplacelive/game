import { LitElement, html } from "lit-element"
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { until } from "lit-html/directives/until.js";
import { markdownParse, sanitise, DEFAULT_AUTH, cachedFetch } from "./shared.js";

const fuzzyNumberFormat = new Intl.NumberFormat(navigator.language, { notation: "compact" })

export class Post extends LitElement {
	static properties = {
		title: { type: String, attribute: "title" },
		description: { type: String, attribute: "description" },
		showVotes: { 
			type: Boolean, 
			attribute: "novotes", 
			converter: {
				fromAttribute: (value) => value !== "true",
				toAttribute: (value) => value ? "false" : "true"
			}
		},
		coverImageUrl: { type: String, attribute: "coverimageurl" },
		hidden: { type: Boolean, attribute: "hidden" },
		authorName: { type: String, attribute: "authorname" },
		authorImageUrl: { type: String, attribute: "authorimageurl" },
		showAuthor: { type: Boolean },
		showAuthorTooltip: { type: Boolean },
		creationDate: { type: Object, attribute: "creationdate" },
		showContents: { type: Boolean },
		upvotes: { type: Number, state: true, attribute: "upvotes" },
		downvotes: { type: Number, state: true, attribute: "downvotes" },
		contentUrls: { type: Array, state: true, attribute: "contenturls" },
	}

	constructor() {
		super()
		// Sources
		this.post = null
		this.profile = null
		this.canvasUser = null
		this.authorType = ""
		// Reactive props
		this.title = ""
		this.description = ""
		/**@type {string|null}*/this.coverImageUrl = null
		this.hidden = false
		this.authorName = ""
		this.authorImageUrl = "images/rplace.png"
		this.showAuthor = false
		this.creationDate = new Date()
		this.showContents = true
		this.showVotes = true
		this.upvotes = 0
		this.downvotes = 0
		/**@type {string[]}*/this.contentUrls = []
		this.showAuthorTooltip = false
	}

	createRenderRoot() {
		return this
	}

	render() {
		return html`
			${this.coverImageUrl ? this.#renderCoverImage() : ""}
			<div id="body" class="body">
				<div id="header" class="header">
					${this.showAuthor ? this.#renderAuthorContainer() : ""}
				</div>
				<div id="main" class="main ${this.showAuthor ? "authored" : ""}">
					<div id="title" class="title">${this.title}</div>
					<p id="description" class="description">${until(this.#renderDescription(), html`...`)}</p>
					${this.showContents ? this.#renderContents() : ""}
				</div>
				${this.hidden ? this.#renderHiddenButton() : ""}
				${this.showVotes ? this.#renderVotes() : ""}
			</div>`
	}

	#renderAuthorContainer() {
		return html`
			<div class="author-container" @mouseenter=${() => this.showAuthorTooltip = true} @mouseleave=${() => this.showAuthorTooltip = false}>
				<img src="${this.authorImageUrl}" class="author-image" width="28" height="28">
				<a class="author-name" href="#">
					<span>Posted by ${this.authorName}${this.showAuthorTooltip ? this.#renderAuthorTooltip() : ""}</span>
				</a>
				<span>·</span>
				<span class="creation-date">
					${this.creationDate.toLocaleString()}
				</span>
			</div>`
	}

	#renderHiddenButton() {
		return html`
			<button class="hider" @click=${() => this.hidden = false}>
				Post contains sensitive content. Click to show
			</button>`
	}

	#renderCoverImage() {
		return html`<img src="${this.coverImageUrl}" class="cover-image">`
	}

	#renderVotes() {
		return html`<r-votes .upvotes=${this.upvotes} .downvotes=${this.downvotes}></r-votes>`
	}

	#renderContents() {
		return html`<r-post-contents .contentUrls=${this.contentUrls}></r-post-contents>`
	}

	#renderAuthorTooltip() {
		let chatName = "", creationDate = 0, pixelsPlaced = 0, badges = [], lastJoined = 0, playTimeSeconds = 0, userIntId = 0
		if (this.authorType === "account") {
			chatName = this.profile.chatName
			creationDate = this.profile.creationDate
			pixelsPlaced = this.profile.pixelsPlaced
			badges = this.profile.badges	
			lastJoined = this.profile.lastJoined
			playTimeSeconds = this.profile.playTimeSeconds
		}
		else if (this.authorType === "canvasuser") {
			chatName = this.canvasUser.chatName
			creationDate = this.canvasUser.creationDate
			pixelsPlaced = this.canvasUser.pixelsPlaced
			badges = this.canvasUser.badges
			lastJoined = this.canvasUser.lastJoined
			playTimeSeconds = this.canvasUser.playTimeSeconds
			userIntId = this.canvasUser.userIntId
		}

		return html `<r-user-tooltip .type=${this.authorType} .chatName=${chatName} .creationDate=${creationDate}
			.pixelsPlaced=${pixelsPlaced} .badges=${badges} .lastJoined=${lastJoined} .playTimeSeconds=${playTimeSeconds}
			.userIntId=${userIntId}></r-user-tooltip>`
	}

	async #renderDescription() {
		const sanitised = sanitise(this.description)
		const parsedHTML = await markdownParse(this.description);
		return unsafeHTML(parsedHTML)
	}

	async fromPost(fromPost) {
		const AUTHOR_CACHE_EXPIRY = 2.592e8 // 3 days
		
		// Set basic post details
		this.post = fromPost
		this.title = fromPost.title
		this.description = fromPost.description
		this.upvotes = fromPost.upvotes
		this.downvotes = fromPost.downvotes
		
		// Handle account or canvas user
		if (fromPost.accountId) {
			const profileObject = await cachedFetch(
				"profiles", 
				fromPost.accountId,
				`${localStorage.auth || DEFAULT_AUTH}/accounts/profiles/${fromPost.accountId}`, 
				AUTHOR_CACHE_EXPIRY
			)
			
			if (profileObject === null) {
				console.error(`Could not load account profile ${fromPost.accountId}`)
				return
			}
			
			this.authorType = "account"
			this.profile = profileObject
			this.authorName = profileObject.username
			this.authorImageUrl = "images/rplace.png"
			this.showAuthor = true
		}
		else if (fromPost.canvasUserId) {
			const canvasUserObject = await cachedFetch(
				"users", 
				fromPost.canvasUserId,
				`${localStorage.auth || DEFAULT_AUTH}/instances/users/${fromPost.canvasUserId}`, 
				AUTHOR_CACHE_EXPIRY
			)
			
			if (canvasUserObject === null) {
				console.error(`Could not load canvas user ${fromPost.canvasUserId}`)
				return
			}
			
			this.authorType = "canvasuser"
			this.canvasUser = canvasUserObject
			this.authorName = canvasUserObject.chatName || `#${canvasUserObject.userIntId}`
			this.authorImageUrl = "images/rplace.png"
			this.showAuthor = true
		}
		
		// Set creation date
		this.creationDate = new Date(fromPost.creationDate)
		
		// Handle contents
		const contentUrls = fromPost.contents.map(
			(content) => `${localStorage.auth || DEFAULT_AUTH}/posts/contents/${content.id}`
		)
		
		if (contentUrls.length > 0) {
			this.contentUrls = contentUrls
		}
	}
}
customElements.define("r-post", Post)

class PostContents extends LitElement {
	static properties = {
		contentUrls: { type: Array, attribute: "contenturls" }
	}

	constructor() {
		super()
		/**@type {string[]}*/this.contentUrls = []
	}

	createRenderRoot() {
		return this
	}

	render() {
		return html`
			<dialog class="reddit-modal">
				<div class="dialog-header">
					<h4>Viewing image </h4>
					<a id="dialog-reference" href="#"></a>
					<r-close-icon @click=${this.#closeDialog}></r-close-icon>
				</div>
				<img id="dialog-img" />
			</dialog>
			<div class="contents-album" style=${this.#getGridStyle()}>
				${this.contentUrls.map((contentUrl, index) => this.#renderImage(contentUrl, index))}
			</div>`
	}

	#getGridStyle() {
		switch (this.contentUrls.length) {
			case 1:
				return "grid-template-columns: 1fr; grid-template-rows: 1fr;"
			case 2:
				return "grid-template-columns: 1fr 1fr; grid-template-rows: 1fr;"
			case 3:
				return "grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr;"
			case 4:
				return "grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr;"
			default:
				return ""
		}
	}

	/**
	 * @param {string} contentUrl
	 * @param {number} index
	 */
	#renderImage(contentUrl, index) {
		const gridColumnStyle = this.contentUrls.length === 3 && index === 2 
			? "grid-column: 1 / span 2;" 
			: ""

		return html`
			<img loading="lazy" src="${contentUrl}" 
				style="${gridColumnStyle}" @click=${() => this.#openDialog(contentUrl)}>`
	}

	/**
	 * @param {string} contentUrl
	 */
	#openDialog(contentUrl) {
		const dialogReference = /**@type {HTMLAnchorElement}*/(this.querySelector("#dialog-reference"))
		const dialogImg = /**@type {HTMLImageElement}*/(this.querySelector("#dialog-img"))
		const dialog = /**@type {HTMLDialogElement}*/(this.querySelector("dialog"))
		if (!dialogReference || !dialogImg || !dialog) {
			return;
		}
		dialogReference.textContent = "(Download original)"
		dialogReference.href = contentUrl
		dialogImg.src = contentUrl
		dialog.showModal()
	}

	#closeDialog() {
		const dialog = /**@type {HTMLDialogElement}*/(this.querySelector("dialog"))
		dialog.close()
	}
}
customElements.define("r-post-contents", PostContents)

class UserTooltip extends LitElement {
	static properties = {
		type: { type: String },
		chatName: { type: String, attribute: "chatname" },
		creationDate: { type: Number, attribute: "creationdate" },
		pixelsPlaced: { type: Number, attribute: "pixelsplaced" },
		badges: { type: Array, attribute: "badges" },
		lastJoined: { type: Number, attribute: "lastjoined" },
		playTimeSeconds: { type: Number, attribute: "playtimeseconds" },
		userIntId: { type: Number, attribute: "userintid" }
	}

	constructor() {
		super()
		this.type = ""
		this.chatName = "..."
		this.creationDate = 0
		this.pixelsPlaced = 0
		this.badges = []
		this.lastJoined = 0
		this.playTimeSeconds = 0
		this.userIntId = 0
	}

	createRenderRoot() {
		return this
	}

	render() {
		let userIdentifier = this.chatName || (this.userIntId ? `#${this.userIntId}` : "...")
		
		let playTime = this.playTimeSeconds
		let playTimeUnit = "Seconds played"
		
		if (playTime > 3600) {
			playTime = Math.floor(playTime / 3600)
			playTimeUnit = "Hours played"
		}
		else if (playTime > 60) {
			playTime = Math.floor(playTime / 60)
			playTimeUnit = "Minutes played"
		}

		const userDate = this.type === "account" 
			? `Joined on ${new Date(this.creationDate).toLocaleString()}`
			: `Last joined ${new Date(this.lastJoined).toLocaleString()}`

		const secondInfoValue = this.type === "account" 
			? this.badges.length 
			: fuzzyNumberFormat.format(playTime)

		const secondInfoDescription = this.type === "account" 
			? "User badges" 
			: playTimeUnit

		return html`
			<div class="user-tooltip-header">
				<img src="images/rplace.png" width="32">
				<h2 id="userName">${userIdentifier}</h2>
			</div>
			<span id="userDate">${userDate}</span>
			<hr>
			<div class="user-tooltip-grid">
				<h1 id="userInfo1">${fuzzyNumberFormat.format(this.pixelsPlaced)}</h1>
				<h1 id="userInfo2">${secondInfoValue}</h1>
				<span id="userInfo1Description">Pixels placed</span>
				<span id="userInfo2Description">${secondInfoDescription}</span>
			</div>`
	}

	fromAccount(profile) {
		this.type = "account"
		this.chatName = profile.chatName
		this.creationDate = profile.creationDate
		this.pixelsPlaced = profile.pixelsPlaced
		this.badges = profile.badges
	}

	fromCanvasUser(canvasUser) {
		this.type = "canvasuser"
		this.chatName = canvasUser.chatName
		this.userIntId = canvasUser.userIntId
		this.lastJoined = canvasUser.lastJoined
		this.pixelsPlaced = canvasUser.pixelsPlaced
		this.playTimeSeconds = canvasUser.playTimeSeconds
	}
}
customElements.define("r-user-tooltip", UserTooltip)

export class CreatePostContent extends HTMLElement {
	#fileThumbnail
	#deleteButton
	#deleteEvent
	#ondelete

	constructor() {
		super()
		this.file = null
		this.#deleteEvent = new Event("delete")
		this.ondelete = null
		const _this = this
		this.#fileThumbnail = document.createElement("img")
		this.#deleteButton = document.createElement("button")
		this.#deleteButton.onclick = function() {
			_this.dispatchEvent(_this.#deleteEvent)
		}
		this.#deleteButton.innerHTML = `
			<svg viewBox="0 0 20 20" style="fill: white;" xmlns="http://www.w3.org/2000/svg" height="16">
				<path d="M18.442 2.442l-.884-.884L10 9.116 2.442 1.558l-.884.884L9.116 10l-7.558 7.558.884.884L10 10.884l7.558 7.558.884-.884L10.884 10l7.558-7.558z" class=""></path>
			</svg>`
	}

	get ondelete() {
		return this.#ondelete
	}

	set ondelete(value) {
		if (this.#ondelete) {
			this.removeEventListener("delete", this.#ondelete)
		}
		this.addEventListener("delete", value)
		this.#ondelete = value
	}

	connectedCallback() {
		this.appendChild(this.#fileThumbnail)
		this.appendChild(this.#deleteButton)
	}

	/**
	 * @param {File} fileObject
	 */
	setFile(fileObject) {
		this.file = fileObject
		this.#fileThumbnail.src = window.URL.createObjectURL(this.file)
	}
}
customElements.define("r-create-post-content", CreatePostContent)

export class CreatePostContentsPreview extends HTMLElement {
	#contents
	#maxContents
	#uploadLabel
	#elementItems
	#contentsContainer

	constructor() {
		super()
		this.#maxContents = 4
		this.#elementItems = new Map()
		this.#contents = new Set()
		this.#uploadLabel = document.createElement("span")
		this.#uploadLabel.textContent = "Content upload:"
		this.#contentsContainer = document.createElement("div")
	}

	get contents() {
		return Array.from(this.#contents)
	}

	/**
	 * @param {File} file
	 */
	addContent(file) {
		if (this.#contents.size >= this.#maxContents) {
			alert("Error: Can't attach more than 4 files")
			return
		}
		if (file.size > 5e6) {
			alert("Error: Attachment size can't be more than 5mb")
			return
		}
		this.#contents.add(file)
		if (this.#elementItems.size == 0) {
			this.insertBefore(this.#uploadLabel, this.#contentsContainer)
			this.style.height = "72px"
		}
		const itemEl =/**@type {CreatePostContent}*/(document.createElement("r-create-post-content"))
		this.#contentsContainer.appendChild(itemEl)
		itemEl.setFile(file)
		const _this = this
		itemEl.ondelete = function(e) {
			_this.deleteContent(e.target.file)
		}
		this.#elementItems.set(file, itemEl)
	}

	/**
	 * @param {File} file
	 */
	deleteContent(file) {
		if (!this.#contents.delete(file)) {
			return
		}

		if (this.#elementItems.size == 1) {
			this.style.height = "36px"
			this.removeChild(this.#uploadLabel)
		}
		const itemEl = this.#elementItems.get(file)
		if (itemEl) {
			this.#contentsContainer.removeChild(itemEl)
			this.#elementItems.delete(file)
		}
	}

	clearContents() {
		this.#contents.clear()
		this.#elementItems.clear()
		for (const item of this.#contentsContainer.children) {
			this.#contentsContainer.removeChild(item)
		}
	}

	connectedCallback() {
		this.appendChild(this.#contentsContainer)
	}
}
customElements.define("r-post-contents-preview", CreatePostContentsPreview)

class Votes extends LitElement {
	static properties = {
		upvotes: { type: Number, attribute: "upvotes" },
		downvotes: { type: Number, attribute: "downvotes" },
		voted: { type: String, attribute: "voted" }
	}

	constructor() {
		super()
		/** @type {number | null} */ this.upvotes = null
		/** @type {number | null} */ this.downvotes = null
		this.voted = ""
	}

	// @ts-expect-error Disable shadow DOM to inherit global CSS
	createRenderRoot() {
		return this
	}

	get votes() {
		return (this.upvotes !== null && this.downvotes !== null) 
			? this.upvotes - this.downvotes 
			: "..."
	}

	render() {
		const upSelected = this.voted === "up"
		const downSelected = this.voted === "down"
		

		return html`
			${upSelected
				? html`
					<svg class="arrow voted" height="24" width="24" viewBox="0 0 16 16">
						<path clip-rule="evenodd" d="M8.44857 0.401443C8.3347 0.273284 8.17146 0.199951 8.00002 0.199951C7.82859 0.199951 7.66534 0.273284 7.55148 0.401443L0.351479 8.50544C0.194568 8.68206 0.155902 8.93431 0.252709 9.14981C0.349516 9.36532 0.563774 9.50395 0.800023 9.50395H4.20002V15C4.20002 15.3313 4.46865 15.6 4.80002 15.6H11.2C11.5314 15.6 11.8 15.3313 11.8 15V9.50395H15.2C15.4363 9.50395 15.6505 9.36532 15.7473 9.14981C15.8441 8.93431 15.8055 8.68206 15.6486 8.50544L8.44857 0.401443Z" fill-rule="evenodd"></path>
					</svg>`
				: html`
					<svg class="arrow" viewBox="0 0 16 16" height="24" width="24" @click=${this.#onUpvote}>
						<path clip-rule="evenodd" d="m8 .200001c.17143 0 .33468.073332.44854.201491l7.19996 8.103998c.157.17662.1956.42887.0988.64437-.0968.21551-.3111.35414-.5473.35414h-3.4v5.496c0 .3314-.2686.6-.6.6h-6.4c-.33137 0-.6-.2686-.6-.6v-5.496h-3.4c-.236249 0-.450507-.13863-.547314-.35414-.096807-.2155-.058141-.46775.09877-.64437l7.200004-8.103998c.11386-.128159.27711-.201491.44854-.201491zm-5.86433 8.103999h2.66433c.33137 0 .6.26863.6.6v5.496h5.2v-5.496c0-.33137.2686-.6.6-.6h2.6643l-5.8643-6.60063" fill-rule="evenodd"></path>
					</svg>`
			}
			<div class="vote-count">${this.votes}</div>
			${downSelected
				? html`
					<svg class="arrow down voted" height="24" width="24" viewBox="0 0 16 16">
						<path clip-rule="evenodd" d="M8.44857 0.401443C8.3347 0.273284 8.17146 0.199951 8.00002 0.199951C7.82859 0.199951 7.66534 0.273284 7.55148 0.401443L0.351479 8.50544C0.194568 8.68206 0.155902 8.93431 0.252709 9.14981C0.349516 9.36532 0.563774 9.50395 0.800023 9.50395H4.20002V15C4.20002 15.3313 4.46865 15.6 4.80002 15.6H11.2C11.5314 15.6 11.8 15.3313 11.8 15V9.50395H15.2C15.4363 9.50395 15.6505 9.36532 15.7473 9.14981C15.8441 8.93431 15.8055 8.68206 15.6486 8.50544L8.44857 0.401443Z" fill-rule="evenodd"></path>
					</svg>`
				: html`
					<svg class="arrow down" height="24" width="24" viewBox="0 0 16 16" @click=${this.#onDownvote}>
						<path clip-rule="evenodd" d="m8 .200001c.17143 0 .33468.073332.44854.201491l7.19996 8.103998c.157.17662.1956.42887.0988.64437-.0968.21551-.3111.35414-.5473.35414h-3.4v5.496c0 .3314-.2686.6-.6.6h-6.4c-.33137 0-.6-.2686-.6-.6v-5.496h-3.4c-.236249 0-.450507-.13863-.547314-.35414-.096807-.2155-.058141-.46775.09877-.64437l7.200004-8.103998c.11386-.128159.27711-.201491.44854-.201491zm-5.86433 8.103999h2.66433c.33137 0 .6.26863.6.6v5.496h5.2v-5.496c0-.33137.2686-.6.6-.6h2.6643l-5.8643-6.60063" fill-rule="evenodd"></path>
					</svg>`
			}`
	}

	#onUpvote() {
		if (this.voted === "up") {
			this.voted = ""
		} else {
			this.voted = "up"
		}
		this.#notifyVote()
	}

	#onDownvote() {
		if (this.voted === "down") {
			this.voted = ""
		} else {
			this.voted = "down"
		}
		this.#notifyVote()
	}

	#notifyVote() {
		const event = new CustomEvent("votechanged", {
			detail: { voted: this.voted },
			bubbles: true,
			composed: true
		})
		this.dispatchEvent(event)
	}
}
customElements.define("r-votes", Votes)
