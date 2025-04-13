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
