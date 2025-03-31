/**
 * @constant {string[]} CHAT_COLOURS
 * List of predefined colours for chat usernames.
 */
export const CHAT_COLOURS = ["lightblue", "navy", "green", "purple", "grey", "brown", "orangered", "gold"]

/**
 * @constant {string} VERIFIED_APP_HASH
 * SHA256 hash used to verify the integrity of the application.
 */
export const VERIFIED_APP_HASH = "90e58b1f2c5fb98f74962806b85c2d7d3f7b18be8abe7a04f21e939868625357"

/**
 * @constant {string} UNMUTED_SVG
 * SVG path for the unmuted icon.
 */
export const UNMUTED_SVG = '<path d="M10.543.5a1.12 1.12 0 00-1.182.117L3.789 4.875h-1.8A1.127 1.127 0 00.868 6v8a1.127 1.127 0 001.125 1.125h1.8l5.572 4.258a1.117 1.117 0 00.681.232 1.128 1.128 0 001.127-1.126V1.511A1.119 1.119 0 0010.543.5zm-.624 17.736l-5.708-4.361H2.118v-7.75h2.093l5.708-4.361zM13 3.375v1.25a5.375 5.375 0 010 10.75v1.25a6.625 6.625 0 000-13.25z"></path><path d="M16.125 10A3.129 3.129 0 0013 6.875v1.25a1.875 1.875 0 010 3.75v1.25A3.129 3.129 0 0016.125 10z"></path>'

/**
 * @constant {string} MUTED_SVG
 * SVG path for the muted icon.
 */
export const MUTED_SVG = '<path d="M19.442 7.442l-.884-.884L16.5 8.616l-2.058-2.058-.884.884L15.616 9.5l-2.058 2.058.884.884 2.058-2.058 2.058 2.058.884-.884L17.384 9.5l2.058-2.058zM10.543.5a1.12 1.12 0 00-1.182.117L3.789 4.875h-1.8A1.127 1.127 0 00.868 6v8a1.127 1.127 0 001.125 1.125h1.8l5.572 4.258a1.117 1.117 0 00.681.232 1.128 1.128 0 001.127-1.126V1.511A1.119 1.119 0 0010.543.5zm-.624 17.736l-5.708-4.361H2.118v-7.75h2.093l5.708-4.361z"></path>'

/**
 * @constant {string} DEFAULT_PALETTE_KEYS
 * String containing the default palette keys used in the app.
 */
export const DEFAULT_PALETTE_KEYS = "123456789abcdefghijklmnopqrstuvwxyz"

/**
 * @typedef {Object<string, HTMLAudioElement>} AudioMap
 * @property {HTMLAudioElement} invalid - Invalid sound.
 * @property {HTMLAudioElement} highlight - Highlight sound.
 * @property {HTMLAudioElement} selectColour - Select colour sound.
 * @property {HTMLAudioElement} closePalette - Close palette sound.
 * @property {HTMLAudioElement} cooldownStart - Cooldown start sound.
 * @property {HTMLAudioElement} cooldownEnd - Cooldown end sound.
 * @property {HTMLAudioElement} bell - Bell sound.
 * @property {HTMLAudioElement} celebration - Celebration sound.
 */

/**
 * @constant {AudioMap} AUDIOS
 * Map of audio elements used in the application.
 */
export const AUDIOS = {
	invalid: new Audio("./sounds/invalid.mp3"),
	highlight: new Audio("./sounds/highlight.mp3"),
	selectColour: new Audio("./sounds/select-colour.mp3"),
	closePalette: new Audio("./sounds/close-palette.mp3"),
	cooldownStart: new Audio("./sounds/cooldown-start.mp3"),
	cooldownEnd: new Audio("./sounds/cooldown-end.mp3"),
	bell: new Audio("./sounds/bell.mp3"),
	celebration: new Audio("./sounds/celebration.mp3")
}

/**
 * @typedef {Map<string, string>} EmojiMap
 */

/**
 * @constant {EmojiMap} EMOJIS
 */
