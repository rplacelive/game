import { DEFAULT_AUTH } from "./defaults.js";
import { PublicPromiseSync } from "./shared.js";

class PostElArray {
	constructor() {
		/**@type {import("./posts-elements.js").Post[]}*/this.items = []
	}

	/**
	 * 
	 * @param {import("./posts-elements.js").Post} postEl 
	 * @param {Function} comparisonFn 
	 */
	orderedInsert(postEl, comparisonFn) {
		let insertIndex = this.items.findIndex(existingItem => existingItem.post.id === postEl.post?.id);
		if (insertIndex >= 0) {
			this.items[insertIndex] = postEl;
		}
		else {
			insertIndex = this.items.findIndex(existingItem => comparisonFn(postEl, existingItem) < 0);
			if (insertIndex === -1) {
				this.items.push(postEl);
				insertIndex = this.items.length - 1;
			}
			else {
				this.items.splice(insertIndex, 0, postEl);
			}
		}
		return insertIndex;
	}

	/**
	 * @param {import("./posts-elements.js").Post} postEl 
	 */
	delete(postEl) {
		this.items = this.items.filter(existingItem => existingItem.post.id !== postEl.post?.id);
	}

	/**
	 * @param {import("./posts-elements.js").Post} postEl 
	 */
	includes(postEl) {
		return this.items.some(existingItem => existingItem.post.id === postEl.post?.id);
	}

	/**
	 * @param {import("./posts-elements.js").Post} id 
	 */
	getById(id) {
		return this.items.find(postEl => postEl.post?.id === id);
	}

	clear() {
		this.items.length = 0;
	}
}

const contents = /**@type {HTMLElement}*/(document.getElementById("contents"));
const postsSortSelect = /**@type {HTMLSelectElement}*/(document.getElementById("postsSortSelect"));
const postsHideSensitive = /**@type {HTMLInputElement}*/(document.getElementById("postsHideSensitive"));

let topUpvotes = 0;
let topDate = new Date(0);
let bottomUpvotes = 0xFFFFFFFF;
let bottomDate = new Date();

const postEls = new PostElArray();
const contentsBaseLength = contents.childNodes.length;
const postLimit = 32;
const postLoadCooldown = 1000;
/**@type {PublicPromiseSync | null}*/let postFinishedLastLoad = null;
/**@type {"upvotes"|"date"}*/let filter = postsSortSelect.value == "upvotes" ? "upvotes" : "date";
let hideSensitive = !!postsHideSensitive.checked;

/**
 * @param {HTMLElement} parentElement
 * @param {HTMLElement} newElement
 * @param {number} index
 */
function insertElementAtIndex(parentElement, newElement, index) {
	const referenceElement = parentElement.childNodes[index];
	if (referenceElement) {
		parentElement.insertBefore(newElement, referenceElement);
	}
	else {
		parentElement.appendChild(newElement);
	}
}

async function finishPostLoadWithCd() {
	await new Promise(resolve => setTimeout(resolve, postLoadCooldown));
	postFinishedLastLoad?.resolve(undefined);
}

/**
 * @param {string} sortBy
 * @param {Record<string, string>} paramsObject
 */
