import { DEFAULT_AUTH } from "../../defaults.js";
import { handleFormSubmit, $, translate, makeRequest, BADGE_ICONS, ACCOUNT_TIER_NAMES } from "../../shared.js";

/**@type {number|null}*/let accountId = null
/**@type {any|null}*/let accountInstance = null

const unauthedPage = /**@type {HTMLElement}*/($("#unauthedPage"));
const signinMessage = /**@type {HTMLElement}*/($("#signinMessage"));

const authToggleLink = /**@type {HTMLAnchorElement}*/($("#authToggleLink"));
authToggleLink.addEventListener("touchend", function(e) {
	e.preventDefault();
})

authToggleLink.addEventListener("click", async function(e) {
	e.preventDefault()
	const isSigninPage = unauthedPage.dataset.page === "signin"
	unauthedPage.dataset.page = isSigninPage ? "signup" : "signin"
	authToggleLink.textContent = await translate(isSigninPage ? "signInInstead" : "createNewAccount")
})

const signinForm = /**@type {HTMLFormElement}*/($("#signinForm"));
handleFormSubmit(signinForm, `${localStorage.auth || DEFAULT_AUTH}/auth/signin`, {
	onSuccess: (login) => {
		accountId = login.accountId
		loginPanel.dataset.page = "unauthed"
		unauthedPage.dataset.page = "authcode"
	},
	onError: async (err) => {
		if (typeof err === "object") {
			signinMessage.textContent = `${await translate("couldntSignIn")}: ${await translate(err.key)}`
			console.error("Couldn't sign in:", err.message, err.metadata)
		}
		else {
			signinMessage.textContent = `${await translate("couldntSignIn")}: ${await translate("unknownError")}`
			console.error("Couldn't sign in:", err)
		}
	}
})

const signupForm = /**@type {HTMLFormElement}*/($("#signupForm"));
const loginPanel = /**@type {HTMLElement}*/($("#loginPanel"));
const signupMessage = /**@type {HTMLElement}*/($("#signupMessage"));

handleFormSubmit(signupForm, `${localStorage.auth || DEFAULT_AUTH}/auth/signup`, {
	bind: ({ username, email }) => {
		return { username: username.value, email: email.value }
	},
	checkCustomValidity: ({ email, confirmEmail }) => {
		if (email.value !== confirmEmail.value) {
			confirmEmail.setCustomValidity("Emails do not match!")
			signupMessage.textContent = "Emails do not match!"
			confirmEmail.reportValidity()
			confirmEmail.setCustomValidity("")
			return false
		}
		return true
	},
	preRequest: () => {
		loginPanel.dataset.page = "loading"
	},
	onSuccess: (signup) => {
		accountId = signup.accountId
		unauthedPage.dataset.page = "authcode"
	},
	onError: async (err) => {
		loginPanel.dataset.page = "unauthed"
		if (typeof err === "object") {
			signupMessage.textContent = `${await translate("couldntSignUp")}: ${await translate(err.key)}`
			console.error("Couldn't sign up:", err.message, err.metadata)
		}
		else {
			signupMessage.textContent = `${await translate("couldntSignUp")}: ${await translate("signinError")}`
			console.error("Couldn't sign up:", err)
		}
	}
})

const verificationForm = /**@type {HTMLFormElement}*/($("#verificationForm"));
const verificationCodeInput = /**@type {HTMLInputElement}*/($("#verificationCodeInput"));
const verificationMessage = /**@type {HTMLElement}*/($("#verificationMessage"));

verificationCodeInput.addEventListener("input", function(e) {
	const value = verificationCodeInput.value.replace("-", "").toUpperCase()
	if (value.length >= 3) {
		verificationCodeInput.value = value.slice(0, 3) + '-' + value.slice(3, 6)
	}
	else {
		verificationCodeInput.value = value
	}
})

