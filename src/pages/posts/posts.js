import { DEFAULT_AUTH, DEFAULT_SERVER, DEFAULT_BOARD } from "../../defaults.js";
import { translateAll, $, makeRequest, lerp } from "../../shared.js"
import { clearPosts, tryLoadBottomPosts, tryLoadKeywordPosts, tryLoadTopPosts } from "../../services/posts-manager.js"
import { getAccount, openAccountFrame } from "../../services/account-manager.js";
import { addIpcMessageHandler, handleIpcMessage, sendIpcMessage, makeIpcRequest } from "shared-ipc";

//  Main
const sidebar = /**@type {import("../../shared-elements.js").Sidebar}*/($("#sidebar"));
const sidebarButton = /**@type {HTMLElement}*/($("#sidebarButton"));
sidebarButton.addEventListener("click", function(/**@type {Event}*/e) {
	sidebar.open();
});

const postsSearchbar = /**@type {HTMLInputElement}*/($("#postsSearchbar"));
postsSearchbar.addEventListener("change", function(/**@type {Event}*/e) {
	const keyword = postsSearchbar.value.trim().toLowerCase();
	if (keyword) {
		tryLoadKeywordPosts(keyword)
		this.dataset.searching = "true"
	}
	else {
		this.dataset.searching = "false"
		clearPosts()
		tryLoadBottomPosts()
	}
});

const postsExpandButton = /**@type {HTMLButtonElement}*/($("#postsExpandButton"));
postsExpandButton.addEventListener("click", function(e) {
	e.preventDefault();
	sendIpcMessage(window.parent, "open", "./posts.html");
});
const liveChatPost = /**@type {HTMLElement}*/($("#liveChatPost"));
liveChatPost.addEventListener("click", function(e) {
	sendIpcMessage(window.parent, "openChatPanel");
});
const createPostPost = /**@type {HTMLElement}*/($("#createPostPost"));
const createPostContent = /**@type {import("./components/posts-elements.js").CreatePostContentsPreview}*/($("#createPostContent"));
const postRulesDialog = /**@type {HTMLDialogElement}*/($("#postRulesDialog"));
const discardPostButton = /**@type {HTMLButtonElement}*/($("#discardPostButton"));
discardPostButton.addEventListener("click", function(e) {
	e.stopPropagation();
	resetCreatePost();
});
const createPostButton = /**@type {HTMLButtonElement}*/($("#createPostButton"));
createPostButton.addEventListener("click", async function(e) {
	async function uploadAndUpdatePosts() {
		discardPostButton.disabled = true;
		createPostButton.disabled = true;
		const progressCb = function(/**@type {string}*/stage, /**@type {any}*/info) {
			if (stage === "uploadPost") {
				// TODO: Translate
				createPostStatus.textContent = "Uploading post: " + `${info.progress}%`;
			}
			else if (stage === "uploadContent") {
				// TODO: Translate
				createPostStatus.textContent = "Uploading attachment..." + `(${info.current}/${info.total})`
			}
		}
		if (await uploadPost(createPostTitle.value, createPostInput.value, createPostContent.contents, progressCb)) {
			resetCreatePost()
			// TODO: Make proper UI for this (toast?)
			alert("Post success!")
			await tryLoadTopPosts()
		}
		else {
			createPostStatus.textContent = "";
			createPostButton.disabled = false;
			discardPostButton.disabled = false;
		}
	}
	if (!createPostTitle.checkValidity()) {
		createPostTitle.reportValidity()
		return
	}
	if (!localStorage.agredPostRules) {
		sendIpcMessage(window.parent, "scrollToPosts")
		postRulesDialog.showModal()
		postRulesDialog.onclose = function(e) {
			if (postRulesDialog.returnValue == "true") {
				uploadAndUpdatePosts()
			}
		}
	}
	else {
		uploadAndUpdatePosts()
	}
});

const createPostTitle = /**@type {HTMLInputElement}*/($("#createPostTitle"));
const createPostInput = /**@type {HTMLInputElement}*/($("#createPostInput"));
createPostPost.addEventListener("dragenter", function(e) {
	e.stopPropagation();
	e.preventDefault();
});
createPostPost.addEventListener("dragover", function(e) {
	e.stopPropagation();
	e.preventDefault();
	this.classList.add("image-drop");
});
createPostPost.addEventListener("drop", function(e) {
	e.stopPropagation();
	e.preventDefault();
	this.classList.remove("image-drop");
	if (e.dataTransfer) {
		for (let i = 0; i < e.dataTransfer.files.length; i++) {
			const file = e.dataTransfer.files[i];
			if (file.type.startsWith("image/")) {
				createPostContent.addContent(file);
			}
		}	
	}
});
createPostPost.addEventListener("dragleave", function(e) {
	e.stopPropagation();
	e.preventDefault();
	this.classList.remove("image-drop");
});
createPostTitle.addEventListener("change", function(e) {
	createPostTitle.value = createPostTitle.value.trim();
	const validityState = createPostTitle.validity;
	if (validityState.tooLong || validityState.tooShort || validityState.valueMissing) {
		createPostTitle.setCustomValidity("Post title should be between 1-64 characters long!");
	}
	else {
		createPostTitle.setCustomValidity("");
	}
	createPostTitle.reportValidity();
});
createPostInput.addEventListener("keypress", function(e) {
	e.stopPropagation();
});
createPostInput.addEventListener("focus", function(e) {
	createPostPost.classList.add('focused');
	createPostInput.placeholder = "Post content...";
});
const createPostContentInput = /**@type {HTMLInputElement}*/($("#createPostContentInput"));
createPostContentInput.addEventListener("change", function(e) {
	if (!createPostContentInput.files) {
		return;
	}

	for (let i = 0; i < createPostContentInput.files.length; i++) {
		const file = createPostContentInput.files[i];
		createPostContent.addContent(file);
	}
});