export const EMOJIS = new Map([
	["rofl", "🤣"],
	["joy", "😂"],
	["cool", "😎"],
	["sunglasses", "😎"],
	["heart", "❤️"],
	["moyai", "🗿"],
	["bruh", "🗿"],
	["skull", "💀"],
	["sus", "ඞ"],
	["tr", "🇹🇷"],
	["turkey", "🇹🇷"],
	["ir", "🇮🇷"],
	["iran", "🇮🇷"],
	["gb", "🇬🇧"],
	["britain", "🇬🇧"],
	["us", "🇺🇸"],
	["america", "🇺🇸"],
	["ru", "🇷🇺"],
	["russia", "🇷🇺"],
	["es", "🇪🇸"],
	["spain", "🇪🇸"],
	["eyes", "👀"],
	["fire", "🔥"],
	["thumbsup", "👍"],
	["thumbsdown", "👎"],
	["clown", "🤡"],
	["facepalm", "🤦‍♂️"],
	["ok", "👌"],
	["poop", "💩"],
	["rocket", "🚀"],
	["tada", "🎉"],
	["celebration", "🎉"],
	["moneybag", "💰"],
	["crown", "👑"],
	["muscle", "💪"],
	["beer", "🍺"],
	["pizza", "🍕"],
	["cookie", "🍪"],
	["balloon", "🎈"],
	["gift", "🎁"],
	["star", "⭐️"],
	["love", "😍"],
	["crying", "😢"],
	["angry", "😠"],
	["sleepy", "😴"],
	["nerd", "🤓"],
	["laughing", "😆"],
	["vomiting", "🤮"],
	["unicorn", "🦄"],
	["alien", "👽"],
	["ghost", "👻"],
	["skullcrossbones", "☠️"],
	["explosion", "💥"],
	["shush", "🤫"],
	["deaf", "🧏"],
	["mew", "🤫🧏"],
	["pray", "🙏"],
	["thinking", "🤔"],
	["sweat", "😅"],
	["wave", "👋"]
])

/**
 * @typedef {Map<string, string>} CustomEmojiMap
 */

/**
 * @constant {CustomEmojiMap} CUSTOM_EMOJIS
 */
export const CUSTOM_EMOJIS = new Map([
	["amogus", '<img src="custom_emojis/amogus.png" height="24">'],
	["biaoqing", '<img src="custom_emojis/biaoqing.png" height="24">'],
	["deepfriedh", '<img src="custom_emojis/deepfriedh.png" height="24">'],
	["edp445", '<img src="custom_emojis/edp445.png" height="24">'],
	["fan", '<img src="custom_emojis/fan.png" height="24">'],
	["heavy", '<img src="custom_emojis/heavy.png" height="24">'],
	["herkul", '<img src="custom_emojis/herkul.png" height="24">'],
	["kaanozdil", '<img src="custom_emojis/kaanozdil.png" height="24">'],
	["lowtiergod", '<img src="custom_emojis/lowtiergod.png" height="24">'],
	["manly", '<img src="custom_emojis/manly.png" height="24">'],
	["plsaddred", '<img src="custom_emojis/plsaddred.png" height="24">'],
	["rplace", '<img src="custom_emojis/rplace.png" height="24">'],
	["rplacediscord", '<img src="custom_emojis/rplacediscord.png" height="24">'],
	["sonic", '<img src="custom_emojis/sonic.png" height="24">'],
	["transparent", '<img src="custom_emojis/transparent.png" height="24">'],
	["trollface", '<img src="custom_emojis/trollface.png" height="24">']
])

/**
 * @typedef {Map<string, string>} CommandMap
 */

/**
 * @constant {CommandMap} COMMANDS
 */
export const COMMANDS = new Map([
	["help", "<kbd>Help information for live chat</kbd>"],
	["name", "<kbd>Change your username</kbd>"],
	["vip", "<kbd>Apply a VIP code</kbd>"],
	["lookup", "<kbd>Get the IDs of all players with the given name</kbd>"],
	["getid", "<kbd>View your own User Id, or provide a name to view a list of online player User Ids</kbd>"],
	["whoplaced", "<kbd>View details of who placed the current pixel being hovered</kbd>"]
])

/**
 * @typedef {Object} LangInfo
 * @property {string} name - Name of the language.
 * @property {string} flag - URL of the flag representing the language.
 * @property {boolean} [rtl] - Indicates if the language is read from right to left.
 */