async function tryLoadPosts(sortBy, paramsObject) {
	paramsObject = Object.assign({ limit: postLimit }, paramsObject);
	const params = new URLSearchParams(paramsObject);

	if (postFinishedLastLoad !== null) {
		if (postFinishedLastLoad.locked) {
			return false;
		}
		await postFinishedLastLoad.acquireAwaitPromise();
	}
	postFinishedLastLoad = new PublicPromiseSync();

	const postsUrl = `${localStorage.auth || DEFAULT_AUTH}/posts/?${params.toString()}`;
	const res = await fetch(postsUrl);
	if (!res.ok) {
		console.error(`Failed to load top posts, status ${res.status} ${res.statusText}:`, await res.json());
		await finishPostLoadWithCd();
		return false;
	}
	const postsObject = await res.json();
	for (const post of postsObject.posts) {
		const postDate = new Date(post.creationDate);
		const existingPost = postEls.getById(post.id);
		if (existingPost) { // Update the post with new data
			existingPost.fromPost(post);
		}
		else {
			const postEl = /**@type {import("./posts-elements.js").Post}*/(document.createElement("r-post"));
			postEl.fromPost(post);
			if (hideSensitive && post.hasSensitiveContent) {
				postEl.hidden = true;
			}
			/**@type {Function|null}*/let comparisonFn = null;
			switch (sortBy) {
				case "beforeDate": {
					// @ts-ignore
					comparisonFn = (a, b) => new Date(b.post.creationDate) - new Date(a.post.creationDate);
					break
				}
				case "sinceDate": {
					// @ts-ignore	
					comparisonFn = (a, b) => new Date(a.post.creationDate) - new Date(b.post.creationDate);
					break
				}
				case "beforeUpvotes": {
					// @ts-ignore
					comparisonFn = (a, b) => b.post.upvotes - a.post.upvotes;
					break
				}
				case "sinceUpvotes": {
					// @ts-ignore
					comparisonFn = (a, b) => a.post.upvotes - b.post.upvotes;
					break
				}
				default: {
					await finishPostLoadWithCd();
					return false;
				}
			}
			const insertIndex = postEls.orderedInsert(postEl, comparisonFn);
			insertElementAtIndex(contents, postEl, contentsBaseLength + insertIndex);
		}
		if (sortBy === "beforeDate" || sortBy === "sinceDate") {
			if (postDate < bottomDate) {
				bottomDate = postDate;
			}
			if (postDate > topDate) {
				topDate = postDate;
			}
		}
		else if (sortBy === "beforeUpvotes" || sortBy === "sinceUpvotes") {
			if (post.upvotes < bottomUpvotes) {
				bottomUpvotes = post.upvotes;
			}
			if (post.upvotes > topUpvotes) {
				topUpvotes = post.upvotes;
			}
		}
	}

	await finishPostLoadWithCd()
	return true
}

// "date" - Most recent / "upvotes" - highest upvotes
export async function tryLoadTopPosts() {
	if (filter == "date") {
		await tryLoadPosts("sinceDate", { sinceDate: topDate.toISOString() })
	}
	else if (filter == "upvotes") {
		await tryLoadPosts("sinceUpvotes", { sinceUpvotes: String(topUpvotes) })
	}
}

// "date" - Most old, "votes" - lowest upvotes
export async function tryLoadBottomPosts() {
	if (filter == "date") {
		await tryLoadPosts("beforeDate", { beforeDate: bottomDate.toISOString() })
	}
	else if (filter == "upvotes") {
		await tryLoadPosts("beforeUpvotes", { beforeUpvotes: String(bottomUpvotes) })
	}
}

/**
 * @param {string} keyword 
 */
export async function tryLoadKeywordPosts(keyword) {
	clearPosts()
	let sortBy = null
	let sortValue = null
	if (filter == "date") {
		sortBy = "beforeDate"
		sortValue = bottomDate.toISOString()
	}
	else if (filter == "upvotes") {
		sortBy = "beforeUpvotes"
		sortValue = bottomUpvotes
	}
	if (sortBy === null || sortValue === null) {
		return
	}
	// @ts-ignore
	await tryLoadPosts(sortBy, { [sortBy]: sortValue, keyword })
}

export function clearPosts() {
	for (const postEl of postEls.items) {
		if (contents.contains(postEl)) {
			contents.removeChild(postEl)
		}
	}
	postEls.clear()
	topUpvotes = 0
	topDate = new Date(0)
	bottomUpvotes = 0xFFFFFFFF
	bottomDate = new Date()
}

postsSortSelect.addEventListener("change", function() {
	filter = postsSortSelect.value == "upvotes" ? "upvotes" : "date";
	clearPosts();
	tryLoadBottomPosts();
})
postsHideSensitive.addEventListener("change", function() {
	hideSensitive = !!postsHideSensitive.checked;
	for (const postEl of postEls.items) {
		postEl.hidden = hideSensitive && postEl.post.hasSensitiveContent;
	}
})
