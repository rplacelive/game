// @ts-nocheck
import { describe, expect, spyOn, test } from "bun:test";
import { createStrictIpcEndpoint } from "shared-ipc";
import { createGameIpc, selectGameIpcMode } from "./game-ipc.js";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function createTestWorkerEndpoint(data, port, options) {
	const pageSequenceStart = 41;
	const workerSequenceStart = 73;
	port.postMessage([1, pageSequenceStart, workerSequenceStart]);
	return createStrictIpcEndpoint(port, {
		...options,
		channelId: data[1],
		receiveSequenceStart: pageSequenceStart,
		sendSequenceStart: workerSequenceStart
	});
}

describe("game IPC mode selection", () => {
	test("requires strict mode for every spelling of the official origin", () => {
		expect(selectGameIpcMode("wss://server.rplace.live", "wss://server.rplace.live")).toBe("strict");
		expect(selectGameIpcMode("wss://SERVER.RPLACE.LIVE/other", "wss://server.rplace.live")).toBe("strict");
	});

	test("uses legacy mode only for an explicitly different custom origin", () => {
		expect(selectGameIpcMode("ws://localhost:3000", "wss://server.rplace.live")).toBe("legacy");
		expect(selectGameIpcMode("wss://example.invalid", "wss://server.rplace.live")).toBe("legacy");
	});
});

