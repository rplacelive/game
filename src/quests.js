/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Contains routines for user exploration
let quests = null
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

function syncLocalStorage(target) {
	const handler = {
		get(obj, prop) {
			if (typeof obj[prop] === "object" && obj[prop] !== null) {
				return new Proxy(obj[prop], handler)
			}
			return obj[prop]
		},
		set(obj, key, value) {
			obj[key] = value
			localStorage.quests = JSON.stringify(quests)
			return true
		}
	}
	return new Proxy(target, handler)
}
quests = syncLocalStorage(quests)

const questsFrame = document.getElementById("questsFrame")
questsFrame.addEventListener("load", function() {
	if (quests.seeCommunityPosts.stage <= stages.notStarted) {
		closebtn.classList.add("please-click")
		const closeClicked = () => {
			closebtn.classList.remove("please-click")
			quests.seeCommunityPosts.stage = stages.closebtnClicked
			AUDIOS.bell.run()
			confetti({
				particleCount: 100,
				spread: 70,
				origin: { y: 0.6 },
			})
			closebtn.removeEventListener("click", closeClicked)
		}
		closebtn.addEventListener("click", closeClicked)
	}
	if (quests.seeCommunityPosts.stage <= stages.closebtnClicked) {
		postsFrame.addEventListener("load", function(e) {
			const postJumpButton = postsFrame.contentDocument.querySelector("#postJumpButton")
			postJumpButton.classList.add("please-click")
			const postJumpClicked = () => {
				postJumpButton.classList.remove("please-click")
				quests.seeCommunityPosts.stage = stages.postJumpButtonClicked
				AUDIOS.celebration.run()
				confetti({
					particleCount: 100,
					spread: 100,
					origin: { y: 0.6 },
				})
	
				// Display quests popup
				questsFrame.style.display = "block"
				const questsDescription = questsFrame.contentDocument.querySelector("#questsDescription")
				questsDescription.textContent = "You have visited the community posts menu. Here you share canvas arts, make public announcements and chat with the community!"
	
				postJumpButton.removeEventListener("click", postJumpClicked)
			}
			postJumpButton.addEventListener("click", postJumpClicked)    
		})    
	}
})

export function closeQuestsFrame() {
	questsFrame.style.display = "none"
}
