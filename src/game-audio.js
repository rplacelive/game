import { DEFAULT_SAMPLE_INFOS } from "./game-defaults.js";
import { muted } from "./game-settings.js";

const audioCtx = new AudioContext();
const NATURAL_OFFSETS = [0, 2, 4, 5, 7, 9, 11]; // C, D, E, F, G, A, B
/**
 * @typedef Sample
 * @property {AudioBuffer} audioBuffer
 * @property {number} baseNote
 */
/**@type {Sample|null}*/export let selectColourSample = null;

/**
 * @param {HTMLAudioElement} audio
 */
export async function runAudio(audio) {
	if (muted) {
		return;
	}
	audio.currentTime = 0;
	await audio.play().catch((e) => {
		console.error(e)
	});
}

/**
 * 
 * @param {string} url 
 * @returns {Promise<AudioBuffer|null>}
 */
export async function loadSample(url) {
	try {
		const res = await fetch(url);
		if (!res.ok) {
			throw new Error(`Failed to fetch audio ${res.status} ${res.statusText}`)
		}

		const buffer =  await res.arrayBuffer();
		const audioData = await audioCtx.decodeAudioData(buffer);
		return audioData;
	}
	catch(e) {
		console.log("Failed to load audio sample:", e);
	}

	return null;
}

/**
 * @param {AudioBuffer} sample 
 * @param {number} sampleNote 
 * @param {number} playNote 
 */
export function playSample(sample, sampleNote=1, playNote=1) {
	if (muted) {
		return;
	}

	const source = audioCtx.createBufferSource();
	source.buffer = sample;
	source.playbackRate.value = 2 ** ((playNote - sampleNote) / 12);
	source.connect(audioCtx.destination);
	source.start(0);
}

/**
 * @param {number} octave 
 * @param {number} count 
 * @returns {number[]}
 */
export function getNaturalNotes(octave, count) {
	const notes = [];
	let i = 0;
	while (notes.length < count) {
		const offset = NATURAL_OFFSETS[i % NATURAL_OFFSETS.length];
		notes.push(octave * 12 + offset);
		i++;
		if (i % NATURAL_OFFSETS.length === 0) {
			octave++;
		}
	}
	return notes;
}

/**@type {Sample|null}*/let paletteSelectSample = null;
/**
 * @param {string} name 
 * @returns {Promise<Sample|null>}
 */
export async function getDefaultSample(name) {
	const defaultInfo = DEFAULT_SAMPLE_INFOS.get(name);
	if (!defaultInfo) {
		return null;
	}
	const audioBuffer = await loadSample(defaultInfo.url);
	if (!audioBuffer) {
		return null;
	}
	const sample = /**@type {Sample}*/{
		audioBuffer: audioBuffer,
		baseNote: defaultInfo.baseNote
	}
	return sample
}

/**
 * @param {Sample} sample
 */
export function setSelectColourSample(sample) {
	selectColourSample = sample;
}