describe("page game IPC adapter", () => {
	test("binds a dedicated port and sends only the exact activity tuple", async () => {
		let workerEndpoint;
		let received;
		let stopCount = 0;
		const worker = {
			postMessage(data, ports) {
				expect(data[0]).toBe(1);
				expect(data[1]).toMatch(/^[0-9a-f]{32}$/);
				expect(ports).toHaveLength(1);
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([[0, {
						kind: "message",
						validate: value => Array.isArray(value) && value.length === 5,
						handler: value => { received = value; }
					}], [2, {
						kind: "message",
						validate: () => true,
						handler: () => { workerEndpoint.send(1); }
					}], [1, {
						kind: "message",
						validate: value => value === undefined,
						handler: () => { stopCount++; }
					}]]),
					outgoing: new Map([[0, {
						kind: "message",
						validate: value => value === undefined
					}], [1, {
						kind: "message",
						validate: value => value === undefined
					}]])
				});
				workerEndpoint.send(0);
			},
			terminate() {
				throw new Error("strict bootstrap unexpectedly failed");
			}
		};

		const ipc = await createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			100
		);
		ipc.connect("device", null);
		await tick();
		ipc.reportAutomatedActivity([17, 1920, 1900, 1080, 1000]);
		await tick();

		expect(received).toEqual([17, 1920, 1900, 1080, 1000]);
		expect(() => ipc.reportAutomatedActivity([17, 1, 2, 3])).toThrow();
		expect(Reflect.ownKeys(ipc).sort()).toEqual([
			"chatReact",
			"chatReport",
			"connect",
			"dispose",
			"fetchLinkKey",
			"putPixel",
			"reportAutomatedActivity",
			"reportCanvasPixel",
			"requestChatHistory",
			"requestPixelPlacers",
			"sendCaptchaResult",
			"sendChallengeResult",
			"sendHCaptchaResult",
			"sendLiveChat",
			"sendModAction",
			"sendPlaceChat",
			"sendTurnstileResult",
			"setName",
			"spectateUser",
			"stop",
			"unspectateUser"
		]);
		ipc.dispose();
		ipc.stop();
		await tick();
		expect(stopCount).toBe(0);
		workerEndpoint.dispose();
	});

	test("sends one exact strict connection tuple without using legacy IPC", async () => {
		let workerEndpoint;
		const received = [];
		const bootstrapMessages = [];
		const worker = {
			postMessage(data, ports) {
				bootstrapMessages.push(data);
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([[2, {
						kind: "message",
						validate: () => true,
						handler: value => { received.push(value); }
					}]]),
					outgoing: new Map([[0, {
						kind: "message",
						validate: value => value === undefined
					}]])
				});
				workerEndpoint.send(0);
			},
			terminate() {
				throw new Error("strict bootstrap unexpectedly failed");
			}
		};

		const ipc = await createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			100
		);
		expect(() => ipc.connect("", null)).toThrow();
		ipc.connect("0123456789abcdef", "!vip");
		expect(() => ipc.connect("another-device", null)).toThrow();
		await tick();

		expect(received).toEqual([[
			"0123456789abcdef",
			"wss://server.rplace.live",
			"!vip"
		]]);
		expect(bootstrapMessages).toHaveLength(1);
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("privately validates strict open and close lifecycle notifications", async () => {
		let workerEndpoint;
		const lifecycle = [];
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([[2, {
						kind: "message",
						validate: () => true,
						handler: () => {
							workerEndpoint.send(1);
							workerEndpoint.send(2, [1000, "complete"]);
						}
					}]]),
					outgoing: new Map([[0, {
						kind: "message",
						validate: value => value === undefined
					}], [1, {
						kind: "message",
						validate: value => value === undefined
					}], [2, {
						kind: "message",
						validate: () => true
					}]])
				});
				workerEndpoint.send(0);
			},
			terminate() {
				throw new Error("strict bootstrap unexpectedly failed");
			}
		};

		const ipc = await createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			100,
			[
				() => { lifecycle.push("open"); },
				value => { lifecycle.push(value); }
			]
		);
		ipc.connect("device", null);
		await tick();

		expect(lifecycle).toEqual(["open", [1000, "complete"]]);
		expect(() => ipc.reportAutomatedActivity([17, 1, 2, 3, 4])).toThrow();
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("privately validates strict placement cooldown and rejection feedback", async () => {
		let workerEndpoint;
		const feedback = [];
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([[2, {
						kind: "message",
						validate: () => true,
						handler: () => undefined
					}]]),
					outgoing: new Map([
						[0, { kind: "message", validate: value => value === undefined }],
						[1, { kind: "message", validate: value => value === undefined }],
						[6, { kind: "message", validate: () => true }],
						[7, { kind: "message", validate: () => true }],
						[8, { kind: "message", validate: () => true }]
					])
				});
				workerEndpoint.send(0);
			},
			terminate() {
				throw new Error("strict placement feedback unexpectedly terminated the worker");
			}
		};
		const ipc = await createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			100,
			[
				() => feedback.push("open"),
				() => undefined,
				() => undefined,
				() => undefined,
				() => undefined,
				value => feedback.push(["initial", value]),
				value => feedback.push(["cooldown", value]),
				value => feedback.push(["rejected", value])
			]
		);

		ipc.connect("device", null);
		await tick();
		workerEndpoint.send(1);
		workerEndpoint.send(6, [1_725_000_000_000, 1_400]);
		workerEndpoint.send(7, [1_725_000_001_400]);
		workerEndpoint.send(8, [1_725_000_001_400, 42, 7]);
		await tick();

		const expectedFeedback = [
			"open",
			["initial", [1_725_000_000_000, 1_400]],
			["cooldown", [1_725_000_001_400]],
			["rejected", [1_725_000_001_400, 42, 7]]
		];
		expect(feedback).toEqual(expectedFeedback);
		workerEndpoint.send(8, [1_725_000_001_400, 42, 7, 8]);
		await tick();
		expect(feedback).toEqual(expectedFeedback);
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("privately validates strict placement bootstrap and gate state", async () => {
		let workerEndpoint;
		const state = [];
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([[2, {
						kind: "message",
						validate: () => true,
						handler: () => undefined
					}]]),
					outgoing: new Map([
						[0, { kind: "message", validate: value => value === undefined }],
						[1, { kind: "message", validate: value => value === undefined }],
						...Array.from({ length: 5 }, (_, index) => [
							index + 9,
							{ kind: "message", validate: () => true }
						])
					])
				});
				workerEndpoint.send(0);
			},
			terminate() {
				throw new Error("strict placement state unexpectedly terminated the worker");
			}
		};
		const ipc = await createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			100,
			[
				() => state.push("open"),
				() => undefined,
				() => undefined,
				() => undefined,
				() => undefined,
				() => undefined,
				() => undefined,
				() => undefined,
				value => state.push(["palette", value]),
				value => state.push(["changes", value]),
				value => state.push(["lock", value]),
				() => state.push("passkey-required"),
				() => state.push("passkey-success")
			]
		);

		ipc.connect("device", null);
		await tick();
		workerEndpoint.send(1);
		const changes = new Uint8Array([7, 8]).buffer;
		workerEndpoint.send(9, [[0x0102_0304], 0, 1]);
		workerEndpoint.send(10, [3, 2, changes]);
		workerEndpoint.send(11, [true, "maintenance"]);
		workerEndpoint.send(12);
		workerEndpoint.send(13);
		await tick();

		const expectedState = [
			"open",
			["palette", [[0x0102_0304], 0, 1]],
			["changes", [3, 2, changes]],
			["lock", [true, "maintenance"]],
			"passkey-required",
			"passkey-success"
		];
		expect(state).toEqual(expectedState);
		workerEndpoint.send(9, [[0x0102_0304], 0, 2]);
		await tick();
		expect(state).toEqual(expectedState);
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("rejects malformed strict close notification fields", async () => {
		let workerEndpoint;
		let closes = 0;
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map(),
					outgoing: new Map([[0, {
						kind: "message",
						validate: value => value === undefined
					}], [2, {
						kind: "message",
						validate: () => true
					}]])
				});
				workerEndpoint.send(0);
				workerEndpoint.send(2, [65_536, "invalid"]);
			},
			terminate() {
				throw new Error("strict bootstrap unexpectedly failed");
			}
		};

		const ipc = await createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			100,
			[() => undefined, () => { closes++; }]
		);
		await tick();

		expect(closes).toBe(0);
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("sends strict stop once, disposes locally and never emits the legacy route", async () => {
		let workerEndpoint;
		let stopCount = 0;
		const bootstrapMessages = [];
		const worker = {
			postMessage(data, ports) {
				bootstrapMessages.push(data);
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([[1, {
						kind: "message",
						validate: value => value === undefined,
						handler: () => { stopCount++; }
					}]]),
					outgoing: new Map([[0, {
						kind: "message",
						validate: value => value === undefined
					}]])
				});
				workerEndpoint.send(0);
			},
			terminate() {
				throw new Error("strict bootstrap unexpectedly failed");
			}
		};

		const ipc = await createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			100
		);
		ipc.stop();
		ipc.stop();
		ipc.dispose();
		await tick();

		expect(stopCount).toBe(1);
		expect(bootstrapMessages).toHaveLength(1);
		expect(bootstrapMessages[0][0]).toBe(1);
		expect(() => ipc.reportAutomatedActivity([17, 1, 2, 3, 4])).toThrow();
		workerEndpoint.dispose();
	});

	test("fails closed when the official worker does not acknowledge strict bootstrap", async () => {
		let terminated = false;
		const worker = {
			postMessage() {},
			terminate() { terminated = true; }
		};

		await expect(createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			10
		)).rejects.toThrow("Game IPC bootstrap failed");
		expect(terminated).toBe(true);
	});

	test("fails closed on a malformed worker sequence bootstrap", async () => {
		let terminated = false;
		const worker = {
			postMessage(data, ports) {
				ports[0].postMessage([1, 0]);
			},
			terminate() { terminated = true; }
		};

		await expect(createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			100
		)).rejects.toThrow("Game IPC bootstrap failed");
		expect(terminated).toBe(true);
	});

	test("terminates an official connection on worker sequence interference", async () => {
		let workerEndpoint;
		let workerPort;
		let channelId;
		let terminated = 0;
		const disconnects = [];
		const worker = {
			postMessage(data, ports) {
				channelId = data[1];
				workerPort = ports[0];
				workerEndpoint = createTestWorkerEndpoint(data, workerPort, {
					incoming: new Map([[2, {
						kind: "message",
						validate: () => true,
						handler: () => undefined
					}]]),
					outgoing: new Map([[0, {
						kind: "message",
						validate: value => value === undefined
					}]])
				});
				workerEndpoint.send(0);
			},
			terminate() { terminated++; }
		};
		const ipc = await createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			100,
			[
				() => undefined,
				value => { disconnects.push(value); },
				() => undefined,
				() => undefined,
				() => undefined
			]
		);

		ipc.connect("device", null);
		await tick();
		const warning = spyOn(console, "warn").mockImplementation(() => {
			throw new Error("patched diagnostic");
		});
		workerPort.postMessage({
			type: "message",
			channel: channelId,
			sequence: 75,
			call: 0,
			data: undefined
		});
		await tick();

		expect(terminated).toBe(1);
		expect(disconnects).toEqual([[1002, "Game IPC integrity failure"]]);
		expect(warning).toHaveBeenCalledWith("Game IPC sequence integrity failure");
		warning.mockRestore();
		expect(() => ipc.putPixel(0, 0)).toThrow("Game IPC endpoint is closed");
		workerEndpoint.dispose();
	});

	test("keeps legacy connect, activity and stop only in explicit custom-server mode", async () => {
		const messages = [];
		const worker = {
			postMessage(value) { messages.push(value); }
		};
		const ipc = await createGameIpc(worker, "ws://localhost:3000", "wss://server.rplace.live");

		ipc.connect("custom-device", null);
		ipc.reportAutomatedActivity([1, 2, 3, 4, 5]);
		ipc.sendCaptchaResult(7, "answer");
		ipc.putPixel(9, 3);
		expect(() => ipc.reportCanvasPixel(9, "botting")).toThrow(
			"Canvas pixel reports require the official server"
		);
		ipc.stop();
		ipc.stop();

		expect(messages[0]).toMatchObject({
			call: "connect",
			data: {
				device: "custom-device",
				server: "ws://localhost:3000",
				vip: null
			}
		});
		expect(messages[1].call).toBe("informAutomatedActivity");
		expect(messages[1].data).toEqual([1, 2, 3, 4, 5]);
		expect(messages[2]).toMatchObject({
			call: "sendCaptchaResult",
			data: { captchaId: 7, result: "answer" }
		});
		expect(messages[3]).toMatchObject({
			call: "putPixel",
			data: { position: 9, colour: 3 }
		});
		expect(messages[4]).toMatchObject({ call: "stop", data: undefined });
		expect(messages).toHaveLength(5);
		expect(() => ipc.reportAutomatedActivity([1, 2, 3, 4, 5])).toThrow();
	});

	test("validates strict default CAPTCHA challenges and permits one correlated answer", async () => {
		let workerEndpoint;
		const answers = [];
		const events = [];
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([
						[2, {
							kind: "message",
							validate: () => true,
							handler: () => { workerEndpoint.send(1); }
						}],
						[3, {
							kind: "message",
							validate: () => true,
							handler: value => { answers.push(value); }
						}]
					]),
					outgoing: new Map([
						[0, { kind: "message", validate: value => value === undefined }],
						[1, { kind: "message", validate: value => value === undefined }],
						[3, { kind: "message", validate: () => true }],
						[4, { kind: "message", validate: () => true }],
						[5, { kind: "message", validate: () => true }]
					])
				});
				workerEndpoint.send(0);
			},
			terminate() {
				throw new Error("strict bootstrap unexpectedly failed");
			}
		};
		const ipc = await createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			100,
			[
				() => { events.push("open"); },
				() => undefined,
				value => { events.push(["text", value]); },
				value => { events.push(["emoji", value]); },
				() => { events.push("success"); }
			]
		);
		ipc.connect("device", null);
		await tick();
		const image = new Uint8Array([1, 2]);
		workerEndpoint.send(3, [7, ["one", "two"], image]);
		workerEndpoint.send(4, [8, ["😀"], image]);
		await tick();

		expect(() => ipc.sendCaptchaResult(9, "unknown")).toThrow();
		expect(() => ipc.sendCaptchaResult(7, "")).toThrow();
		ipc.sendCaptchaResult(7, "one");
		expect(() => ipc.sendCaptchaResult(8, "😀")).toThrow();
		await tick();
		workerEndpoint.send(5);
		await tick();
		ipc.sendCaptchaResult(8, "😀");
		expect(() => ipc.sendCaptchaResult(8, "😀")).toThrow();
		await tick();

		expect(answers).toEqual([[7, "one"], [8, "😀"]]);
		expect(events).toEqual([
			"open",
			["text", [7, ["one", "two"], image]],
			["emoji", [8, ["😀"], image]],
			"success"
		]);
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("rejects malformed strict default CAPTCHA events before page handlers", async () => {
		let workerEndpoint;
		let captchaEvents = 0;
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([[2, {
						kind: "message",
						validate: () => true,
						handler: () => { workerEndpoint.send(1); }
					}]]),
					outgoing: new Map([
						[0, { kind: "message", validate: value => value === undefined }],
						[1, { kind: "message", validate: value => value === undefined }],
						[3, { kind: "message", validate: () => true }]
					])
				});
				workerEndpoint.send(0);
			},
			terminate() {
				throw new Error("strict bootstrap unexpectedly failed");
			}
		};
		const ipc = await createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			100,
			[
				() => undefined,
				() => undefined,
				() => { captchaEvents++; },
				() => { captchaEvents++; },
				() => { captchaEvents++; }
			]
		);
		ipc.connect("device", null);
		await tick();
		workerEndpoint.send(3, [7, ["answer"], new ArrayBuffer(1)]);
		await tick();

		expect(captchaEvents).toBe(0);
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("sends only exact open-state strict pixel placements", async () => {
		let workerEndpoint;
		const placements = [];
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([
						[2, {
							kind: "message",
							validate: () => true,
							handler: () => { workerEndpoint.send(1); }
						}],
						[20, {
							kind: "request",
							validate: () => true,
							validateResult: value => typeof value === "boolean",
							handler: value => { placements.push(value); return true; }
						}]
					]),
					outgoing: new Map([
						[0, { kind: "message", validate: value => value === undefined }],
						[1, { kind: "message", validate: value => value === undefined }]
					])
				});
				workerEndpoint.send(0);
			},
			terminate() {
				throw new Error("strict bootstrap unexpectedly failed");
			}
		};
		const ipc = await createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			100
		);

		expect(() => ipc.putPixel(0, 0)).toThrow();
		ipc.connect("device", null);
		await tick();
		expect(() => ipc.putPixel(-1, 0)).toThrow();
		expect(() => ipc.putPixel(0, 256)).toThrow();
		expect(() => ipc.putPixel(0.5, 0)).toThrow();
		expect(await ipc.putPixel(0xFFFF_FFFF, 255)).toBe(true);
		await tick();

		expect(placements).toEqual([[0xFFFF_FFFF, 255]]);
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("strictly correlates spectating requests and placement-gating confirmations", async () => {
		let workerEndpoint;
		const requests = [];
		const notices = [];
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([
						[2, {
							kind: "message",
							validate: () => true,
							handler: () => { workerEndpoint.send(1); }
						}],
						[5, {
							kind: "message",
							validate: () => true,
							handler: value => { requests.push(["spectate", value]); }
						}],
						[6, {
							kind: "message",
							validate: () => true,
							handler: () => { requests.push(["unspectate"]); }
						}]
					]),
					outgoing: new Map([
						[0, { kind: "message", validate: value => value === undefined }],
						[1, { kind: "message", validate: value => value === undefined }],
						[14, { kind: "message", validate: () => true }],
						[15, { kind: "message", validate: () => true }]
					])
				});
				workerEndpoint.send(0);
			},
			terminate() {
				throw new Error("strict bootstrap unexpectedly failed");
			}
		};
		const handlers = Array.from({ length: 15 }, () => () => undefined);
		handlers[13] = value => { notices.push(["spectating", value]); };
		handlers[14] = value => { notices.push(["unspectating", value]); };
		const ipc = await createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			100,
			handlers
		);

		expect(() => ipc.spectateUser(7)).toThrow();
		expect(() => ipc.unspectateUser()).toThrow();
		ipc.connect("device", null);
		await tick();
		expect(() => ipc.spectateUser(-1)).toThrow();
		ipc.spectateUser(0xFFFF_FFFF);
		await tick();
		expect(requests).toEqual([["spectate", 0xFFFF_FFFF]]);
		expect(() => ipc.unspectateUser()).toThrow();

		workerEndpoint.send(14, 0xFFFF_FFFF);
		await tick();
		ipc.unspectateUser();
		await tick();
		expect(requests).toEqual([
			["spectate", 0xFFFF_FFFF],
			["unspectate"]
		]);
		workerEndpoint.send(15, [0xFFFF_FFFF, "target closed"]);
		await tick();
		expect(notices).toEqual([
			["spectating", 0xFFFF_FFFF],
			["unspectating", [0xFFFF_FFFF, "target closed"]]
		]);
		expect(() => ipc.unspectateUser()).toThrow();
		workerEndpoint.send(15, [0xFFFF_FFFF, "stale"]);
		await tick();
		expect(notices).toHaveLength(2);
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("privately validates strict pixel broadcasts before page mutation", async () => {
		let workerEndpoint;
		const received = [];
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([[2, {
						kind: "message",
						validate: () => true,
						handler: () => { workerEndpoint.send(1); }
					}]]),
					outgoing: new Map([
						[0, { kind: "message", validate: value => value === undefined }],
						[1, { kind: "message", validate: value => value === undefined }],
						[16, { kind: "message", validate: () => true }]
					])
				});
				workerEndpoint.send(0);
			},
			terminate() {
				throw new Error("strict pixel broadcast unexpectedly terminated the worker");
			}
		};
		const handlers = Array.from({ length: 16 }, () => () => undefined);
		handlers[15] = value => { received.push(value); };
		const ipc = await createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			100,
			handlers
		);
		ipc.connect("device", null);
		await tick();
		workerEndpoint.send(16, [[0, 0], [0xFFFF_FFFF, 255, 7]]);
		await tick();
		expect(received).toEqual([[[0, 0], [0xFFFF_FFFF, 255, 7]]]);
		workerEndpoint.send(16, [[1, 2, -1]]);
		await tick();
		expect(received).toHaveLength(1);
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("privately validates ordinary strict identity state", async () => {
		let workerEndpoint;
		const received = [];
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([[2, {
						kind: "message",
						validate: () => true,
						handler: () => { workerEndpoint.send(1); }
					}]]),
					outgoing: new Map([
						[0, { kind: "message", validate: value => value === undefined }],
						[1, { kind: "message", validate: value => value === undefined }],
						...([17, 18, 19, 20].map(command => [
							command,
							{ kind: "message", validate: () => true }
						]))
					])
				});
				workerEndpoint.send(0);
			},
			terminate() {
				throw new Error("strict identity state unexpectedly terminated the worker");
			}
		};
		const handlers = Array.from({ length: 20 }, () => () => undefined);
		for (let index = 16; index < 20; index++) {
			handlers[index] = value => { received.push([index + 1, value]); };
		}
		const ipc = await createGameIpc(
			worker,
			"wss://server.rplace.live",
			"wss://server.rplace.live",
			100,
			handlers
		);
		ipc.connect("device", null);
		await tick();
		workerEndpoint.send(17, 65_535);
		workerEndpoint.send(18, 7);
		workerEndpoint.send(19, [[7, "name"]]);
		workerEndpoint.send(20, "name");
		await tick();
		expect(received).toEqual([
			[17, 65_535],
			[18, 7],
			[19, [[7, "name"]]],
			[20, "name"]
		]);
		workerEndpoint.send(18, 8);
		await tick();
		expect(received).toHaveLength(4);
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("correlates strict spectator joins and leaves", async () => {
		let workerEndpoint;
		const received = [];
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([[2, {
						kind: "message",
						validate: () => true,
						handler: () => { workerEndpoint.send(1); }
					}]]),
					outgoing: new Map([
						[0, { kind: "message", validate: value => value === undefined }],
						[1, { kind: "message", validate: value => value === undefined }],
						[21, { kind: "message", validate: () => true }],
						[22, { kind: "message", validate: () => true }]
					])
				});
				workerEndpoint.send(0);
			},
			terminate() {
				throw new Error("strict spectator state unexpectedly terminated the worker");
			}
		};
		const handlers = Array.from({ length: 22 }, () => () => undefined);
		handlers[20] = value => { received.push(["join", value]); };
		handlers[21] = value => { received.push(["left", value]); };
		const ipc = await createGameIpc(
			worker, "wss://server.rplace.live", "wss://server.rplace.live", 100, handlers
		);
		ipc.connect("device", null);
		await tick();
		workerEndpoint.send(21, 7);
		await tick();
		workerEndpoint.send(22, 7);
		await tick();
		expect(received).toEqual([["join", 7], ["left", 7]]);
		workerEndpoint.send(22, 7);
		await tick();
		expect(received).toHaveLength(2);
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("sends bounded strict chat-name updates only while open", async () => {
		let workerEndpoint;
		const names = [];
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([
						[2, {
							kind: "message",
							validate: () => true,
							handler: () => { workerEndpoint.send(1); }
						}],
						[7, {
							kind: "message",
							validate: () => true,
							handler: value => { names.push(value); }
						}]
					]),
					outgoing: new Map([
						[0, { kind: "message", validate: value => value === undefined }],
						[1, { kind: "message", validate: value => value === undefined }]
					])
				});
				workerEndpoint.send(0);
			},
			terminate() {
				throw new Error("strict name update unexpectedly terminated the worker");
			}
		};
		const ipc = await createGameIpc(
			worker, "wss://server.rplace.live", "wss://server.rplace.live", 100
		);
		expect(() => ipc.setName("name")).toThrow();
		ipc.connect("device", null);
		await tick();
		ipc.setName("");
		ipc.setName("1234567890123456");
		expect(() => ipc.setName("12345678901234567")).toThrow();
		await tick();
		expect(names).toEqual(["", "1234567890123456"]);
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("sends and receives validated strict chat reactions", async () => {
		let workerEndpoint;
		const sent = [];
		const received = [];
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([
						[2, { kind: "message", validate: () => true, handler: () => workerEndpoint.send(1) }],
						[8, { kind: "message", validate: () => true, handler: value => sent.push(value) }],
						[9, { kind: "message", validate: () => true, handler: value => sent.push(["report", value]) }]
					]),
					outgoing: new Map([
						[0, { kind: "message", validate: value => value === undefined }],
						[1, { kind: "message", validate: value => value === undefined }],
						[23, { kind: "message", validate: () => true }],
						[24, { kind: "message", validate: () => true }]
					])
				});
				workerEndpoint.send(0);
			},
			terminate() { throw new Error("strict reaction unexpectedly terminated"); }
		};
		const handlers = Array.from({ length: 24 }, () => () => undefined);
		handlers[22] = value => received.push(["delete", value]);
		handlers[23] = value => received.push(["reaction", value]);
		const ipc = await createGameIpc(
			worker, "wss://server.rplace.live", "wss://server.rplace.live", 100, handlers
		);
		ipc.connect("device", null);
		await tick();
		ipc.chatReact(7, "👍");
		ipc.chatReport(7, "spam");
		workerEndpoint.send(23, 9);
		workerEndpoint.send(24, [7, 8, "👍"]);
		await tick();
		expect(sent).toEqual([[7, "👍"], ["report", [7, "spam"]]]);
		expect(received).toEqual([["delete", 9], ["reaction", [7, 8, "👍"]]]);
		expect(() => ipc.chatReact(-1, "")).toThrow();
		expect(() => ipc.chatReport(7, "")).toThrow();
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("sends only bounded strict canvas pixel reports while open", async () => {
		let workerEndpoint;
		const reports = [];
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([
						[2, { kind: "message", validate: () => true, handler: () => workerEndpoint.send(1) }],
						[19, { kind: "message", validate: () => true, handler: value => reports.push(value) }]
					]),
					outgoing: new Map([
						[0, { kind: "message", validate: value => value === undefined }],
						[1, { kind: "message", validate: value => value === undefined }]
					])
				});
				workerEndpoint.send(0);
			},
			terminate() { throw new Error("strict canvas report unexpectedly terminated"); }
		};
		const ipc = await createGameIpc(
			worker, "wss://server.rplace.live", "wss://server.rplace.live", 100
		);
		expect(() => ipc.reportCanvasPixel(1, "botting")).toThrow();
		ipc.connect("device", null);
		await tick();
		ipc.reportCanvasPixel(0xFFFF_FFFF, "botting");
		await tick();
		expect(reports).toEqual([[0xFFFF_FFFF, "botting"]]);
		expect(() => ipc.reportCanvasPixel(-1, "botting")).toThrow();
		expect(() => ipc.reportCanvasPixel(1, " ")).toThrow();
		expect(() => ipc.reportCanvasPixel(1, "😀".repeat(71))).toThrow();
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("sends and receives closed strict live and place chat shapes", async () => {
		let workerEndpoint;
		const sent = [];
		const received = [];
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([
						[2, { kind: "message", validate: () => true, handler: () => workerEndpoint.send(1) }],
						[10, { kind: "message", validate: () => true, handler: value => sent.push(["live", value]) }],
						[11, { kind: "message", validate: () => true, handler: value => sent.push(["place", value]) }]
					]),
					outgoing: new Map([
						[0, { kind: "message", validate: value => value === undefined }],
						[1, { kind: "message", validate: value => value === undefined }],
						[25, { kind: "message", validate: () => true }],
						[26, { kind: "message", validate: () => true }]
					])
				});
				workerEndpoint.send(0);
			},
			terminate() { throw new Error("strict chat unexpectedly terminated"); }
		};
		const handlers = Array.from({ length: 26 }, () => () => undefined);
		handlers[24] = value => received.push(["live", value]);
		handlers[25] = value => received.push(["place", value]);
		const ipc = await createGameIpc(
			worker, "wss://server.rplace.live", "wss://server.rplace.live", 100, handlers
		);
		ipc.connect("device", null);
		await tick();
		ipc.sendLiveChat("hello", "global", 7);
		ipc.sendPlaceChat("hi", 9);
		workerEndpoint.send(25, [1, "hello", 2, "name", 3, "global", 7]);
		workerEndpoint.send(26, [9, "hi", 2, "name"]);
		await tick();
		expect(sent).toEqual([
			["live", ["hello", "global", 7]],
			["place", ["hi", 9]]
		]);
		expect(received).toHaveLength(2);
		expect(() => ipc.sendLiveChat("", "global", null)).toThrow();
		expect(() => ipc.sendPlaceChat("", 9)).toThrow();
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("privately validates strict punishment notifications", async () => {
		let workerEndpoint;
		const received = [];
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([
						[2, { kind: "message", validate: () => true, handler: () => workerEndpoint.send(1) }]
					]),
					outgoing: new Map([
						[0, { kind: "message", validate: value => value === undefined }],
						[1, { kind: "message", validate: value => value === undefined }],
						[27, { kind: "message", validate: () => true }]
					])
				});
				workerEndpoint.send(0);
			},
			terminate() { throw new Error("strict punishment unexpectedly terminated"); }
		};
		const handlers = Array.from({ length: 27 }, () => () => undefined);
		handlers[26] = value => received.push(value);
		const ipc = await createGameIpc(
			worker, "wss://server.rplace.live", "wss://server.rplace.live", 100, handlers
		);
		ipc.connect("device", null);
		await tick();
		workerEndpoint.send(27, [3, 1000, 2000, "reason", "appeal"]);
		workerEndpoint.send(27, [4, 1000, 2000, "reason", "appeal"]);
		await tick();
		expect(received).toEqual([[3, 1000, 2000, "reason", "appeal"]]);
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("sends and receives bounded strict chat history", async () => {
		let workerEndpoint;
		const sent = [];
		const received = [];
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([
						[2, { kind: "message", validate: () => true, handler: () => workerEndpoint.send(1) }],
						[12, { kind: "message", validate: () => true, handler: value => sent.push(value) }]
					]),
					outgoing: new Map([
						[0, { kind: "message", validate: value => value === undefined }],
						[1, { kind: "message", validate: value => value === undefined }],
						[28, { kind: "message", validate: () => true }]
					])
				});
				workerEndpoint.send(0);
			},
			terminate() { throw new Error("strict history unexpectedly terminated"); }
		};
		const handlers = Array.from({ length: 28 }, () => () => undefined);
		handlers[27] = value => received.push(value);
		const ipc = await createGameIpc(
			worker, "wss://server.rplace.live", "wss://server.rplace.live", 100, handlers
		);
		ipc.connect("device", null);
		await tick();
		ipc.requestChatHistory("global", 7, 32);
		expect(() => ipc.requestChatHistory("global", 7, 128)).toThrow();
		workerEndpoint.send(28, [7, 1, true, "global", [
			[8, "hi", 9, 10, [["👍", [9]]], "global", null]
		]]);
		workerEndpoint.send(28, [7, 1, true, "global", []]);
		await tick();
		expect(sent).toEqual([["global", 7, 32]]);
		expect(received).toHaveLength(1);
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("correlates one strict padlock challenge result", async () => {
		let workerEndpoint;
		const sent = [];
		const challenges = [];
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([
						[2, { kind: "message", validate: () => true, handler: () => workerEndpoint.send(1) }],
						[13, { kind: "message", validate: () => true, handler: value => sent.push(value) }]
					]),
					outgoing: new Map([
						[0, { kind: "message", validate: value => value === undefined }],
						[1, { kind: "message", validate: value => value === undefined }],
						[29, { kind: "message", validate: () => true }]
					])
				});
				workerEndpoint.send(0);
			},
			terminate() { throw new Error("strict challenge unexpectedly terminated"); }
		};
		const handlers = Array.from({ length: 29 }, () => () => undefined);
		handlers[28] = value => challenges.push(value);
		const ipc = await createGameIpc(
			worker, "wss://server.rplace.live", "wss://server.rplace.live", 100, handlers
		);
		ipc.connect("device", null);
		await tick();
		expect(() => ipc.sendChallengeResult(1n)).toThrow();
		workerEndpoint.send(29, ["return 1n", new Uint8Array([1])]);
		workerEndpoint.send(29, ["return 2n", new Uint8Array([2])]);
		await tick();
		ipc.sendChallengeResult(1n);
		expect(() => ipc.sendChallengeResult(2n)).toThrow();
		await tick();
		expect(challenges).toHaveLength(1);
		expect(sent).toEqual([1n]);
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("correlates strict Turnstile and hCaptcha independently", async () => {
		let workerEndpoint;
		const results = [];
		const events = [];
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([
						[2, { kind: "message", validate: () => true, handler: () => workerEndpoint.send(1) }],
						[14, { kind: "message", validate: () => true, handler: value => results.push(["turnstile", value]) }],
						[15, { kind: "message", validate: () => true, handler: value => results.push(["hcaptcha", value]) }]
					]),
					outgoing: new Map([
						[0, { kind: "message", validate: value => value === undefined }],
						[1, { kind: "message", validate: value => value === undefined }],
						[30, { kind: "message", validate: () => true }],
						[31, { kind: "message", validate: () => true }],
						[32, { kind: "message", validate: () => true }],
						[33, { kind: "message", validate: () => true }]
					])
				});
				workerEndpoint.send(0);
			},
			terminate() { throw new Error("strict external CAPTCHA unexpectedly terminated"); }
		};
		const handlers = Array.from({ length: 33 }, () => () => undefined);
		for (let i = 29; i < 33; i++) handlers[i] = value => events.push([i, value]);
		const ipc = await createGameIpc(
			worker, "wss://server.rplace.live", "wss://server.rplace.live", 100, handlers
		);
		ipc.connect("device", null);
		await tick();
		workerEndpoint.send(30, [7, "turn-key"]);
		workerEndpoint.send(32, [8, "h-key"]);
		await tick();
		ipc.sendTurnstileResult(7, "turn-token");
		expect(() => ipc.sendTurnstileResult(7, "replay")).toThrow();
		ipc.sendHCaptchaResult(8, "h-token");
		await tick();
		workerEndpoint.send(31);
		workerEndpoint.send(33);
		await tick();
		expect(results).toEqual([
			["turnstile", [7, "turn-token"]],
			["hcaptcha", [8, "h-token"]]
		]);
		expect(events).toHaveLength(4);
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("correlates non-square strict placer-region responses", async () => {
		let workerEndpoint;
		const requests = [];
		const responses = [];
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([
						[2, { kind: "message", validate: () => true, handler: () => workerEndpoint.send(1) }],
						[16, { kind: "message", validate: () => true, handler: value => requests.push(value) }]
					]),
					outgoing: new Map([
						[0, { kind: "message", validate: value => value === undefined }],
						[1, { kind: "message", validate: value => value === undefined }],
						[34, { kind: "message", validate: () => true }]
					])
				});
				workerEndpoint.send(0);
			},
			terminate() { throw new Error("strict placer region unexpectedly terminated"); }
		};
		const handlers = Array.from({ length: 34 }, () => () => undefined);
		handlers[33] = value => responses.push(value);
		const ipc = await createGameIpc(
			worker, "wss://server.rplace.live", "wss://server.rplace.live", 100, handlers
		);
		ipc.connect("device", null);
		await tick();
		ipc.requestPixelPlacers(7, 3, 5);
		expect(() => ipc.requestPixelPlacers(7, 3, 16)).toThrow();
		await tick();
		workerEndpoint.send(34, [7, 2, 4, new ArrayBuffer(32)]);
		workerEndpoint.send(34, [7, 2, 4, new ArrayBuffer(32)]);
		await tick();
		expect(requests).toEqual([[7, 3, 5]]);
		expect(responses).toHaveLength(1);
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("uses strict requests for link keys and closed moderation input", async () => {
		let workerEndpoint;
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([
						[2, { kind: "message", validate: () => true, handler: () => workerEndpoint.send(1) }],
						[17, {
							kind: "request",
							validate: value => value === undefined,
							validateResult: () => true,
							handler: async () => ["key", 7]
						}],
						[18, {
							kind: "request",
							validate: () => true,
							validateResult: () => true,
							handler: () => "Use HTTP moderation API"
						}]
					]),
					outgoing: new Map([
						[0, { kind: "message", validate: value => value === undefined }],
						[1, { kind: "message", validate: value => value === undefined }]
					])
				});
				workerEndpoint.send(0);
			},
			terminate() { throw new Error("strict request unexpectedly terminated"); }
		};
		const ipc = await createGameIpc(
			worker, "wss://server.rplace.live", "wss://server.rplace.live", 100
		);
		ipc.connect("device", null);
		await tick();
		expect(await ipc.fetchLinkKey()).toEqual({ linkKey: "key", instanceId: 7 });
		expect(await ipc.sendModAction({
			action: "kick", memberId: 9, reason: "reason"
		})).toBe("Use HTTP moderation API");
		await expect(ipc.sendModAction({
			action: "kick", memberId: -1, reason: ""
		})).rejects.toThrow();
		ipc.dispose();
		workerEndpoint.dispose();
	});

	test("privately validates exact strict viewport policy", async () => {
		let workerEndpoint;
		const received = [];
		const worker = {
			postMessage(data, ports) {
				workerEndpoint = createTestWorkerEndpoint(data, ports[0], {
					incoming: new Map([[
						2,
						{
							kind: "message",
							validate: () => true,
							handler: () => workerEndpoint.send(1)
						}
					]]),
					outgoing: new Map([
						[0, { kind: "message", validate: value => value === undefined }],
						[1, { kind: "message", validate: value => value === undefined }],
						[35, { kind: "message", validate: () => true }]
					])
				});
				workerEndpoint.send(0);
			},
			terminate() { throw new Error("strict viewport unexpectedly terminated"); }
		};
		const handlers = Array.from({ length: 35 }, () => () => undefined);
		handlers[34] = value => received.push(value);
		const ipc = await createGameIpc(
			worker, "wss://server.rplace.live", "wss://server.rplace.live", 100, handlers
		);
		ipc.connect("device", null);
		await tick();
		workerEndpoint.send(35, [3, 2]);
		workerEndpoint.send(35, [4, 0]);
		workerEndpoint.send(35, [0, 3]);
		await tick();
		expect(received).toEqual([[3, 2]]);
		ipc.dispose();
		workerEndpoint.dispose();
	});
});