/**
 * @constant {Map<string, LangInfo>} LANG_INFOS
 */
export const LANG_INFOS = new Map([
	["en", { name: "English", flag: "https://openmoji.org/data/color/svg/1F1EC-1F1E7.svg" }],
	["zh", { name: "中文", flag: "https://openmoji.org/data/color/svg/1F1E8-1F1F3.svg" }],
	["hi", { name: "हिन्दी", flag: "https://openmoji.org/data/color/svg/1F1EE-1F1F3.svg" }],
	["es", { name: "Español", flag: "https://openmoji.org/data/color/svg/1F1EA-1F1F8.svg" }],
	["fr", { name: "Français", flag: "https://openmoji.org/data/color/svg/1F1EB-1F1F7.svg" }],
	["ar", { name: "عربي", flag: "https://openmoji.org/data/color/svg/1F1F8-1F1E6.svg", rtl: true }],
	["ru", { name: "pусский", flag: "https://openmoji.org/data/color/svg/1F1F7-1F1FA.svg" }]
])

/**
 * @typedef {Record<string, string>} ThemeInfo
 * @property {string} id - Theme ID.
 * @property {string} css - CSS file path for the theme.
 * @property {string} cssVersion - Version of the CSS file.
 * @property {string} pixelselect - Path to the pixel selection SVG.
 */

/**
 * @constant {Map<string, ThemeInfo>} DEFAULT_THEMES
 */
export const DEFAULT_THEMES = new Map([
	["r/place 2022", { id: "r/place 2022", css: "rplace-2022.css", cssVersion: "14", pixelselect: "svg/pixel-select-2022.svg" }],
	["r/place 2023", { id: "r/place 2023", css: "rplace-2023.css", cssVersion: "14", pixelselect: "svg/pixel-select-2023.svg" }]
])

/**
 * @typedef {Object} AdInfo
 * @property {string} url - URL of the ad.
 * @property {Record<string, string>} banners - Map of banners for different languages.
 */

/**
 * @constant {AdInfo[]} ADS
 */
export const ADS = [
	{ url: "https://youtu.be/R3UBtMloTdI", banners: { en: "images/august21-ad.png" } },
	{ url: "https://t.me/rplacelive", banners: { en: "images/telegram-ad.png" } },
	{ url: "https://discord.gg/4XnZ9WGux2", banners: { en: "images/discord-ad.png" } },
	{ url: "https://arbitrum.life", banners: { en: "https://avatars.githubusercontent.com/u/131141781" } }
]

/**
 * @typedef {Object<string, number>} PunishmentState
 * @property {number} mute - Mute state.
 * @property {number} ban - Ban state.
 * @property {number} appealRejected - Appeal rejected state.
 */

/**
 * @constant {PunishmentState} PUNISHMENT_STATE
 */
export const PUNISHMENT_STATE = {
	mute: 0,
	ban: 1,
	appealRejected: 2
}

/**
 * @constant {number} MAX_CHANNEL_MESSAGES
 */
export const MAX_CHANNEL_MESSAGES = 100

// Canvas defaults
export const DEFAULT_PALETTE_USABLE_REGION = { start: 0, end: 32 };
export const DEFAULT_PALETTE = [0xff1a006d, 0xff3900be, 0xff0045ff, 0xff00a8ff, 0xff35d6ff, 0xffb8f8ff, 0xff68a300, 0xff78cc00, 0xff56ed7e, 0xff6f7500, 0xffaa9e00, 0xffc0cc00, 0xffa45024, 0xffea9036, 0xfff4e951, 0xffc13a49, 0xffff5c6a, 0xffffb394, 0xff9f1e81, 0xffc04ab4, 0xffffabe4, 0xff7f10de, 0xff8138ff, 0xffaa99ff, 0xff2f486d, 0xff26699c, 0xff70b4ff, 0xff000000, 0xff525251, 0xff908d89, 0xffd9d7d4, 0xffffffff];
export const DEFAULT_WIDTH = 2000;
export const DEFAULT_HEIGHT = 2000;
export const DEFAULT_COOLDOWN = 10e3;
