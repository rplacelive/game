import { confetti } from "@tsparticles/confetti";
import { AUDIOS } from "../pages/index/game-defaults.js";
import { syncLocalStorage } from "../shared.js";
import { addIpcMessageHandler } from "shared-ipc";

// TODO: Rethink the entire approach to this script - much of the logic
// TODO: is very page dependent (when a service shouldn't be) and bound tightly
// TODO: to the elements in the DOM, very big source of bugs!

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
};
if (!localStorage.quests) {
	const DEFAULT_QUESTS = {
		seeCommunityPosts: { stage: stages.notStarted }
	}
	quests = DEFAULT_QUESTS
	localStorage.quests = JSON.stringify(quests);
}
else {
	quests = JSON.parse(localStorage.quests);
}
quests = syncLocalStorage("quests", /**@type {Quests}*/(quests));

/**@type {HTMLIFrameElement|null}*/let questsFrame = null;

export function openQuestsFrame() {
	if (questsFrame === null) {
		// Lazy load quests frame
		questsFrame = document.createElement("iframe");
		questsFrame.id = "questsFrame";
		questsFrame.title = "Quests";
		questsFrame.src = "quests-dialog.html";
		document.body.appendChild(questsFrame);
	}

	questsFrame.addEventListener("load", function() {
		const closeButton = /**@type {HTMLElement}*/(document.getElementById("closebtn"));
		if (!quests) {
			throw new Error("quests was null");
		}

		if (quests.seeCommunityPosts.stage <= stages.notStarted) {
			closeButton.classList.add("please-click");
			const closeClicked = async () => {
				closeButton.classList.remove("please-click");
				quests.seeCommunityPosts.stage = stages.closebtnClicked;

				// Play bell sound
				AUDIOS.bell.currentTime = 0;
				AUDIOS.bell.play();

				// Play confetti animation
				const confettiInstance = await confetti({
					particleCount: 100,
					spread: 70,
					origin: { y: 0.6 },
				});
				setTimeout(() => {
					confettiInstance?.destroy()
				}, 3000);

				closeButton.removeEventListener("click", closeClicked);
			}
			closeButton.addEventListener("click", closeClicked);
		}
		if (quests.seeCommunityPosts.stage <= stages.closebtnClicked) {
			const postsFrame = /**@type {HTMLIFrameElement}*/(document.getElementById("postsFrame"));
			postsFrame.addEventListener("load", function(e) {
				const postJumpButton = /**@type {HTMLButtonElement}*/(postsFrame.contentDocument?.querySelector("#postJumpButton"));
				postJumpButton.classList.add("please-click");
				const postJumpClicked = async () => {
				if (!questsFrame) {
					throw new Error("questsFrame was null");
				}

					postJumpButton.classList.remove("please-click");
					quests.seeCommunityPosts.stage = stages.postJumpButtonClicked;

					// Play celebration sound
					AUDIOS.celebration.currentTime = 0;
					AUDIOS.celebration.play();

					// Play confetti animation
					const confettiInstance = await confetti({
						particleCount: 100,
						spread: 100,
						origin: { y: 0.6 }
					});
					setTimeout(() => {
						confettiInstance?.destroy()
					}, 3000);

					// Display quests popup
					questsFrame.style.display = "block"
					const questsDescription = /**@type {HTMLElement}*/(questsFrame.contentDocument?.querySelector("#questsDescription"));
					// TODO: Translate this!
					questsDescription.textContent = "You have visited the community posts menu. Here you share canvas arts, make public announcements and chat with the community!";
		
					postJumpButton.removeEventListener("click", postJumpClicked);
				}
				postJumpButton.addEventListener("click", postJumpClicked);
			})
		}
	})
}

export function closeQuestsFrame() {
	if (questsFrame) {
		questsFrame.style.display = "none";
	}
}

// Hook up cross frame / parent window IPC request handlers
addIpcMessageHandler("openQuestsFrame", openQuestsFrame);
addIpcMessageHandler("closeQuestsFrame", closeQuestsFrame);