test("ignored page state notifications preserve subsequent IPC traffic", async () => {
	let peer;
	let terminated = 0;
	const received = [];
	const handlers = Array.from({length: 35}, () => () => undefined);
	handlers[16] = value => received.push(["online", value]);
	handlers[17] = value => received.push(["id", value]);
	const worker = {
		postMessage(data, ports) {
			peer = createTestWorkerEndpoint(data, ports[0], {
				incoming: new Map([[2, {kind: "message", validate: () => true,
					handler: () => peer.send(1)}]]),
				outgoing: new Map([0, 1, 5, 15, 17, 18, 21, 22, 28, 31, 33, 34].map(call =>
					[call, {kind: "message", validate: () => true}]))
			});
			peer.send(0);
		},
		terminate() { terminated++; }
	};
	const ipc = await createGameIpc(worker, "wss://example.invalid", "wss://example.invalid", 100, handlers);
	ipc.connect("device", null);
	await tick(); await tick();
	peer.send(18, 42);
	peer.send(18, 43); // identity is already bound
	peer.send(5); // no pending CAPTCHA response
	peer.send(15, [42, "stale"]); // not spectating
	peer.send(22, 42); // no corresponding spectator join
	peer.send(31); peer.send(33); // unsolicited CAPTCHA success
	peer.send(28, [0, 0, false, "en", []]); // no history request
	peer.send(34, [0, 1, 1, new ArrayBuffer(4)]); // no placer request
	peer.send(17, 12);
	await tick();
	expect(received).toEqual([["id", 42], ["online", 12]]);
	expect(terminated).toBe(0);
	ipc.dispose(); peer.dispose();
});


test("placement acknowledgement failure closes the stream without a legacy retry", async () => {
	let peer;
	let terminated = 0;
	const closes = [];
	const worker = {
		postMessage(data, ports) {
			peer = createTestWorkerEndpoint(data, ports[0], {
				incoming: new Map([
					[2, {kind: "message", validate: () => true, handler: () => peer.send(1)}],
					[20, {kind: "request", validate: () => true, validateResult: value => typeof value === "boolean",
						handler: () => { throw new Error("send failed"); }}]
				]),
				outgoing: new Map([0,1].map(call => [call, {kind: "message", validate: () => true}]))
			});
			peer.send(0);
		},
		terminate() { terminated++; }
	};
	const ipc = await createGameIpc(worker, "wss://example.invalid", "wss://example.invalid", 100,
		[() => undefined, value => closes.push(value)]);
	ipc.connect("device", null);
	await tick(); await tick();
	await expect(ipc.putPixel(0,1)).rejects.toThrow();
	expect(terminated).toBe(1);
	expect(closes).toEqual([[1002, "Placement acknowledgement failed"]]);
	expect(() => ipc.putPixel(0,1)).toThrow("Game IPC endpoint is closed");
	peer.dispose();
});
