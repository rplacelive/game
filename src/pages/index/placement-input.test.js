import { expect, test } from "bun:test";

// Execute the real UI handler with controlled browser dependencies. This tests
// prediction timing without loading the full game or contacting any server.
async function makeInput() {
	const source = await Bun.file(new URL("./index.js", import.meta.url)).text();
	const handler = source.slice(source.indexOf("let placementPending = false;"),
		source.indexOf('placeOkButton.addEventListener("click", handlePixelPlace)'));
	let settle;
	let reject;
	let requests = 0;
	const drawn = [];
	const cooldowns = [];
	class InputEvent { constructor(trusted) { this.isTrusted = trusted; } }
	const noop = () => undefined;
	const dependencies = {
		Event: InputEvent, focused: true, connectStatus: "connected", cooldownEndDate: null,
		placeOkButton: {classList: {contains: () => true, remove: noop}},
		requirePasskeyForAction: () => true, x: 2, y: 3, WIDTH: 10, selectedColour: 7,
		placePixel: () => { requests++; return new Promise((resolve, rejectPromise) => {
			settle = resolve; reject = rejectPromise;
		}); },
		COOLDOWN: 100, setCooldown: value => cooldowns.push(value),
		drawPixel: (...args) => drawn.push(args), hideIndicators: noop,
		canvSelect: {style: {}, children: [{style: {}}]}, palette: {style: {}},
		runAudio: noop, AUDIOS: {}, mobile: true, unselectColour: noop,
		console: {warn: noop}
	};
	const run = new Function(...Object.keys(dependencies), handler + "\nreturn handlePixelPlace;")(...Object.values(dependencies));
	return {run: trusted => run(new InputEvent(trusted)), accept: value => settle(value),
		fail: () => reject(new Error("worker closed")), drawn, cooldowns, requests: () => requests};
}

test("UI predicts only an acknowledged placement and blocks overlapping clicks", async () => {
	const input = await makeInput();
	await input.run(false);
	expect(input.requests()).toBe(0);
	const placement = input.run(true);
	await input.run(true);
	expect(input.requests()).toBe(1);
	expect(input.drawn).toEqual([]);
	expect(input.cooldowns).toEqual([]);
	input.accept(true); await placement;
	expect(input.drawn).toEqual([[32, 7]]);
	expect(input.cooldowns).toHaveLength(1);
});

test("worker refusal and failure leave prediction untouched and permit retry", async () => {
	const input = await makeInput();
	let placement = input.run(true);
	input.accept(false); await placement;
	placement = input.run(true);
	input.fail(); await placement;
	expect(input.requests()).toBe(2);
	expect(input.drawn).toEqual([]);
	expect(input.cooldowns).toEqual([]);
	placement = input.run(true);
	input.accept(true); await placement;
	expect(input.drawn).toEqual([[32, 7]]);
});