const mainCanvasPost = /**@type {HTMLElement}*/($("#mainCanvasPost"));
async function initMainCanvasPost(embedded = false) {
	try {
		// Setup event handlers
		if (embedded) {
			mainCanvasPost.addEventListener("click", function() {
				sendIpcMessage(window.parent, "defaultServer");
			});
		}
		else {
			mainCanvasPost.addEventListener("click", function() {
				window.open(`${window.location.origin}/?server=${DEFAULT_SERVER}&board=${DEFAULT_BOARD}`);
			});
		}

		// Retrieve canvas info
		const httpServerUrl = (localStorage.server || DEFAULT_SERVER)
			.replace("wss://", "https://").replace("ws://", "http://");
		const req = await fetch(httpServerUrl, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				"Accept": "application/json"
			}
		});
		if (!req.ok) {
			throw new Error("Failed to fetch main canvas info");
		}
		const mainCanvasInfo = await req.json();
		if (!mainCanvasInfo) {
			throw new Error("Failed to parse main canvas info");
		}
		const { instance, canvas } = mainCanvasInfo;
		const { icon } = instance;
		const { width, height, cooldown } = canvas;

		// Update post with new canvas info
		const mainCanvasDescription = /**@type {HTMLElement}*/(mainCanvasPost.querySelector(".description"));
		const mainCanvasCoverImage = /**@type {HTMLImageElement}*/(mainCanvasPost.querySelector(".cover-image"));
		mainCanvasDescription.textContent = `${width}x${height} (cooldown: ${cooldown}ms)`;
		mainCanvasCoverImage.src = icon || "images/rplace.png";
	}
	catch (e) {
		console.error("Failed to fetch main canvas info", e);
	}
}

const accountPost = /**@type {HTMLElement}*/($("#accountPost"));
accountPost.addEventListener("click", function(e) {
	openAccountFrame();
});
const overlayPost = /**@type {HTMLElement}*/($("#overlayPost"));
overlayPost.addEventListener("click", function(e) {
	sendIpcMessage(window.parent, "openOverlayMenu");
});
const contents = /**@type {HTMLElement}*/($("#contents"));

// Embedded switches
window.addEventListener("DOMContentLoaded", async function() {
	if (window.parent !== window) {
		document.documentElement.setAttribute("embedded", "true");
		initMainCanvasPost(true);
	}
	else {
		document.documentElement.setAttribute("embedded", "false");
	
		tryLoadBottomPosts()
		document.body.style.setProperty("--posts-dialog-top", "50%")
		if (!await getAccount()) {
			disableCreatePost();
		}
		liveChatPost.remove();
		overlayPost.remove();
		initMainCanvasPost(false);
	
		// Load more posts on scroll down
		const body = document.body
		body.addEventListener("scroll", function(e) {
			const bodyMaxScroll = body.scrollHeight - body.clientHeight;
			if (bodyMaxScroll - body.scrollTop < 256 && postsSearchbar.dataset.searching != "true") {
				tryLoadBottomPosts();
			}
		}, { passive: true })
	}	
});

function enableCreatePost() {
	createPostPost.style.opacity = "1"
	createPostPost.style.pointerEvents = "all"
	createPostInput.disabled = false
	createPostTitle.disabled = false
}
function disableCreatePost() {
	createPostPost.style.opacity = "0.6"
	createPostPost.style.pointerEvents = "none"
	createPostInput.disabled = true
	createPostTitle.disabled =  true
}
window.addEventListener("account-login", () => {
	enableCreatePost()
})
window.addEventListener("account-logout", () => {
	disableCreatePost()
})

/**
 * @param {any} title
 * @param {any} content
 * @param {any[]} contents
 * @param {(arg0: string, arg1: { progress?: number; current?: any; success?: boolean; uploaded?: number; successfullyUploaded?: number; total?: any; }) => void} progressCb
 */