handleFormSubmit(verificationForm, `${localStorage.auth || DEFAULT_AUTH}/auth/verify`, {
	bind: ({ code }) => {
		return { accountId: accountId, code: code.value.replaceAll("-", "") }
	},
	preRequest: () => {
		loginPanel.dataset.page = "loading"
	},
	onSuccess: (verification) => {
		loginPanel.dataset.page = "profile"
		loadAccountProfile()

		// Notify parent window / other frames of login account event
		window.parent.postMessage({
			call: "dispatchAccountEvent",
			data: {
				eventName: "account-login",
				detail: { account }
			}
		}, location.origin)
	},
	onError: async (err) => {
		loginPanel.dataset.page = "unauthed"
		if (typeof err === "object") {
			verificationMessage.textContent = `${await translate("couldntVerifySignIn")}: ${await translate(err.key)}`
			console.error("Couldn't verify signin:", err.message, err.metadata)
		}
		else {
			verificationMessage.textContent = `${await translate("couldntVerifySignIn")}: ${await translate("signinError")}`
			console.error("Couldn't verify signin:", err)
		}
	}
})

const errorMessage = /**@type {HTMLElement}*/($("#errorMessage"));

async function loadAccountProfile() {
	const result = await makeRequest(`${localStorage.auth || DEFAULT_AUTH}/accounts/me`)
	if (result.status === "error") {
		const err = result.data
		loginPanel.dataset.page = "error"
		if (typeof err === "object") {
			errorMessage.textContent = `${await translate("couldntLoadAccountProfile")}: ${await translate(err.key)}`
			console.error("Couldn't load account profile:", err.message, err.metadata)
		}
		else {
			errorMessage.textContent = `${await translate("couldntLoadAccountProfile")}`
			console.error("Couldn't load account profile:", err)
		}
		return null
	}
	else {
		const account = result.data
		accountInstance = account
		await updateAccountProfile(account)
		return account
	}
}

const profileName = /**@type {HTMLElement}*/($("#profileName"));
const profileBio = /**@type {HTMLInputElement}*/($("#profileBio"));
const profileDiscord = /**@type {HTMLElement}*/($("#profileDiscord"));
const profileReddit = /**@type {HTMLElement}*/($("#profileReddit"));
const profileX = /**@type {HTMLElement}*/($("#profileX"));
const profilePixels = /**@type {HTMLElement}*/($("#profilePixels"));
const profileJoin = /**@type {HTMLElement}*/($("#profileJoin"));
const profileBadges = /**@type {HTMLElement}*/($("#profileBadges"));
const accountTier = /**@type {HTMLElement}*/($("#accountTier"));
const accountEmail = /**@type {HTMLElement}*/($("#accountEmail"));
const profileCanvasUserList = /**@type {HTMLElement}*/($("#profileCanvasUserList"));
const profileCanvasUsers = /**@type {HTMLElement}*/($("#profileCanvasUsers"));

async function updateAccountProfile(account) {
	// Card left
	profileName.textContent = account.username;
	profileBio.value = account.biography;
	profileDiscord.textContent = account.discordHandle;
	profileReddit.textContent = account.redditHandle;
	profileX.textContent = account.twitterHandle;

	// Card right
	profilePixels.textContent = account.pixelsPlaced;
	profileJoin.textContent = new Date(account.creationDate).toLocaleString();
	if (account.badges.length === 0) {
		profileBadges.textContent = "None";
	}
	else {
		profileBadges.innerHTML = "";
		for (const badgeId of account.badges) {
			const badgeImg = document.createElement("img");
			badgeImg.src = BADGE_ICONS[badgeId];
			profileBadges.appendChild(badgeImg);
		}
	}

	// Private account data
	accountTier.textContent = `${await translate(ACCOUNT_TIER_NAMES[account.tier])}`;
	accountEmail.textContent = account.email;

	// Connections
	const canvasUsersResult = await makeRequest(`${localStorage.auth || DEFAULT_AUTH}/accounts/me/canvas-users`);
	if (canvasUsersResult.status == "success") {
		const { canvasUsers, instances } = canvasUsersResult.data;
		/**@type {Map<number, any>}*/const instancesMap = new Map();
		for (const instance of instances) {
			instancesMap.set(instance.id, instance);
		}

		for (const canvasUser of canvasUsers) {
			const instance = instancesMap.get(canvasUser.instanceId);

			// Profile canvas users list
			const itemEl = document.createElement("li");
			const identifierSpan = document.createElement("span");
			identifierSpan.textContent = `${canvasUser.chatName ?? ""}#${canvasUser.userIntId}@${
				instance.vanityName ?? "canvas"+instance.Id}`;
			itemEl.appendChild(identifierSpan);
			const tooltipEl = /**@type {import("./account-elements.js").UserTooltip}*/(document.createElement("r-user-tooltip"));
			tooltipEl.fromCanvasUser(canvasUser, instance);
			itemEl.appendChild(tooltipEl);
			profileCanvasUserList.appendChild(itemEl);

			// Profile canvas users cards
			const cardEl = /**@type {import("./account-elements.js").CanvasUserCard}*/(document.createElement("r-canvas-user-card"));
			cardEl.fromCanvasUser(canvasUser, instance);
			profileCanvasUsers.appendChild(cardEl);
		}
	}
	else {
		// TODO: Handle this!
	}

}

