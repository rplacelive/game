// Service worker for PWA installation
const CURRENT_CACHES = "tkv5"
self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CURRENT_CACHES).then((cache) =>
			cache.addAll([
				// Pages
				"404.html",
				"account-dialog.html",
				"disclaimer.html",
				"fakeapp.html",
				"index.html",
				"instance.html",
				"posts.html",
				"quests-dialog.html",

				// Styles
				"account.css",
				"goldplace.css",
				"misc-page.css",
				"posts.css",
				"shared.css",
				"styles.css",
				"css/theme-switch.css",
				"css/rplace-2022.css",
				"css/rplace-2023.css",

				// Modules
				//"live-chat-elements.js",
				//"event-timer.js",
				//"shared-elements.js",
				//"add-vip.js",
				//"shared.js",
				//"posts-elements.js",
				//"snowplace.js",
				//"account.js",
				//"darkplace.js",
				//"august21-event.js",
				//"trim-ban-mute-file.js",
				//"captcha-canvas.js",
				//"quests.js",
				//"posts-manager.js",

				// Images
				"favicon.ico",
				"favicon.png",
				"images/1984.png",
				"images/account-profile.png",
				"images/canv.png",
				"images/discord-ad.png",
				"images/discord.png",
				"images/discord-popup.png",
				"images/hammer-and-wrench.png",
				"images/lamda.png",
				"images/live.png",
				"images/news.png",
				"images/patreon.png",
				"images/reddit-login-banner.png",
				"images/reddit.png",
				"images/rplace2.png",
				"images/rplace-loader.gif",
				"images/rplace-offline.png",
				"images/rplace.png",
				"images/snoo-edge.png",
				"images/telegram-ad.png",
				"images/timelapse.png",
				"images/trophy.png",
				"images/x.png",
				"images/default-ad.png",
				"images/august21-ad.png",

				// Svg
				"svg/account.svg",
				"svg/chat.svg",
				"svg/clipboard.svg",
				"svg/expand-external.svg",
				"svg/flag-gb.svg",
				"svg/green-checkmark.svg",
				"svg/help.svg",
				"svg/icon-back.svg",
				"svg/image.svg",
				"svg/loading-spinner.svg",
				"svg/lock.svg",
				"svg/menu.svg",
				"svg/moderate-action.svg",
				"svg/pattern.svg",
				"svg/pixel-select-2022.svg",
				"svg/pixel-select-2023.svg",
				"svg/place-chat.svg",
				"svg/player.svg",
				"svg/reply-action.svg",
				"svg/report-action.svg",
				"svg/rplace.svg",
				"svg/santa-hat.svg",
				
				// Badges
				"badges/1000000-pixels-placed.svg",
				"badges/100000-pixels-placed.svg",
				"badges/1000-pixels-placed.svg",
				"badges/100-pixels-placed.svg",
				"badges/20000-pixels-placed.svg",
				"badges/5000-pixels-placed.svg",
				"badges/admin.svg",
				"badges/based.svg",
				"badges/discord-member.svg",
				"badges/ethical-botter.svg",
				"badges/gay.svg",
				"badges/moderator.svg",
				"badges/noob.svg",
				"badges/script-kiddie.svg",
				"badges/trouble-maker.svg",
				"badges/veteran.svg",

				// Custom emojis
				"custom_emojis/amogus.png",
				"custom_emojis/biaoqing.png",
				"custom_emojis/deepfriedh.png",
				"custom_emojis/edp445.png",
				"custom_emojis/fan.png",
				"custom_emojis/heavy.png",
				"custom_emojis/herkul.png",
				"custom_emojis/kaanozdil.png",
				"custom_emojis/lowtiergod.png",
				"custom_emojis/manly.png",
				"custom_emojis/plsaddred.png",
				"custom_emojis/rplace.png",
				"custom_emojis/rplacediscord.png",
				"custom_emojis/sonic.png",
				"custom_emojis/transparent.png",
				"custom_emojis/trollface.png",

				// Fonts
				"fonts/RedditMono-Bold.woff2",
				"fonts/RedditSans-Bold.woff2",
				"fonts/RedditSans-Regular.woff2",

				// Sounds
				"sounds/cooldown-start.mp3",
				"sounds/invalid.mp3",
				"sounds/cooldown-end.mp3",
				"sounds/highlight.mp3",
				"sounds/select-colour.mp3",
				"sounds/close-palette.mp3",
				"sounds/bell.mp3",

				// Translatins
				"translations/ar.json",
				"translations/de.json",
				"translations/el.json",
				"translations/es.json",
				"translations/fa.json",
				"translations/fr.json",
				"translations/hi.json",
				"translations/jp.json",
				"translations/ro.json",
				"translations/ru.json",
				"translations/tr.json",
				"translations/uk.json"
			])
		)
	)
})

self.addEventListener("fetch", (event) => {
	if (event.request.method !== "GET") return
	event.respondWith(
		(async () => {
			const cache = await caches.open(CURRENT_CACHES)
			const cachedResponse = await cache.match(event.request)

			if (cachedResponse) return cachedResponse
			return await fetch(event.request)
		})()
	)
})