// TODO: Fix authentication
async function uploadPost(title, content, contents, progressCb) {
	const postData = {
		title: title,
		description: content,
		// TODO: Until we add forums, forum ID will always be 1 (canvas1)
		forumId: 1
	}

	// If we are logged in to an account, 
	const account = await getAccount()
	if (!account) {
		// Get link key from canvas server to prove we own this Canvas User ID
		const linkInfo = await makeIpcRequest(window.parent, "fetchLinkKey")
		if (!linkInfo) {
			alert("Could not upload post. Error communicating with server")
			console.error("Couldn't upload post: failed to retrieve link key from instance server", linkInfo)
			return false
		}
		postData.canvasUser = linkInfo // { linkKey: number, instanceId: number }

		// Pre-authenticate canvas uuser with auth server using link key
		const result = await makeRequest(`${localStorage.auth || DEFAULT_AUTH}/auth/link`, "POST", linkInfo);
		if (result.status === "error") {
			const err = result.data;
			if (typeof err === "object") {
				console.error("Couldn't upload post:", err.message, err.metadata);
			}
			else {
				console.error("Couldn't upload post:", err);
			}
			return
		}
	}

	// Upload post
	const uploadResponse = await new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("POST", `${localStorage.auth || DEFAULT_AUTH}/posts`, true);
		xhr.setRequestHeader("Content-Type", "application/json");
		xhr.withCredentials = true;
		xhr.upload.onprogress = (event) => {
			if (progressCb && event.lengthComputable) {
				const progress = event.loaded / event.total;
				progressCb("uploadPost", { progress });
			}
		}
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				if (progressCb) progressCb("uploadPost", { progress: 1 });
				resolve(JSON.parse(xhr.responseText));
			}
			else {
				let err = null;
				try {
					err = JSON.parse(xhr.responseText);
				}
				catch (e) {
					console.error(e);
					reject(xhr);
					return;
				}

				if (xhr.status === 401) {
					alert("Error: You are being rate limited. Please wait before posting again");
				}
				else {
					alert("Couldn't upload post: " + (err?.message || xhr.statusText));
				}
				reject(xhr)
			}
		}
		xhr.onerror = () => {
			console.error("Couldn't upload post: Network error occurred during upload");
			reject(xhr);
		}
		xhr.send(JSON.stringify(postData));
		if (progressCb) progressCb("uploadPost", { progress: 0 });
	})
	if (!uploadResponse) {
		return;
	}

	// Upload file as form content
	let contentsUploaded = 0;
	let contentsUploadedSuccess = 0;
	/**
	 * @type {any[]}
	 */
	const contentUploadTasks = [];
	contents.forEach((/** @type {string | Blob} */ file, /** @type {any} */ index) => {
		const contentForm = new FormData(); // new Blob([], { type: "text/plain" })
		contentForm.append("file", file);
		contentUploadTasks.push(
			fetch(`${localStorage.auth || DEFAULT_AUTH}/posts/${uploadResponse.postId}/contents/`, {
					method: "POST",
					body: contentForm,
				})
				.then(async (contentResponse) => {
					if (!contentResponse.ok) {
						const jsonError = await contentResponse.json().catch(e => console.error(e))
						alert("Error: Failed to upload one of the post attachments: " + jsonError.message)
						console.error(contentResponse.status, contentResponse.statusText)
						contentsUploadedSuccess++
					}
					contentsUploaded++
					if (progressCb) progressCb("uploadContent", {
						current: index,
						success: contentResponse.ok,
						uploaded: contentsUploaded,
						successfullyUploaded: contentsUploadedSuccess,
						total: contents.length
					})
				})
				.catch(e => {
					alert("Error: Failed to upload one of the post attachments")
					console.error(e)
				}))
	})
	await Promise.all(contentUploadTasks);
	return true;
}

const createPostStatus = /**@type {HTMLElement}*/($("#createPostStatus"));

function resetCreatePost() {
	createPostButton.disabled = false;
	discardPostButton.disabled = false;
	createPostStatus.textContent = "";
	createPostTitle.value = "";
	createPostInput.value = "";
	createPostContent.clearContents();
	createPostInput.placeholder = "Create post...";
	createPostPost.classList.remove("focused");
}

const resizeObserver = new ResizeObserver(entries => {
	sendIpcMessage(window.parent, "resizePostsFrame");
})
resizeObserver.observe(contents);

// Bidirectional IPC, similar to server.ts - db-worker.ts communication
// Methods called by iframe parent
function onlineCounter(/**@type {number}*/count) {
	const onlineCounter2 = $("#onlineCounter2");
	onlineCounter2.textContent = count + " online"
}
function updateDialogTop(/**@type {number}*/topHeight) {
	document.body.style.setProperty("--posts-dialog-top", topHeight + "px")
}
addIpcMessageHandler("onlineCounter", onlineCounter);
addIpcMessageHandler("updateDialogTop", updateDialogTop);
addIpcMessageHandler("tryLoadBottomPosts", tryLoadBottomPosts);
window.addEventListener("message", handleIpcMessage);

translateAll();