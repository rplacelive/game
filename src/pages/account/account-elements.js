"use strict";
import { LitElement, html, css } from "lit";

const fuzzyNumberFormat = new Intl.NumberFormat(navigator.language, { notation: "compact" });

export class CanvasUserCard extends LitElement {
	static properties = {
		// Canvas user properties
		userIntId: { type: Number, attribute: "userintid" },
		instanceId: { type: Number, attribute: "instanceid" },
		accountId: { type: Number, attribute: "accountid" },
		chatName: { type: String, attribute: "chatname" },
		lastJoined: { type: Number, attribute: "lastjoined" },
		pixelsPlaced: { type: Number, attribute: "pixelsplaced" },
		playTimeSeconds: { type: Number, attribute: "playtimeseconds" },

		// Instance properties
		instanceVanityName: { type: String, attribute: "instancevanityname" },
		serverLocation: { type: String, attribute: "serverlocation" },
		legacy: { type: Boolean, attribute: "legacy" }
	}

	constructor() {
		super()
		this.userIntId = 0;
		this.instanceId = 0;
		this.accountId = 0;
		this.chatName = "...";
		this.lastJoined = 0;
		this.pixelsPlaced = 0;
		this.playTimeSeconds = 0;
		this.instanceVanityName = "...";
		this.instanceServerLocation = "";
		this.instanceLegacy = false;
	}

	createRenderRoot() {
		return this;
	}

	render() {
		const userIdentifier = (this.chatName ?? "") + (`#${this.userIntId}`);
		const instanceIdentifier = this.instanceVanityName ?? (`canvas${this.instanceId}`);

		let playTime = this.playTimeSeconds;
		let playTimeUnit = "Seconds played";
		
		if (playTime > 3600) {
			playTime = Math.floor(playTime / 3600);
			playTimeUnit = "Hours played";
		}
		else if (playTime > 60) {
			playTime = Math.floor(playTime / 60);
			playTimeUnit = "Minutes played";
		}

		const lastJoinedDate = `Last joined ${new Date(this.lastJoined).toLocaleString()}`;
		const canvasUrlName = this.instanceVanityName ?? "canvas"+this.instanceId;
		let canvasUrl;
		if (this.instanceVanityName) {
			canvasUrl = `${location.origin}/${canvasUrlName}`
		}
		else {
			const params = new URLSearchParams({
				server: this.instanceServerLocation,
				legacy: String(this.instanceLegacy)
			});
			canvasUrl = `${location.origin}/${params.toString()}`;
		}

		return html`
			<div class="user-card-header">
				<img src="images/rplace.png" width="32">
				<div class="user-card-titles">
					<h2>${userIdentifier}</h2>
					<span>@${instanceIdentifier}</span>
				</div>
			</div>
			<span id="userDate">${lastJoinedDate}</span>
			<hr>
			<div class="user-card-grid">
				<h1>${fuzzyNumberFormat.format(this.pixelsPlaced)}</h1>
				<h1>${fuzzyNumberFormat.format(playTime)}</h1>
				<span>Pixels placed</span>
				<span>${playTimeUnit}</span>
			</div>
			<div class="user-card-details">
				<div class="user-card-detail-item">
					<span class="label">User ID:</span>
					<span class="value">${this.userIntId}</span>
				</div>
				<div class="user-card-detail-item">
					<span class="label">Canvas URL:</span>
					<span class="value"><a href="${canvasUrl}">${canvasUrlName}</a></span>
				</div>
			</div>`;
	}

	/**
	 * @param {CanvasUser} canvasUser
	 * @param {Instance} instance
	 */
	fromCanvasUser(canvasUser, instance) {
		// Canvas user properties
		this.userIntId = canvasUser.userIntId;
		this.instanceId = canvasUser.instanceId;
		this.accountId = canvasUser.accountId;
		this.chatName = canvasUser.chatName;
		this.lastJoined = canvasUser.lastJoined;
		this.pixelsPlaced = canvasUser.pixelsPlaced;
		this.playTimeSeconds = canvasUser.playTimeSeconds;

		// Instance properties
		this.instanceVanityName = instance.vanityName;
		this.instanceServerLocation = instance.serverLocation;
		this.instanceLegacy = instance.legacy;
	}
}
customElements.define("r-canvas-user-card", CanvasUserCard);