const logoutButton = /**@type {HTMLElement}*/($("#logoutButton"));
logoutButton.addEventListener("click", async function() {
	const result = await makeRequest(`${localStorage.auth || DEFAULT_AUTH}/auth/logout`)
	if (result.status === "success") {
		// Notify parent window / other frames of logout account event
		window.parent.postMessage({
			call: 'dispatchAccountEvent',
			data: {
				eventName: 'account-logout'
			}
		}, location.origin)
		return window.location.reload()
	}
	else {
		const err = result.data
		if (typeof err === "object") {
			console.error("Couldn't log out:", err.message, err.metadata)
		}
		else {
			console.error("Couldn't log out:", err)
		}
	}
})

const deleteAccountButton = /**@type {HTMLElement}*/($("#deleteAccountButton"));
deleteAccountButton.addEventListener("click", async function() {
	if (!confirm(await translate("deleteAccountAreYouSure"))) {
		return
	}
	if (prompt(await translate("deleteAccountEnterEmail")) !== accountInstance.email) {
		return
	}

	const result = await makeRequest(`${localStorage.auth || DEFAULT_AUTH}/accounts/me`, "DELETE")
	if (result.status === "success") {
		loginPanel.dataset.page = "unauthed"
	}
	else {
		const err = result.data
		if (typeof err === "object") {
			console.error("Couldn't delete account:", err.message, err.metadata)
		}
		else {
			console.error("Couldn't delete account:", err)
		}
	}
})

const profilePicture = /**@type {HTMLImageElement}*/($("#profilePicture"));
const profilePictureButton = /**@type {HTMLButtonElement}*/($("#profilePictureButton"));
const profilePictureInput = /**@type {HTMLInputElement}*/($("#profilePictureInput"));
profilePicture.addEventListener("dragenter", function(e) {
	e.stopPropagation();
	e.preventDefault();
});
profilePicture.addEventListener("dragover", function(e) {
	e.stopPropagation();
	e.preventDefault();
	profilePicture.style.outline = "4px solid #d93a00";
	profilePictureButton.focus();
});
profilePicture.addEventListener("drop", function(e) {
	e.stopPropagation();
	e.preventDefault();
	profilePicture.style.outline = "initial";
	const file = e.dataTransfer?.files[0];
	if (file && file.type.startsWith('image/')) {
		//updateProfilePicture(file)
	}
});
profilePicture.addEventListener("dragleave", function(e) {
	e.stopPropagation();
	e.preventDefault();
	profilePicture.style.outline = "initial";
});
profilePictureButton.addEventListener("click", function() {
	profilePictureInput.click();
});
profilePictureInput.addEventListener("change", function() {
	const imageFiles = profilePictureInput.files;
	const imageFile = (imageFiles && imageFiles.length > 0)
		? imageFiles[0]
		: null;
	if (imageFile) {
		//updateProfilePicture(imageFile)
	}
});

// Try load account profile immediately if already logged in
const result = await makeRequest(`${localStorage.auth || DEFAULT_AUTH}/accounts/me`)
if (result.status === "success") {
	const account = result.data;
	accountInstance = account;
	loginPanel.dataset.page = "profile";
	await updateAccountProfile(account);
}
else {
	loginPanel.dataset.page = "unauthed";
}
