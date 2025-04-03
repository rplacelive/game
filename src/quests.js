import { AUDIOS } from "./defaults"
import { confetti } from "@tsparticles/confetti";
import { syncLocalStorage } from "./shared";

/**
 * @typedef {Record<string, any>} Quests
 * @property {{ stage: number }} seeCommunityPosts
 */

// Contains routines for user exploration
/**@type {Quests|null}*/let quests = null
const stages = {
	// generic
	notStarted: 0,
	// seeCommunityPosts
	closebtnClicked: 1,
	postJumpButtonClicked: 2
}
if (!localStorage.quests) {
	const DEFAULT_QUESTS = {
		seeCommunityPosts: { stage: stages.notStarted }
	}
	quests = DEFAULT_QUESTS
	localStorage.quests = JSON.stringify(quests)
}
else {
	quests = JSON.parse(localStorage.quests)
}

/** @type {Record<string, any>} */
quests = syncLocalStorage("quests", quests)

const questsFrame = /**@type {HTMLIFrameElement}*/(document.getElementById("questsFrame"));
questsFrame.addEventListener("load", function() {
	const closeButton = /**@type {HTMLElement}*/(document.getElementById("closebtn"));

	if (quests.seeCommunityPosts.stage <= stages.notStarted) {
		closeButton.classList.add("please-click")
		const closeClicked = () => {
			closeButton.classList.remove("please-click")
			quests.seeCommunityPosts.stage = stages.closebtnClicked
			AUDIOS.bell.run()
			confetti({
				particleCount: 100,
				spread: 70,
				origin: { y: 0.6 },
			})
			closeButton.removeEventListener("click", closeClicked)
		}
		closeButton.addEventListener("click", closeClicked)
	}
	if (quests.seeCommunityPosts.stage <= stages.closebtnClicked) {
		const postsFrame = /**@type {HTMLIFrameElement}*/(document.getElementById("postsFrame"));
		postsFrame.addEventListener("load", function(e) {
			const postJumpButton = /**@type {HTMLButtonElement}*/(postsFrame.contentDocument?.querySelector("#postJumpButton"));
			postJumpButton.classList.add("please-click");
			const postJumpClicked = () => {
				postJumpButton.classList.remove("please-click");
				quests.seeCommunityPosts.stage = stages.postJumpButtonClicked;
				AUDIOS.celebration.run();
				confetti({
					particleCount: 100,
					spread: 100,
					origin: { y: 0.6 },
				})
	
				// Display quests popup
				questsFrame.style.display = "block"
				const questsDescription = /**@type {HTMLElement}*/(questsFrame.contentDocument?.querySelector("#questsDescription"));
				// TODO: Translate this!
				questsDescription.textContent = "You have visited the community posts menu. Here you share canvas arts, make public announcements and chat with the community!";
	
				postJumpButton.removeEventListener("click", postJumpClicked);
			}
			postJumpButton.addEventListener("click", postJumpClicked)    
		})    
	}
})

export function closeQuestsFrame() {
	questsFrame.style.display = "none"
}