export class UserTooltip extends LitElement {
	static properties = {
		// Meta
		type: { type: String },
		
		// Generic
		chatName: { type: String, attribute: "chatname" },
		creationDate: { type: Number, attribute: "creationdate" },
		pixelsPlaced: { type: Number, attribute: "pixelsplaced" },
		badges: { type: Array, attribute: "badges" },
		lastJoined: { type: Number, attribute: "lastjoined" },
		playTimeSeconds: { type: Number, attribute: "playtimeseconds" },
		userIntId: { type: Number, attribute: "userintid" },

		// Instance
		instanceId: { type: Number, attribute: "instanceid" },
		instanceVanityName: { type: String, attribute: "instancevanityname" }
	}

	constructor() {
		super();
		this.type = "";
		this.chatName = "...";
		this.creationDate = 0;
		this.pixelsPlaced = 0;
		this.badges = [];
		this.lastJoined = 0;
		this.playTimeSeconds = 0;
		this.userIntId = 0;
		this.instanceId = 0;
		this.instanceVanityName = "...";
	}

	createRenderRoot() {
		return this;
	}

	render() {
		const userIdentifier = (this.chatName ?? "") + (`#${this.userIntId}`);
		const instanceIdentifier = this.instanceVanityName ?? (`canvas${this.instanceId}`);

		let playTime = this.playTimeSeconds;
		let playTimeUnit = "Seconds played";
		
		if (playTime > 3600) {
			playTime = Math.floor(playTime / 3600);
			playTimeUnit = "Hours played";
		}
		else if (playTime > 60) {
			playTime = Math.floor(playTime / 60);
			playTimeUnit = "Minutes played";
		}

		const userDate = this.type === "account" 
			? `Joined on ${new Date(this.creationDate).toLocaleString()}`
			: `Last joined ${new Date(this.lastJoined).toLocaleString()}`;

		const secondInfoValue = this.type === "account" 
			? this.badges.length 
			: fuzzyNumberFormat.format(playTime);

		const secondInfoDescription = this.type === "account" 
			? "User badges" 
			: playTimeUnit;

		return html`
			<div class="user-tooltip-header">
				<img src="images/rplace.png" width="32">
				<div class="user-tooltip-titles">
					<h2>${userIdentifier}</h2>
					<span>@${instanceIdentifier}</span>
				</div>
			</div>
			<span id="userDate">${userDate}</span>
			<hr>
			<div class="user-tooltip-grid">
				<h1>${fuzzyNumberFormat.format(this.pixelsPlaced)}</h1>
				<h1>${secondInfoValue}</h1>
				<span>Pixels placed</span>
				<span>${secondInfoDescription}</span>
			</div>`;
	}

	fromAccount(profile) {
		this.type = "account";
		
		// Account
		this.chatName = profile.chatName;
		this.creationDate = profile.creationDate;
		this.pixelsPlaced = profile.pixelsPlaced;
		this.badges = profile.badges;
	}

	fromCanvasUser(canvasUser, instance=null) {
		this.type = "canvasuser";
		
		// Canvas user
		this.chatName = canvasUser.chatName;
		this.userIntId = canvasUser.userIntId;
		this.lastJoined = canvasUser.lastJoined;
		this.pixelsPlaced = canvasUser.pixelsPlaced;
		this.playTimeSeconds = canvasUser.playTimeSeconds;

		// Instance
		if (instance) {
			this.instanceId = instance.id;
			this.instanceVanityName = instance.vanityName;
		}
	}
}
customElements.define("r-user-tooltip", UserTooltip);