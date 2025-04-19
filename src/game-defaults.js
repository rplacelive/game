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
 * Map of audio elements used in-game
 */
export const AUDIOS = {
	invalid: new Audio("/sounds/invalid.mp3"),
	highlight: new Audio("/sounds/highlight.mp3"),
	selectColour: new Audio("/sounds/select-colour.mp3"),
	closePalette: new Audio("/sounds/close-palette.mp3"),
	cooldownStart: new Audio("/sounds/cooldown-start.mp3"),
	cooldownEnd: new Audio("/sounds/cooldown-end.mp3"),
	bell: new Audio("/sounds/bell.mp3"),
	celebration: new Audio("/sounds/celebration.mp3")
}

/**
 * @typedef SampleInfo
 * @property {string} url
 * @property {number} baseNote
 */

/**
 * @constant {Map<string, SampleInfo>} DEFAULT_SAMPLE_INFOS
 * Map of sample names to default sample infos
 */
export const DEFAULT_SAMPLE_INFOS = new Map([
	["default", { url: "/sounds/select-colour.mp3", baseNote: 86 }], // D6
	["piano", { url: "/sounds/piano-c5.mp3", baseNote: 72 }], // C5
	["bell", { url: "/sounds/bell.mp3", baseNote: 86 }] // TODO: D6 (86) is probably inaccurate
]);
