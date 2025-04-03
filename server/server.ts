/* eslint-disable prefer-const */
/* eslint-disable jsdoc/require-param */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable jsdoc/require-returns */
/* eslint-disable jsdoc/require-jsdoc */
// @ts-check
// Legacy rplace server software, (c) BlobKat, Zekiah
// For the current server software, go to https://github.com/Zekiah-A/RplaceServer
import { promises as fs } from "fs"
import fsExists from "fs.promises.exists"
import util from "util"
import path from "path"
import * as zcaptcha from "./zcaptcha/server.js"
import cookie from "cookie"
import { isUser } from "ipapi-sync"
import repl from "basic-repl"
import { Worker } from "worker_threads"
import { $, Server, ServerWebSocket, TLSWebSocketServeOptions } from "bun"
import { DbInternals, LiveChatMessage } from "./db-worker.js"
import { PublicPromise } from "./server-types.js"
import type { ChallengeModule } from "./padlock/server.d.ts"
import { distance } from "fastest-levenshtein"
import * as sha256 from "sha256"

let BOARD:Uint8Array, CHANGES:Uint8Array, PLACERS:Buffer

type ServerConfig = {
	"SECURE": boolean,
	"CERT_PATH": string,
	"KEY_PATH": string,
	"PORT": number,
	"WIDTH": number,
	"HEIGHT": number,
	"COOLDOWN": number,
	"CAPTCHA": boolean,
	"PXPS_SECURITY": boolean,
	"ORIGINS": string[],
	"PALETTE": number[]|null,
	"PALETTE_USABLE_REGION": { start: number, end: number }|null
	"USE_CLOUDFLARE": boolean,
	"PUSH_LOCATION": string,
	"PUSH_PLACE_PATH": string,
	"LOCKED": boolean,
	"CHAT_WEBHOOK_URL": string,
	"MOD_WEBHOOK_URL": string,
	"CHAT_MAX_LENGTH": number,
	"CHAT_COOLDOWN_MS": number,
	"PUSH_INTERVAL_MINS": number,
	"CAPTCHA_EXPIRY_SECS": number,
	"PERIODIC_CAPTCHA_INTERVAL_SECS": number,
	"LINK_EXPIRY_SECS": number,
	"CAPTCHA_MIN_MS": number, //min solvetime
	"INCLUDE_PLACER": boolean, // pixel placer
	"SECURE_COOKIE": boolean,
	"CORS_COOKIE": boolean,
	"CHALLENGE": boolean,
	"TURNSTILE": boolean,
	"TURNSTILE_SITE_KEY": string,
	"TURNSTILE_PRIVATE_KEY": string,
	"CANVAS_ID": number|null,
	"CANVAS_NAME": string|null,
	"CANVAS_ICON": string|null,
	"TENOR_API_KEY": string|null,
	"TENOR_CLIENT_KEY": string|null
}
let configFailed = false
let configFile = await fs.readFile("./server_config.json").catch(_ => configFailed = true)
if (configFailed) {
	await fs.writeFile("server_config.json", JSON.stringify({
		"SECURE": true,
		"CERT_PATH": "/etc/letsencrypt/live/path/to/fullchain.pem",
		"KEY_PATH": "/etc/letsencrypt/live/server.rplace.live/fullchain.pem",
		"PORT": 443,
		"WIDTH": 2000,
		"HEIGHT": 2000,
		"COOLDOWN": 1000,
		"CAPTCHA": false,
		"PXPS_SECURITY": false,
		"ORIGINS": [ "https://rplace.live", "https://rplace.tk" ],
		"PALETTE": null,
		"PALETTE_USABLE_REGION": null,
		"USE_CLOUDFLARE": true,
		"PUSH_LOCATION": "https://PUSH_USERNAME:MY_PERSONAL_ACCESS_TOKEN@github.com/MY_REPO_PATH",
		"PUSH_PLACE_PATH": "/path/to/local/git/repo",
		"LOCKED": false,
		"CHAT_WEBHOOK_URL": "",
		"MOD_WEBHOOK_URL": "",
		"CHAT_MAX_LENGTH": 400,
		"CHAT_COOLDOWN_MS": 2500,
		"PUSH_INTERVAL_MINS": 30,
		"CAPTCHA_EXPIRY_SECS": 45,
		"PERIODIC_CAPTCHA_INTERVAL_SECS": -1,
		"LINK_EXPIRY_SECS": 60,
		"CAPTCHA_MIN_MS": 100, //min solvetime
		"INCLUDE_PLACER": false, // pixel placer
		"SECURE_COOKIE": true,
		"CORS_COOKIE": false,
		"CHALLENGE": false,
		"TURNSTILE": false,
		"TURNSTILE_SITE_KEY": "",
		"TURNSTILE_PRIVATE_KEY": "",
		"CANVAS_ID": null,
		"CANVAS_NAME": null,
		"CANVAS_ICON": "https://rplace.live/images/rplace.png",
		"TENOR_API_KEY": "",
		"TENOR_CLIENT_KEY": ""
	}, null, 4))
	console.log("Config file created, please update it before restarting the server")
	process.exit(0)
}

const DEFAULT_EMOJIS = new Map([
	[ "rofl", "🤣" ],
	[ "joy", "😂" ],
	[ "cool", "😎" ],
	[ "sunglasses", "😎" ],
	[ "heart", "❤️" ],
	[ "moyai", "🗿" ],
	[ "bruh", "🗿" ],
	[ "skull", "💀" ],
	[ "sus", "ඞ" ],
	[ "tr", "🇹🇷" ],
	[ "turkey", "🇹🇷" ],
	[ "ir", "🇮🇷" ],
	[ "iran", "🇮🇷" ],
	[ "gb", "🇬🇧" ],
	[ "britain", "🇬🇧" ],
	[ "us", "🇺🇸" ],
	[ "america", "🇺🇸" ],
	[ "ru", "🇷🇺" ],
	[ "russia", "🇷🇺" ],
	[ "es", "🇪🇸" ],
	[ "spain", "🇪🇸" ],
	[ "eyes", "👀" ],
	[ "fire", "🔥" ],
	[ "thumbsup", "👍" ],
	[ "thumbsdown", "👎" ],
	[ "clown", "🤡" ],
	[ "facepalm", "🤦‍♂️" ],
	[ "ok", "👌" ],
	[ "poop", "💩" ],
	[ "rocket", "🚀" ],
	[ "tada", "🎉" ],
	[ "celebration", "🎉" ],
	[ "moneybag", "💰" ],
	[ "crown", "👑" ],
	[ "muscle", "💪" ],
	[ "beer", "🍺" ],
	[ "pizza", "🍕" ],
	[ "cookie", "🍪" ],
	[ "balloon", "🎈" ],
	[ "gift", "🎁"],
	[ "star", "⭐️" ],
	[ "love", "😍" ],
	[ "crying", "😢" ],
	[ "angry", "😠" ],
	[ "sleepy", "😴" ],
	[ "nerd", "🤓" ],
	[ "laughing", "😆" ],
	[ "vomiting", "🤮" ],
	[ "unicorn", "🦄" ],
	[ "alien", "👽" ],
	[ "ghost", "👻" ],
	[ "skullcrossbones", "☠️" ],
	[ "explosion", "💥" ],
	[ "shush", "🤫" ],
	[ "deaf", "🧏" ],
	[ "mew", "🤫🧏" ],
	[ "pray", "🙏" ],
	[ "thinking", "🤔" ],
	[ "sweat", "😅" ],
	[ "wave", "👋"]
])
const DEFAULT_CUSTOM_EMOJIS = new Map([
	[ "amogus", "custom_emojis/amogus.png" ],
	[ "biaoqing", "custom_emojis/biaoqing.png" ],
	[ "deepfriedh", "custom_emojis/deepfriedh.png" ],
	[ "edp445", "custom_emojis/edp445.png" ],
	[ "fan", "custom_emojis/fan.png" ],
	[ "heavy", "custom_emojis/heavy.png" ],
	[ "herkul", "custom_emojis/herkul.png" ],
	[ "kaanozdil", "custom_emojis/kaanozdil.png" ],
	[ "lowtiergod", "custom_emojis/lowtiergod.png" ],
	[ "manly", "custom_emojis/manly.png" ],
	[ "plsaddred", "custom_emojis/plsaddred.png" ],
	[ "rplace", "custom_emojis/rplace.png" ],
	[ "rplacediscord", "custom_emojis/rplacediscord.png" ],
	[ "sonic", "custom_emojis/sonic.png" ],
	[ "transparent", "custom_emojis/transparent.png" ],
	[ "trollface", "custom_emojis/trollface.png" ]
])
const DEFAULT_PALETTE = [ 0xff1a006d, 0xff3900be, 0xff0045ff, 0xff00a8ff, 0xff35d6ff, 0xffb8f8ff, 0xff68a300, 0xff78cc00, 0xff56ed7e, 0xff6f7500, 0xffaa9e00, 0xffc0cc00, 0xffa45024, 0xffea9036, 0xfff4e951, 0xffc13a49, 0xffff5c6a, 0xffffb394, 0xff9f1e81, 0xffc04ab4, 0xffffabe4, 0xff7f10de, 0xff8138ff, 0xffaa99ff, 0xff2f486d, 0xff26699c, 0xff70b4ff, 0xff000000, 0xff525251, 0xff908d89, 0xffd9d7d4, 0xffffffff ]
let { SECURE, CERT_PATH, PORT, KEY_PATH, WIDTH, HEIGHT, ORIGINS, PALETTE, PALETTE_USABLE_REGION, COOLDOWN, CAPTCHA,
	PXPS_SECURITY, USE_CLOUDFLARE, PUSH_LOCATION, PUSH_PLACE_PATH, LOCKED, CHAT_WEBHOOK_URL, MOD_WEBHOOK_URL,
	CHAT_MAX_LENGTH, CHAT_COOLDOWN_MS, PUSH_INTERVAL_MINS, CAPTCHA_EXPIRY_SECS, PERIODIC_CAPTCHA_INTERVAL_SECS,
	LINK_EXPIRY_SECS, CAPTCHA_MIN_MS, INCLUDE_PLACER, SECURE_COOKIE, CORS_COOKIE, CHALLENGE, TURNSTILE, TURNSTILE_SITE_KEY,
	TURNSTILE_PRIVATE_KEY, CANVAS_ID, CANVAS_NAME, CANVAS_ICON, TENOR_API_KEY, TENOR_CLIENT_KEY } = JSON.parse(configFile.toString()) as ServerConfig
try {
	BOARD = new Uint8Array(await Bun.file(path.join(PUSH_PLACE_PATH, "place")).arrayBuffer())
}
catch(e) {
	console.log(e, "(regenerating)")
	BOARD = new Uint8Array(WIDTH * HEIGHT)
}
try {
	CHANGES = new Uint8Array(await Bun.file(path.join(PUSH_PLACE_PATH, "change")).arrayBuffer())
	// Probably corrupted, try changes 2
	if (CHANGES.byteLength < WIDTH * HEIGHT)
		CHANGES = new Uint8Array(await Bun.file(path.join(PUSH_PLACE_PATH, "change2")).arrayBuffer())
	if (CHANGES.byteLength < WIDTH * HEIGHT)
		throw new Error("Changes was smaller than expected")
}
catch(e) {
	console.log(e, "(regenerating)")
	CHANGES = new Uint8Array(WIDTH * HEIGHT).fill(255)
}
try {
	PLACERS = Buffer.from(await Bun.file(path.join(PUSH_PLACE_PATH, "placers")).arrayBuffer())
}
catch(e) {
	console.log(e, "(regenerating)")
	PLACERS = Buffer.alloc(WIDTH * HEIGHT * 4).fill(0xFFFFFFFF)
}
let uidTokenFailed = false
const uidTokenFile = await fs.readFile("uidtoken.txt").catch(_ => uidTokenFailed = true)
let uidToken:string
if (uidTokenFile == null || uidTokenFailed) {
	uidToken = "UidToken_" + Math.random().toString(36).slice(2)
	await fs.writeFile("uidtoken.txt", uidToken)
}
else {
	uidToken = uidTokenFile.toString()
}

let padlock: ChallengeModule | null = null
async function initialiseChallenge() {
	if (!CHALLENGE) {
		return
	}
	try {
		const padlockPath = "./padlock/server.ts"
		const [exists, isFile, notEmpty] = await Promise.all([
			Bun.file(padlockPath).exists(),
			Bun.file(padlockPath).type === "file",
			Bun.file(padlockPath).size > 0
		])
		if (!exists || !isFile || !notEmpty) {
			throw new Error("Challenge module file invalid")
		}
		padlock = await import(padlockPath) as ChallengeModule
	}
	catch (error) {
		CHALLENGE = false
		console.error("Challenge disabled:", error instanceof Error ? error.message : String(error))
	}
}
await initialiseChallenge()

type PixelInfo = { index: number, colour: number, placer: ServerWebSocket<ClientData> }
const newPixels:PixelInfo[] = [] 
// Reports must persist between client sessions and be rate limited
let chatNameCooldownMs = 10_000
const chatNameCooldowns = new Map<string, number>()
let reportCooldownMs = 60_000
const reportCooldowns = new Map<string, number>()
let activityCooldownMs = 10_000 
const activityCooldowns = new Map<string, number>()
// Cooldowns must persist between client sessions
const cooldowns = new Map<string, number>()
type LinkKeyInfo = {
	intId: number,
	dateCreated: number,
	canvasId: number
}
const linkKeyInfos = new Map<string, LinkKeyInfo>()

/*
 * Compress CHANGES with variable run length encoding
 */
function runLengthChanges() {
	let changesIndex = 0
	let buffers = [Buffer.alloc(256)]
	let bufferIndex = 0
	let bufferPointer = 0
	buffers[0][bufferPointer++] = 2
	buffers[0].writeUint32BE(WIDTH, 1)
	buffers[0].writeUint32BE(HEIGHT, 5)
	bufferPointer += 8

	function addToBuffer(value:number) {
		buffers[bufferIndex][bufferPointer++] = value
		if (bufferPointer === 256) {
			bufferPointer = 0
			buffers.push(Buffer.alloc(256))
			bufferIndex++
		}
	}
	while (true) {
		let blankCells = 0
		while (CHANGES[changesIndex] == 255) {
			blankCells++
			changesIndex++
		}
		if (changesIndex == CHANGES.length) {
			break
		}
		// Two bits are used to store blank cell count
		// 00 = no gap
		// 01 = 1-byte (Gaps up to 255)
		// 10 = 2-byte (Gaps up to 65535)
		// 11 = 4-byte (Likely unused)
		if (blankCells < 256) {
			if(!blankCells){
				addToBuffer(CHANGES[changesIndex++])
			}
			else{
				addToBuffer(CHANGES[changesIndex++] + 64)
				addToBuffer(blankCells)
			}
		}
		else if (blankCells < 65536) {
			addToBuffer(CHANGES[changesIndex++] + 128)
			addToBuffer(blankCells >> 8)
			addToBuffer(blankCells)
		}
		else {
			addToBuffer(CHANGES[changesIndex++] + 192)
			addToBuffer(blankCells >> 24)
			addToBuffer(blankCells >> 16)
			addToBuffer(blankCells >> 8)
			addToBuffer(blankCells)
		}
	}
	buffers[bufferIndex] = buffers[bufferIndex].subarray(0, bufferPointer)
	return Buffer.concat(buffers)
}

/** Bidirectional map */
class DoubleMap<T, K> {
	forward: Map<T, K>
	reverse: Map<K, T>
	constructor() {
		this.forward = new Map<T, K>()
		this.reverse = new Map<K, T>()
	}
	set(key: T, value: K) {
		this.forward.set(key, value)
		this.reverse.set(value, key)
	}
	getForward(key: T) { return this.forward.get(key) }
	getReverse(value: K) { return this.reverse.get(value) }
	delete(key: T):boolean {
		const value = this.forward.get(key)
		if (value) {
			this.forward.delete(key)
			this.reverse.delete(value)
			return true
		}
		return false
	}
	clear() { this.forward.clear(); this.reverse.clear() }
	size() { return this.forward.size }
}

const criticalFiles = ["blacklist.txt", "bansheets.txt", "vip.txt", "reserved_names.txt", "censors.txt"]
for (let i = 0; i < criticalFiles.length; i++) {
	const criticalFile = criticalFiles[i]
	if (!await fsExists(criticalFile)) {
		console.warn("Could not find critical file", criticalFile, "regenerating.")
		await fs.writeFile(criticalFile, "")
	}
}

/**
 * @param {number} length Length of generated random string
 * @returns {string} random string
 */
function randomString(length: number) {
	const buf = new Uint8Array(length)
	crypto.getRandomValues(buf)
	let str = ""
	for (let i = 0; i < buf.length; i++) {
		return Array.from(buf).map(b => b.toString(16)).join("").slice(0, length)
	}

	return str.slice(0, length)
}

let playersOffset = 0
Object.defineProperty(globalThis, "realPlayers", {
	get: function() {
		return wss.clients.size
	}
})
Object.defineProperty(globalThis, "players", {
	// @ts-ignore
	get: function() { return realPlayers + playersOffset },
	// @ts-ignore
	set: function(value) { playersOffset = value - realPlayers }
})

const RESERVED_NAMES = new DoubleMap()
// `reserved_name private_code\n`, for example "zekiah 124215253113\n"
const reservedLines = ((await fs.readFile("reserved_names.txt")).toString()).split('\n')
for (const pair of reservedLines) RESERVED_NAMES.set(pair.split(' ')[0], pair.split(' ')[1])

type BlacklistInfo = { reason: string, date: number }
async function getBansheetsIps() {
	const bansheetsText = await fs.readFile("bansheets.txt")
	const banListUrls = bansheetsText.toString().trim().split("\n")
	const banLists = await Promise.all(
		banListUrls.map(banListUrl => fetch(banListUrl)
			.then(response => response.text())
			.catch(error => {
				console.error(`Failed to fetch ban list from ${banListUrl}:`, error)
				return ""
			}))
	)
	const blacklistedIps = banLists
		.flatMap((line: string) => line.trim().split("\n")
		.filter((line: string) => line.trim() && !line.trim().startsWith("#"))
		.map((ip: string): [string, BlacklistInfo] => [ip.split(":")[0].trim(), { reason: "Bansheeted IP", date: 0 }]))
	return new Map<string, BlacklistInfo>(blacklistedIps)
}
let BLACKLISTED:Map<string, BlacklistInfo> = await getBansheetsIps()
for (let banLine of (await fs.readFile("blacklist.txt")).toString().split("\n")) {
	banLine = banLine.trim()
	if (!banLine || banLine.startsWith("#")) {
		continue
	}
	const spaceI = banLine.indexOf(" ")
	const ip = banLine.slice(0, spaceI)
	let info = banLine.slice(spaceI).trim()
	let infoObject:BlacklistInfo|null = null
	try { infoObject = JSON.parse(info) } catch(e) {/* Ignore */}
	infoObject = Object.assign({ reason: "Blacklisted IP", date: 0 }, infoObject)
	BLACKLISTED.set(ip, infoObject)
}
let CENSORS:Array<RegExp> = []
for (let censorPattern of (await fs.readFile("censors.txt")).toString().split("\n")) {
	censorPattern = censorPattern.trim()
	if (!censorPattern || censorPattern.startsWith("#")) {
		continue
	}
	CENSORS.push(new RegExp(censorPattern, "i"))
}

const toValidate = new Map()
const captchaFailed = new Map()
const encoderUTF8 = new util.TextEncoder()
const decoderUTF8 = new util.TextDecoder()

let dbReqId = 0
let dbWorker = new Worker("./db-worker.ts")
const dbReqs = new Map()

/*
 * __Always await this__, and only use in cases where you __WANT the response__, if you want something that
 * you can just fire and forget then use postDbMessage instead, which does not result in a dbReq allocation
 */
//@ts-expect-error Chicanery (trust me bro)
async function makeDbRequest<T extends DbInternals>(messageCall: keyof T, args?: Parameters<T[keyof T]>[0]): Promise<Awaited<ReturnType<T[keyof T]>>> {
	const handle = dbReqId++
	const promise = new PublicPromise()

	const postCall = { call: messageCall, data: args, handle: handle }
	dbReqs.set(handle, promise)
	try {
		dbWorker.postMessage(postCall)
	}
	catch (error) {
		promise.reject(error)
	}
	//@ts-expect-error Chicanery (trust me bro)
	return await promise.promise
}
dbWorker.on("message", (message) => {
	dbReqs.get(message.handle)?.resolve(message.data)
})
dbWorker.on("error", console.warn)
//@ts-expect-error Chicanery (trust me bro)
function postDbMessage<T extends DbInternals>(messageCall: keyof T, args?: Parameters<T[keyof T]>[0]):void {
	try {
		dbWorker.postMessage({ call: messageCall, data: args })
	}
	catch (error) {
		console.error("Failed to post message to worker:", error)
	}
}
//@ts-expect-error Chicanery (trust me bro)
function postDbMessage<T extends DbInternals>(messageCall: keyof T, args?: Parameters<T[keyof T]>[0]):void {
	dbWorker.postMessage({ call: messageCall, data: args })
}

const playerIntIds = new Map<ServerWebSocket<ClientData>, number>() // Player ws instance<Object> : intID<Number>
const playerChatNames = new Map<number, string>() // intId<Number> : chatName<String>
let liveChatMessageId:number = (await makeDbRequest("getMaxLiveChatId")) as number || 0
let placeChatMessageId:number = (await makeDbRequest("getMaxPlaceChatId")) as number || 0
const mutes = new Map<string, number>() // IP : finishDate (unix epoch offset ms)
const bans = new Map<string, number>() // IP : finishDate (unix epoch offset ms)
const activeVips = new Map<string, ServerWebSocket<ClientData>>() // String VIP key : client


// vip key, cooldown
const vipTxt = (await fs.readFile("./vip.txt")).toString()
if (!vipTxt) {
	Bun.write("./vip.txt",
		"# VIP Key configuration file\n" +
		"# Below is the correct format of a VIP key configuration:\n" +
		"# MY_SHA256_HASHED_VIP_KEY { \"perms\": \"canvasmod\"|\"chatmod\"|\"admin\",\"vip\", \"cooldownMs\": number, \"enforceChatName\": string|null }\n\n" +
		"# Example VIP key configuration:\n" +
		"# 7eb65b1afd96609903c54851eb71fbdfb0e3bb2889b808ef62659ed5faf09963 { \"perms\": \"admin\", \"cooldownMs\": 30, \"enforceChatName\": \"<ADMIN> zekiah\" }\n" +
		"# Make sure all VIP keys stored here are sha256 hashes of the real keys you hand out\n")
}

type VipEntry = {
	perms: "admin"|"chatmod"|"vip",
	cooldownMs: number,
	enforceChatName: string|null
}
function readVip(vipTxt: string):Map<string, VipEntry> {
	return new Map(vipTxt
		.split("\n")
		.filter((line: string) => line.trim() && !line.trim().startsWith("#"))
		.map((pair: string) => [ pair.trim().slice(0, 64), JSON.parse(pair.slice(64).trim()) ]))
}
const VIP = readVip(vipTxt)
;(async function() {
	for await (const _ of fs.watch("./vip.txt")) {
		const beforeKeys = VIP.size
		try {
			const vipTxt = (await fs.readFile("./vip.txt")).toString()
			const newVip = readVip(vipTxt)
			const addedKeys = new Map([...newVip].filter(([k]) => !VIP.has(k)))
			const removedKeys = new Map([...VIP].filter(([k]) => !newVip.has(k)))
			const modifiedKeys = new Map([...newVip].filter(([k, v]) => VIP.has(k) && VIP.get(k) !== v))

			// Update VIP map
			for (const [k, v] of addedKeys) VIP.set(k, v)
			for (const [k] of removedKeys) VIP.delete(k)
			for (const [k, v] of modifiedKeys) VIP.set(k, v)
			let removedClients = 0
			for (const [k, _] of removedKeys) {
				const activeClient = activeVips.get(k)
				if (activeClient) {
					removedClients++
					activeClient.close()
				}
			}
			console.log(`Change in VIP config detected, VIP updated: ${beforeKeys} keys -> ${VIP.size} keys detected. ${
				addedKeys.size > 0 ? `${addedKeys.size} keys found to be added. `: ""} ${
				removedKeys.size > 0 ? `${removedKeys.size} keys found to be removed.`: ""} ${
				modifiedKeys.size > 0 ? `${modifiedKeys.size} keys found to be modified. ` : ""} ${
				removedClients > 0 ? `${removedClients} active key users removed.` : ""}`)
		}
		catch(e) {
			console.log("Error reading or updating VIP:", e)
		}
	}
})()

const PUNISHMENT_STATE = {
	mute: 0,
	ban: 1,
	appealRejected: 2,
}

// Fetch all mutes, bans
const muteIdFinishes:any = await makeDbRequest("exec", {
	stmt: "SELECT userIntId AS intId, finishDate FROM Mutes WHERE finishDate > ?",
	params: Date.now() })
for (const idFinish of muteIdFinishes) {
	const idIps:any = await makeDbRequest("exec", {
		stmt: "SELECT ip FROM KnownIps WHERE userIntId = ?",
		params: idFinish.intId })
	for (const ipObject of idIps) {
		mutes.set(ipObject.ip, idFinish.finishDate)
	}
}
const banIdFinishes:any = await makeDbRequest("exec", {
	stmt: "SELECT userIntId AS intId, finishDate FROM Bans WHERE finishDate > ?",
	params: Date.now() })
for (const idFinish of banIdFinishes) {
	const idIps:any = await makeDbRequest("exec", {
		stmt: "SELECT ip FROM KnownIps WHERE userIntId = ?",
		params: idFinish.intId })
	for (const ipObject of idIps) {
		bans.set(ipObject.ip, idFinish.finishDate)
	}
}

// Server is player ID 0, all server messages have message ID 0
playerChatNames.set(0, "SERVER@RPLACE.LIVE✓")

const allowed = new Set(["rplace.tk", "rplace.live", "discord.gg", "twitter.com", "wikipedia.org", "pxls.space", "reddit.com"])
function censorText(text:string):string {
	for (const censorPattern of CENSORS) {
		text = text.replace(censorPattern, match => "*".repeat(match.length))
	}
	return text
		.replace(/https?:\/\/(\w+\.)+\w{2,15}(\/\S*)?|(\w+\.)+\w{2,15}\/\S*|(\w+\.)+(tk|ga|gg|gq|cf|ml|fun|xxx|webcam|sexy?|tube|cam|p[o]rn|adult|com|net|org|online|ru|co|info|link)/gi,
			match => allowed.has(match.replace(/^https?:\/\//, "").split("/")[0]) ? match : "")
		.trim()
}

/**
 * @param {number} type - (0|1) message type (0 - Live chat message, 1 - place chat message)
 * @param {string} message - Message text content (maxlen(65534))
 * @param {number} sendDate - Unix epoch offset __**seconds**__ of message send
 * @param {number} messageId - Message integer id (u32)
 * @param {number} intId - Sender integer id (u32)
 * @param {string?} channel - String channel (maxlen(16))
 * @param {number?} repliesTo - Integer message id replies to (u32)
 * @param {number?} positionIndex - Index on canvas of place chat message (u32)
 * @returns {Buffer} Message packet data prepended with packet code (15)
 */
function createChatPacket(type: number, message: string, sendDate: number, messageId: number, intId: number, channel: string|null = null, repliesTo: number|null = null, reactions: Map<string, number[]>|null = null, positionIndex: number|null = null): Buffer {
	let encodedChannel:Uint8Array|null = null
	if (channel) encodedChannel = encoderUTF8.encode(channel)
	const encodedTxt = encoderUTF8.encode(message)
	const msgPacket = Buffer.allocUnsafe(encodedTxt.byteLength +
		(type == 0 ? 18 + (encodedChannel?.byteLength || 0) + (repliesTo == null ? 0 : 4) : 16))

	let i = 0
	msgPacket[i] = 15; i++
	msgPacket[i] = type; i++
	msgPacket.writeUInt32BE(messageId, i); i += 4
	msgPacket.writeUInt16BE(encodedTxt.byteLength, i); i += 2
	msgPacket.set(encodedTxt, i); i += encodedTxt.byteLength
	msgPacket.writeUInt32BE(intId, i); i +=  4

	if (type == 0 && encodedChannel != null) { // Live chat message
		msgPacket.writeUInt32BE(sendDate, i); i += 4
		msgPacket[i] = reactions?.size || 0; i++
		if (reactions != null) {
			for (const [reactionKey, reactors] of reactions.entries()) {
				const encodedReactionKey = encoderUTF8.encode(reactionKey)
				msgPacket[i++] = encodedReactionKey.byteLength
				msgPacket.set(encodedReactionKey)
				msgPacket.writeUint32BE(reactors.length, i)
				for (const reactor of reactors) {
					msgPacket.writeUint32BE(reactor, i); i += 4
				}
			}
		}
		msgPacket[i] = encodedChannel.byteLength; i++
		msgPacket.set(encodedChannel, i); i += encodedChannel.byteLength
		if (repliesTo != null) {
			msgPacket.writeUInt32BE(repliesTo, i); i += 4
		}
	}
	else if (positionIndex != null) { // Place (canvas chat message)
		msgPacket.writeUInt32BE(positionIndex, i); i += 4
	}

	return msgPacket
}

/**
 *
 * @param {Map<number, string>} names IntId : String names map to be encoded
 * @returns {Buffer} Name packet data prepended with packet code (12)
 */
function createNamesPacket(names: Map<number, string>): Buffer {
	let size = 1
	const encodedNames = new Map()
	for (const [intId, name] of names) {
		const encName = encoderUTF8.encode(name)
		encodedNames.set(intId, encName)
		size += encName.length + 5
	}

	const infoBuffer = Buffer.allocUnsafe(size)
	infoBuffer[0] = 12
	let i = 1
	for (const [intId, encName] of encodedNames) {
		infoBuffer.writeUInt32BE(intId, i); i += 4
		infoBuffer.writeUInt8(encName.length, i); i++
		infoBuffer.set(encName, i); i += encName.length
	}

	return infoBuffer
}
function createNamePacket(name: string, intId: number): Buffer {
	const encName = encoderUTF8.encode(name)
	const nmInfoBuf = Buffer.alloc(6 + encName.length)
	nmInfoBuf.writeUInt8(12, 0)
	nmInfoBuf.writeUInt32BE(intId, 1)
	nmInfoBuf.writeUInt8(encName.length, 5)
	nmInfoBuf.set(encName, 6)
	return nmInfoBuf 
}

/**
 * @param {typeof PUNISHMENT_STATE.mute|typeof PUNISHMENT_STATE.ban} type Punishment type being applied
 * @param {number} startDate Punishment action creation (start) date
 * @param {number} finishDate Punishment action finish date
 * @param {string} reason Reason set by moderator and shared to client for why they were punished
 * @param {string} userAppeal String appeal that the user provided against their own punishment
 * @param {boolean} appealRejected Boolean indicating whether appeal is rejected and no logner editable
 * @returns {Buffer}
 */
function createPunishPacket(type: typeof PUNISHMENT_STATE.mute | typeof PUNISHMENT_STATE.ban, startDate: number, finishDate: number, reason: string, userAppeal: string, appealRejected: boolean): Buffer {
	const encReason = encoderUTF8.encode(reason)
	const encAppeal = encoderUTF8.encode(userAppeal)
	const buf = Buffer.allocUnsafe(12 + encReason.byteLength + encAppeal.byteLength)

	let offset = 0
	buf[offset++] = 14
	buf[offset++] = type | (appealRejected ? PUNISHMENT_STATE.appealRejected : 0) // state
	buf.writeUInt32BE(startDate / 1000, offset); offset += 4
	buf.writeUInt32BE(finishDate / 1000, offset); offset += 4
	buf[offset++] = encReason.byteLength
	buf.set(encReason, offset); offset += encReason.byteLength
	buf[offset++] = encAppeal.byteLength
	buf.set(encAppeal, offset); offset += encAppeal.byteLength
	return buf
}

/**
 * If a user changes their intId, they will still be banned, as it applies recursively to every IP used by that intId, however
 * they will not receive the detailed info on why they were banned, instead just receiving when their ban finishes. They will also
 * not be able to appeal the action
 * @param {import('bun').ServerWebSocket} ws - Websocket client that punishments will be applied for
 * @param {number} intId - Integer ID of player to have punishments scanned for
 * @param {string} ip - IP address of client to have punishments applied and scanned for
 */
async function applyPunishments(ws: ServerWebSocket<ClientData>, intId: number, ip: string) {
	async function resolvePunishments(tableName: string, ipFinishMap: Map<string, number>, stateType: number) {
		const punishInfo:any = await makeDbRequest("exec", {
			stmt: `SELECT startDate, finishDate, reason, userAppeal, appealRejected FROM ${tableName} WHERE userIntId = ?`,
			params: intId })
		
		let ipFinish = ipFinishMap.get(ip) ?? null
		
		if (ipFinish && ipFinish < NOW) {
			ipFinishMap.delete(ip)
			ipFinish = null
		}

		if (punishInfo && punishInfo.finishDate > NOW) {
			if (!ipFinish) {
				// Banned user ID on a new IP, ban this IP too
				ipFinishMap.set(ip, punishInfo.finishDate)
			}
			const punishPacket = createPunishPacket(stateType, punishInfo.startDate,
				punishInfo.finishDate, punishInfo.reason, punishInfo.userAppeal, punishInfo.appealRejected)
			ws.send(punishPacket)
		}
		else if (ipFinish) {
			const punishPacket = createPunishPacket(stateType, NOW, ipFinish, "Unknown", "N/A", true)
			ws.send(punishPacket)
		}    
	}
	await resolvePunishments("Bans", bans, PUNISHMENT_STATE.ban)
	await resolvePunishments("Mutes", mutes, PUNISHMENT_STATE.mute)
}

function rejectPixel(ws:ServerWebSocket<ClientData>, i:number, cd:number) {
	const data = Buffer.alloc(10)
	data[0] = 7
	data.writeInt32BE(Math.ceil(cd / 1000) || 1, 1)
	data.writeInt32BE(i, 5)
	data[9] = CHANGES[i] == 255 ? BOARD[i] : CHANGES[i]
	ws.send(data)
}

interface TenorMediaFormat {
	url: string;
	dims: [number, number];
}
interface TenorResult {
	id: string;
	content_description: string;
	media_formats: {
		webm: TenorMediaFormat;
		webp: TenorMediaFormat;
		mp4?: TenorMediaFormat;
	};
}
interface GifResult {
	id:string;
	source:string;
	sourceFallback:string|null;
	preview:string;
	width:string;
	height:string;
	description:string;
}
interface GifResponse {
	results: GifResult[];
	next: string;
}

export type ClientData = {
	ip: string,
	headers: Headers,
	url: string,
	codeHash: string,
	perms: "vip"|"chatmod"|"canvasmod"|"admin",
	lastChat: number,
	connDate: number,
	cd: number,
	intId: number,
	token: string,
	chatName: string,
	voted: number,
	challenge: "pending"|"active"|undefined,
	turnstile: "active"|undefined,
	lastPeriodCaptcha: number,
	shadowBanned: boolean,
	previousLiveChats: string[],
	previousPlaceChats: string[]
}
type RplaceServer = Server & {
	clients: Set<ServerWebSocket<ClientData>>;
};
const serverOptions:TLSWebSocketServeOptions<ClientData> = {
	async fetch(req: Request, server: Server) {
		const url = new URL(req.url)
		const cookies = cookie.parse(req.headers.get("Cookie") || "")
		const userToken = cookies[uidToken]

		// CORS BS
		const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true" }
		if (req.method === "OPTIONS") {
			const headers = new Headers({
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "*",
				"Access-Control-Allow-Headers": "*"
			})
			return new Response(null, { status: 204, headers: headers })
		}

		// User wants to link their canvas account to the global auth server, architecture outlined in
		// https://github.com/rplacetk/architecture/blob/main/account_linkage.png
		if (url.pathname.startsWith("/users/") && req.method === "GET") {
			const targetId = parseInt(url.pathname.slice(7))
			if (Number.isNaN(targetId) || typeof targetId !== "number") {
				return new Response("Invalid user ID format", {
					status: 400,
					headers: corsHeaders
				})
			}

			const usersInfo = await makeDbRequest("exec", {
				stmt: "SELECT intId, chatName, lastJoined, pixelsPlaced, playTimeSeconds FROM Users WHERE intId = ?1",
				params: [ targetId ]
			})
			if (!usersInfo || !Array.isArray(usersInfo) || usersInfo.length != 1) {
				return new Response("Could not find user with specified ID", {
					status: 404,
					headers: corsHeaders
				})
			}

			const userInfo = usersInfo[0]
			for (const p of wss.clients) {
				if (p.data.intId === userInfo.intId) {
					userInfo.online = true
					break
				}
			}
			return new Response(JSON.stringify(userInfo), {
				status: 200,
				headers: { "Content-Type": "application/json", ...corsHeaders }
			})
		}
		else if (url.pathname.startsWith("/link/") && req.method === "GET") {
			const targetLink = url.pathname.slice(6)
			if (!targetLink) {
				return new Response("No link key provided", {
					status: 400,
					headers: corsHeaders
				})
			}

			const info = linkKeyInfos.get(targetLink)
			if (info) {
				linkKeyInfos.delete(targetLink)
				return new Response(JSON.stringify(info), {
					status: 200,
					headers: { "Content-Type": "application/json", ...corsHeaders }
				})
			}

			return new Response("Provided link key info could not be found", {
				status: 404,
				headers: corsHeaders
			})
		}
		// GIFs service API
		else if (url.pathname.startsWith("/gifs/search") && req.method === "GET") {
			if (!TENOR_API_KEY || !TENOR_CLIENT_KEY) {
				return new Response("Failed to fetch GIFs", {
					status: 500,
					headers: { "Content-Type": "application/json", ...corsHeaders }
				})
			}
			const q = url.searchParams.get("q") || "reddit"
			const limit = url.searchParams.get("limit") || "16"
			const pos = url.searchParams.get("pos") || ""
			const source = url.searchParams.get("source") || "tenor"
			if (source !== "tenor") {
				return new Response(null, {
					status: 404,
					headers: { "Content-Type": "application/json", ...corsHeaders }
				})
			}

			try {
				// Build Tenor API URL
				const params = new URLSearchParams({
					key: TENOR_API_KEY,
					client_key: TENOR_CLIENT_KEY,
					media_filter: "webm,mp4,webp,tinywebm",
					q,
					limit
				})
				if (pos) {
					params.set("pos", pos)
				}
				const tenorUrl = `https://tenor.googleapis.com/v2/search?${params}`
		
				// Fetch data from Tenor
				const response = await fetch(tenorUrl)
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`)
				}
				const { results, next } = await response.json() as GifResponse
				const processed =  {
					source: "tenor",
					next,
					results: results.map(result => ({
						id: result.id,
						source: result.media_formats.webm?.url,
						sourceFallback: result.media_formats.mp4?.url,
						preview: result.media_formats.webp?.url,
						width: result.media_formats.webm?.dims[0],
						height: result.media_formats.webm?.dims[1],
						description: result.content_description,
					}))
				}

				// Return processed data as JSON
				return new Response(JSON.stringify(processed), {
					headers: { "Content-Type": "application/json", ...corsHeaders }
				})
			}
			catch (error) {
				console.error("Error fetching GIFs:", error)
				return new Response("Failed to fetch GIFs", {
					status: 500,
					headers: { "Content-Type": "application/json", ...corsHeaders }
				})
			}		
		}
		else if (url.pathname.startsWith("/gifs") && req.method === "GET") {
			if (!TENOR_API_KEY || !TENOR_CLIENT_KEY) {
				return new Response("Failed to fetch GIFs", {
					status: 500,
					headers: { "Content-Type": "application/json", ...corsHeaders }
				})
			}

			let gifId = url.pathname.replace("/gifs", "")
			if (gifId.startsWith("/")) {
				gifId = gifId.slice(1)
			}

			try {
				// Build Tenor API URL for getting a GIF by ID
				const params = new URLSearchParams({
					key: TENOR_API_KEY,
					client_key: TENOR_CLIENT_KEY,
					ids: gifId,
					media_filter: "webm,mp4,webp,tinywebm"
				})
				const tenorUrl = `https://tenor.googleapis.com/v2/posts?${params}`

				// Fetch data from Tenor
				const response = await fetch(tenorUrl)
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`)
				}

				// Parse and send data back to client
				const result = await response.json() as { results: TenorResult[] }
				const gifResult = result.results[0]
				if (!gifResult) {
					throw new Error("Invalid gif result")
				}
				const gif:GifResult = {
					id: gifResult.id,
					source: result.results[0].media_formats.webm?.url,
					sourceFallback: gifResult.media_formats.mp4?.url,
					preview: gifResult.media_formats.webp?.url,
					width: gifResult.media_formats.webm?.dims[0],
					height: gifResult.media_formats.webm?.dims[1],
					description: gifResult.content_description,
				}
				return new Response(JSON.stringify(gif), {
					status: 200,
					headers: { "Content-Type": "application/json", ...corsHeaders }
				})
			}
			catch (e) {
				console.error("Error fetching GIFs:", e)
				return new Response("Failed to load GIF", {
					status: 500,
					headers: { "Content-Type": "application/json", ...corsHeaders }
				})	
			}
		}
		// Chat message history API
		else if (url.pathname.startsWith("/live-chat/messages") && req.method === "GET") {
			// Parse query parameters
			const query = url.searchParams;
			const messageId = parseInt(query.get("messageId") || "");
			const count = parseInt(query.get("count") || "50");
			const before = query.get("before") === "1" || query.get("before")?.toLowerCase() === "true";
			const channel = query.get("channel") || "global";

			// Validate parameters
			if (isNaN(messageId)) {
				return new Response("Missing or invalid messageId parameter", {
					status: 400,
					headers: corsHeaders
				});
			}
			if (isNaN(count) || count < 1 || count > 127) {
				return new Response("Count must be between 1-127", {
					status: 400,
					headers: corsHeaders
				});
			}

			try {
				// Fetch chat history from database
				const messageHistory = await makeDbRequest("getLiveChatHistory", { 
					messageId, 
					count, 
					before, 
					channel 
				}) as any[];

				// Process messages and collect usernames
				const users: Record<number, string> = {};
				const messages = messageHistory.map(row => {
					users[row.senderIntId] = row.chatName;
					
					return {
						id: row.messageId,
						senderIntId: row.senderIntId,
						channel: row.channel,
						date: Math.floor(row.sendDate / 1000),
						message: censorText(row.message),
						repliesTo: row.repliesTo
					};
				});

				// Create combined response
				const response = {
					messages,
					users
				};

				return new Response(JSON.stringify(response), {
					status: 200,
					headers: { 
						"Content-Type": "application/json",
						...corsHeaders
					}
				});
			}
			catch (error) {
				console.error("Error fetching chat history:", error);
				return new Response("Internal server error", {
					status: 500,
					headers: corsHeaders
				});
			}
		}
		else if (!url.pathname || url.pathname === "/") {
			const isWebSocketRequest = req.headers.get("upgrade")?.toLowerCase() === "websocket" &&
				req.headers.get("connection")?.toLowerCase()?.includes("upgrade")
			if (isWebSocketRequest) {
				let newToken: string | null = null
				if (!userToken) {
					newToken = randomString(32)
				}
				const upgradeSuccess = server.upgrade(req, {
					data: {
						url: url.pathname.slice(1).trim(),
						headers: req.headers,
						token: userToken || newToken
					},
					headers: {
						"Access-Control-Allow-Origin": "*",
						"Access-Control-Allow-Credentials": "true",
						"Set-Cookie": cookie.serialize(uidToken, newToken || userToken, {
							domain: url.hostname,
							expires: new Date(4e12),
							httpOnly: true,
							sameSite: CORS_COOKIE ? "lax" : "none",
							secure: SECURE_COOKIE,
							path: "/"
						}),
					}
				})
				if (upgradeSuccess) {
					return undefined
				}
				// If ws upgrade failed, send 426 Upgrade Required
				return new Response(null, { status: 426 })
			}

			// Handle canvas info query (HTTP)
			const instanceInfo = {
				version: "legacy",
				instance: {
					id: CANVAS_ID,
					name: CANVAS_NAME,
					icon: CANVAS_ICON
				},
				canvas: {
					width: WIDTH,
					height: HEIGHT,
					cooldown: COOLDOWN
				}
			}
			return new Response(JSON.stringify(instanceInfo), {
				status: 200,
				headers: corsHeaders
			})
		}
		else {
			return new Response("Not found", {
				status: 404,
				headers: corsHeaders
			})
		}
	},
	websocket: {
		async open(ws: ServerWebSocket<ClientData>) {
			wss.clients.add(ws)
			let realIp:string|undefined = ws.data.ip
			if (USE_CLOUDFLARE) realIp = ws.data.headers.get("cf-connecting-ip")?.split(":", 4).join(":")
			if (!realIp) realIp = ws.data.headers.get("x-forwarded-for")?.split(",")[0]?.split(":", 4).join(":")
			if (!realIp) realIp = ws.remoteAddress.split(":", 4).join(":")
			if (!realIp || realIp.startsWith("%")) return ws.close(4000, "No IP")
			const IP = ws.data.ip = realIp
			const URL = ws.data.url
			if (!isUser(IP)) {
				ws.close(4000, "Not user")
				return
			}
			const USER_AGENT = ws.data.headers.get("User-Agent")
			if (!USER_AGENT) {
				ws.close(4000, "No agent")
				return
			}
			let chatName:string|null = null
			const ORIGIN = ws.data.headers.get("Origin")
			if (ORIGIN == null || (ORIGINS && !ORIGINS.includes(ORIGIN))) {
				return ws.close(4000, "No origin")
			}
			if (BLACKLISTED.has(IP)) return ws.close()
			ws.subscribe("all") // receive all ws messages
			ws.data.cd = COOLDOWN
			if (URL) {
				const codeHash = sha256(URL)
				const vip = VIP.get(codeHash)
				if (!vip) {
					return ws.close(4000, "Invalid VIP code. Please do not try again")
				}
				const existingVip = activeVips.get(codeHash)
				existingVip?.close(4000, "You have connected with this VIP code on another session")
				activeVips.set(codeHash, ws)
				ws.data.codeHash = codeHash
				ws.data.perms = vip.perms
				ws.data.cd = vip.cooldownMs
				if (vip.enforceChatName) {
					chatName = vip.enforceChatName
				}
			}
			const CD = ws.data.cd

			if (ws.data.perms !== "admin" && ws.data.perms !== "canvasmod") {
				if (CAPTCHA) {
					await forceCaptchaSolve(ws)
				}
				if (PERIODIC_CAPTCHA_INTERVAL_SECS > 0) {
					ws.data.lastPeriodCaptcha = NOW
				}
				if (CHALLENGE) {
					ws.data.challenge = "pending"
				}
				if (TURNSTILE) {
					const turnstileBuffer = encoderUTF8.encode("\x18" + TURNSTILE_SITE_KEY)
					ws.send(turnstileBuffer)
					ws.data.turnstile = "active"
				}
			}
			ws.data.lastChat = 0 //last chat
			ws.data.connDate = NOW //connection date
			ws.data.previousLiveChats = [] // previous live chat messages
			ws.data.previousPlaceChats = [] // previous place chat messages

			const cooldownBuffer = Buffer.alloc(9)
			cooldownBuffer[0] = 1
			cooldownBuffer.writeUint32BE(Math.ceil((cooldowns.get(IP)||0) / 1000) || 1, 1)
			cooldownBuffer.writeUint32BE(CD + Math.min(500, 0.1 * CD), 5)
			ws.send(cooldownBuffer)
			ws.send(infoBuffer)
			ws.send(runLengthChanges())

			// Notify the client about any active canvas restrictions
			if (LOCKED) {
				const restrictionsBuffer = Buffer.alloc(2)
				restrictionsBuffer[0] = 8
				restrictionsBuffer[1] = 1
				ws.send(restrictionsBuffer)
			}

			// If a custom palette is defined, then we send to client
			// http://www.shodor.org/~efarrow/trunk/html/rgbint.html
			if (Array.isArray(PALETTE) || PALETTE_USABLE_REGION) {
				const usingPalette = Array.isArray(PALETTE) ? PALETTE : DEFAULT_PALETTE
				let pi = 0
				const paletteBuffer = Buffer.alloc(4 + usingPalette.length * 4)
				paletteBuffer[pi++] = 0
				paletteBuffer[pi++] = usingPalette.length
				for (let i = 0; i < usingPalette.length; i++) {
					paletteBuffer.writeUInt32BE(usingPalette[i], pi); pi += 4
				}
				const usableRegion = PALETTE_USABLE_REGION || { start: 0, end: usingPalette.length }
				paletteBuffer[pi++] = usableRegion.start
				paletteBuffer[pi++] = usableRegion.end
				ws.send(paletteBuffer)
			}

			// This section is the only potentially hot DB-related code in the server, investigate optimisatiions
			const intId = await makeDbRequest("authenticateUser", { token: ws.data.token, ip: IP, userAgent: USER_AGENT })
			if (intId == null || typeof intId != "number") {
				console.error(`Could not authenticate user ${IP}, user ID was null, even after new creation`)
				return ws.close()
			}
			ws.data.intId = intId
			playerIntIds.set(ws, intId)
			const pIdBuf = Buffer.alloc(5)
			pIdBuf.writeUInt8(11, 0) // TODO: Integrate into packet 1
			pIdBuf.writeUInt32BE(intId, 1)
			ws.send(pIdBuf)

			if (ws.data.codeHash) {
				postDbMessage("updateUserVip", { intId: intId, codeHash: ws.data.codeHash })
			}
			await applyPunishments(ws, intId, IP)

			chatName ??= await makeDbRequest("getUserChatName", intId) as string
			if (chatName) {
				ws.data.chatName = chatName
				playerChatNames.set(intId, chatName)
				// Alert all other players of this player's name
				const pNameInfoBuf = createNamePacket(chatName, intId)
				for (const p of wss.clients) {
					if (p !== ws) {
						ws.send(pNameInfoBuf)
					}
				}
			}
			// Alert this player of all player's names
			const nmInfoBuf = createNamesPacket(playerChatNames)
			ws.send(nmInfoBuf)
		},
		async message(ws:ServerWebSocket<ClientData>, data:string|Buffer) {
			if (typeof data === "string") return
			// Redefine as message handler is now separate from open
			const IP = ws.data.ip
			const CD = ws.data.cd

			switch (data[0]) {
				case 4: { // pixel place
					if (data.length < 6 || ws.data.shadowBanned === true) {
						return
					}
					const i = data.readUInt32BE(1)
					const c = data[5]
					const cd = cooldowns.get(IP) || COOLDOWN
					const PALETTE_SIZE = PALETTE?.length || 32
					const usablePalette = PALETTE_USABLE_REGION || { start: 0, end: PALETTE_SIZE }
					if (i >= BOARD.length || c < usablePalette.start || c >= usablePalette.end) {
						return
					}
					if (LOCKED === true || toValidate.has(ws) || bans.has(IP) || cd > NOW
						|| ws.data.challenge === "active" || ws.data.turnstile === "active") {
						rejectPixel(ws, i, cd)
						return
					}
					// On first pixel place, give them a challenge
					if (CHALLENGE && padlock && ws.data.challenge === "pending") {
						ws.send(padlock.requestChallenge(ws))
						ws.data.challenge = "active"
					}
					// If the time since last periodic captcha is above the interval, give them new captcha & reset period
					if (PERIODIC_CAPTCHA_INTERVAL_SECS > 0 && (NOW - ws.data.lastPeriodCaptcha) / 1000 > PERIODIC_CAPTCHA_INTERVAL_SECS) {
						await forceCaptchaSolve(ws)
						ws.data.lastPeriodCaptcha = NOW
					}
					if (applyPreban(i % WIDTH, Math.floor(i / HEIGHT), ws)) {
						rejectPixel(ws, i, cd)
						return
					}
					CHANGES[i] = c
					PLACERS.writeUInt32BE(ws.data.intId, i * 4) 
					// Damn you, blob!
					cooldowns.set(IP, NOW + CD)
					newPixels.push({ index: i, colour: c, placer: ws })
					postDbMessage("updatePixelPlace", ws.data.intId)
					break
				}
				case 9: { // Get region pixel placer info
					if (!INCLUDE_PLACER) {
						return
					}
					let boardI = data.readUInt32BE(1)
					const startX = boardI % WIDTH
					const startY = Math.floor(boardI / WIDTH) 
					const regionWidth = data[5] + startX > WIDTH ? WIDTH - startX : data[5]
					const regionHeight = data[6] + startY > HEIGHT ? HEIGHT - startY : data[6]
					if (regionWidth < 0 || regionWidth > 255 || regionHeight < 0 || regionHeight > 255) {
						return
					}
					const regionSize = regionWidth * regionHeight * 4
					const placerInfoBuf = Buffer.alloc(7 + regionSize)
					placerInfoBuf[0] = 9
					placerInfoBuf.writeUInt32BE(boardI, 1)
					placerInfoBuf[5] = regionWidth
					placerInfoBuf[6] = regionHeight
					for (let pi = 7; pi < placerInfoBuf.byteLength; pi += regionWidth * 4) {
						// We need to reinterpret PLACERS as a uint8 array for set to work properly
						const placersXLine = PLACERS.subarray(boardI*4, (boardI + regionWidth)*4)
						placerInfoBuf.set(placersXLine, pi)
						boardI += WIDTH
					}
					ws.send(placerInfoBuf)
					break
				}
				case 18: { // Live chat reaction
					const messageId = data.readUInt32BE(1)
					const reactionKey = data.subarray(5).toString()
					// Validate reaction
					if (!DEFAULT_EMOJIS.has(reactionKey) && !DEFAULT_CUSTOM_EMOJIS.has(reactionKey)) {
						break
					}
					postDbMessage("addLiveChatReaction", { messageId, reaction: reactionKey, senderIntId: ws.data.intId })
					
					const encodedReaction = encoderUTF8.encode(reactionKey)
					const reactionBuf = Buffer.alloc(9 + encodedReaction.byteLength)
					reactionBuf[0] = 18
					reactionBuf.writeUint32BE(messageId, 1)
					reactionBuf.writeUint32BE(ws.data.intId, 5)
					reactionBuf.set(encodedReaction, 9)
					wss.publish("all", reactionBuf)
					break
				}
				case 12: { // Submit name
					const nameCooldown = chatNameCooldowns.get(ws.data.ip) ||  0
					if (nameCooldown > NOW) {
						return
					}
					chatNameCooldowns.set(ws.data.ip, NOW + chatNameCooldownMs)
					let name = decoderUTF8.decode(data.subarray(1))
					const resName = RESERVED_NAMES.getReverse(name) // reverse = valid code, use reserved name, forward = trying to use name w/out code, invalid
					name = resName ? resName + "✓" : censorText(name.replace(/\W+/g, "").toLowerCase()) + (RESERVED_NAMES.getForward(name) ? "~" : "")
					if (!name || name.length > 16) return

					// Update chatNames so new players joining will also see the name and pass to DB
					ws.data.chatName = name
					playerChatNames.set(ws.data.intId, name)
					postDbMessage("setUserChatName", { intId: ws.data.intId, newName: name })

					// Combine with player intId and alert all other clients of name change
					const nmInfoBuf = createNamePacket(name, ws.data.intId)
					wss.publish("all", nmInfoBuf)
					break
				}
				case 13: { // Live chat history
					const messageId = data.readUint32BE(1)
					const count = data[5] & 127
					const before = Boolean(data[5] >> 7)
					const encChannel = data.subarray(6)
					const channel = decoderUTF8.decode(encChannel)
					const messageHistory = await makeDbRequest("getLiveChatHistory", { messageId, count, before, channel }) as any[]

					const messages:Buffer[] = []
					const usernames = new Map() // TODO: Insert reactor usernames
					let size = 7 + encChannel.byteLength
					for (const row of messageHistory) {
						usernames.set(row.senderIntId, row.chatName)
						const censoredMessage = censorText(row.message)
						const messageData = createChatPacket(0, censoredMessage, Math.floor(row.sendDate / 1000), row.messageId,
							row.senderIntId, row.channel, row.repliesTo)
						// We overwrite the first two bytes (would be packetcode and type) for length. Could overflow if txt is 100% of the 2 byte max len (unlikely)
						messageData.writeUint16BE(messageData.byteLength, 0)
						size += messageData.byteLength
						messages.push(messageData)
					}

					// Client may race between applying intId:name bindings and inserting the new messages w/ usernames - Not our problem!
					const nmInfoBuf = createNamesPacket(usernames)
					ws.send(nmInfoBuf)

					let i = 0
					const historyBuffer = Buffer.alloc(size)
					historyBuffer[i++] = 13
					historyBuffer.writeUInt32BE(messageId, i); i += 4
					historyBuffer[i++] = data[5]
					historyBuffer[i++] = encChannel.byteLength
					historyBuffer.set(encChannel, i); i += encChannel.byteLength
					for (const message of messages) {
						message.copy(historyBuffer, i, 0, message.byteLength)
						i += message.byteLength
					}
					ws.send(historyBuffer)
					break
				}
				case 14: { // Live chat report
					const reportCooldown = reportCooldowns.get(ws.data.ip) ||  0
					if (reportCooldown > NOW) {
						return
					}
					reportCooldowns.set(ws.data.ip, NOW + reportCooldownMs)
					const messageId = data.readUInt32BE(1)
					const reason = data.subarray(5, Math.min(data.byteLength, 280)).toString()
					const message = await makeDbRequest("getLiveChatMessage", messageId) as LiveChatMessage|null
					if (message == null) {
						return
					}
					const messageSenderName = await makeDbRequest("getUserChatName", message.senderIntId)
					// TODO: Sus - Live chat message may not be in DB by time report is received, could cause a missing foreign key reference
					postDbMessage("insertLiveChatReport", { reporterId: ws.data.intId, messageId: messageId, reason: reason })
	
					const sanitisedChannel = message.channel.replaceAll("```", "`​`​`​")
					const sanitisedMessage = message.message.replaceAll("```", "`​`​`​")
					modWebhookLog(`User **#${ws.data.intId}** (**${ws.data.chatName}**) reported live chat message:\n` +
						`Id: **${message.messageId}**\nChannel: **${sanitisedChannel}**\nSender: **#${message.senderIntId} (${messageSenderName})**\n` +
						`Send date: **${new Date(message.sendDate).toISOString()}**\n` +
						`Message:\n\`\`\`\n${sanitisedMessage}\n\`\`\`\n`)
					break
				}
				case 15: { // Chat
					if (ws.data.lastChat + (CHAT_COOLDOWN_MS || 2500) > NOW
						|| data.length > (CHAT_MAX_LENGTH || 400) || bans.has(IP) || mutes.has(IP)
						|| ws.data.shadowBanned === true) {
						return
					}
					ws.data.lastChat = NOW

					// These may or may not be defined depending on message type
					let channel:string|null = null
					let positionIndex = null
					let repliesTo = null

					let offset = 1
					const type = data.readUInt8(offset++)
					const msgLength = data.readUInt16BE(offset); offset += 2
					const message = decoderUTF8.decode(data.subarray(offset, offset + msgLength)); offset += msgLength
					if (type == 0) { // Live chat message
						const channelLength = data.readUInt8(offset); offset++
						channel = decoderUTF8.decode(data.subarray(offset, offset + channelLength)); offset += channelLength

						// If the packet included a message ID it replies to, we include it
						if (data.byteLength - offset >= 4) {
							repliesTo = data.readUInt32BE(offset)
						}
					}
					else {
						positionIndex = data.readUint32BE(offset)
					}
					if ((type === 0 && !channel) || !message) {
						return
					}

					// Similar messages spam
					const previousBucket = type == 0 ? ws.data.previousLiveChats : ws.data.previousPlaceChats
					while (previousBucket.length > previousBucketMax) {
						previousBucket.shift()
					}
					const msgSimilar = isSimilarToPrevious(message, previousBucket)
					previousBucket.push(message)
					if (msgSimilar) {
						const spamChatPacket = createChatPacket(type, "Your message was filtered for spam", Math.floor(NOW / 1000), 0, 0, channel, null, null, positionIndex)
						ws.send(spamChatPacket)
						return
					}

					// Accept
					let messageId = 0
					if (type === 0 && channel != null) {
						messageId = ++liveChatMessageId
						const liveChat:LiveChatMessage = { messageId, message: message, sendDate: NOW, channel, senderIntId: ws.data.intId, repliesTo: null, deletionId: null }
						postDbMessage("insertLiveChat", liveChat)
					}
					else if (positionIndex != null) {
						messageId = ++placeChatMessageId
						postDbMessage("insertPlaceChat", { messageId,
							message: message, sendDate: NOW, senderIntId: ws.data.intId, x: Math.floor(positionIndex % WIDTH),
							y: Math.floor(positionIndex / HEIGHT) })
					}

					// Profanity filters
					let censoredMessage = censorText(message)
					if (ws.data.perms !== "admin" && ws.data.perms !== "vip" && ws.data.perms !== "chatmod") {
						censoredMessage = censoredMessage.replaceAll("@everyone", "*********")
						censoredMessage = censoredMessage.replaceAll("@here", "*****")
					}
					else if (ws.data.perms !== "admin") {
						censoredMessage = censoredMessage.replaceAll("@everyone", "*********")
					}

					const censoredChatPacket = createChatPacket(type, censoredMessage, Math.floor(NOW / 1000), messageId, ws.data.intId,
						channel, repliesTo, null, positionIndex)
					if (censoredMessage !== message) {
						const chatPacket = createChatPacket(type, message, Math.floor(NOW / 1000), messageId, ws.data.intId,
							channel, repliesTo, null, positionIndex)
						for (const p of wss.clients) {
							p.send(p === ws ? chatPacket : censoredChatPacket)
						}
					}
					else { // Performance shortcut
						wss.publish("all", censoredChatPacket)
					}

					if (!CHAT_WEBHOOK_URL) break
					try {
						if (channel != null) {
							const hookName = ws.data.chatName?.replaceAll("@", "@​")
							const hookChannel = channel.replaceAll("@", "@​")
							const hookMessage = censoredMessage.replaceAll("@", "@​")
							const msgHook = { username: `[${hookChannel || "place chat"}] ${hookName || "anon"} @rplace.live`, content: hookMessage }
							fetch(CHAT_WEBHOOK_URL + "?wait=true", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(msgHook) })
						}
					}catch (err){ console.log("Could not post chat message to discord: " + err) }
					break
				}
				case 16: { // Captcha response
					const response = data.subarray(1).toString()
					const info = toValidate.get(ws)
					if (info && response === info.answer && info.start + CAPTCHA_EXPIRY_SECS * 1000 > NOW) {
						captchaFailed.delete(IP)
						toValidate.delete(ws)
						const captchaSuccessBuf = Buffer.from([16])
						ws.send(captchaSuccessBuf)
					}
					else {
						const prev = captchaFailed.get(IP)
						// Block bots attempting to bruteforce captcha quickly
						if (prev && NOW - prev.last < CAPTCHA_MIN_MS) prev.fails += 3
						const info = { fails: (prev?.fails || 0) + 1, last: NOW }
						captchaFailed.set(IP, info)
						const acceptableFails = 6 // TODO: Math.min(zcaptcha.config.dummiesCount / 2, 10)
						if (info.fails < acceptableFails) return ws.close()
						const banLengthS = (info.fails - acceptableFails + 1) ** 2 * 60
						ban(ws.data.intId, banLengthS, `${info.fails} captcha fails since ${
							new Date(ws.data.connDate).toLocaleString()}`)
						modWebhookLog(`Client **${IP}** **banned** by server for **${banLengthS
							}** seconds for failing captcha **${info.fails}** times`)
					}
					break
				}
				case 23: {
					if (!padlock) {
						return ws.close(4000, "Invalid solve packet")
					}
					const result = await padlock.verifySolution(ws, data)
					if (result === "badpacket" || result === "nosolution") {
						return ws.close(4000, "Invalid solve packet")
					}
					if (result === false) {
						modWebhookLog(`Client ${IP}/${ws.data.intId} failed verification challenge, kicking`)
						ws.close(4000, "No solution")
						return
					}
					else {
						delete ws.data.challenge
					}
					break
				}
				case 24: {
					const turnstileToken = decoderUTF8.decode(data.buffer.slice(1))
					if (!turnstileToken) return ws.close(4000, "Invalid turnstile packet")
					const outcome = await verifyTurnstile(turnstileToken, ws.data.ip)
					switch (outcome.result) {
						case "error": {
							modWebhookLog(`Couldn't verify turnstile for client ${IP}/${ws.data.intId} bad cloudflare HTTP response, kicking`)
							return ws.close(4000, "Internal turnstile fail")
						}
						case "fail": {
							modWebhookLog(`Client ${IP}/${ws.data.intId} gave an incorrect turnstile token, kicking`)
							return ws.close(4000, "No turnstile")
						}
						default: {
							const turnstileSuccessBuf = Buffer.from([25])
							ws.send(turnstileSuccessBuf)
							delete ws.data.turnstile
							break
						}
					}
					break
				}
				case 30: { // Client activity webdriver
					const activityCooldown = activityCooldowns.get(ws.data.ip) ||  0
					if (activityCooldown > NOW) {
						return
					}
					activityCooldowns.set(ws.data.ip, NOW + activityCooldownMs)
					if (data.byteLength > 1025) {
						return
					}
					const detail = decoderUTF8.decode(data.buffer.slice(1))
					ws.data.shadowBanned = true
					const sanitisedDetail = detail.replaceAll("```", "`​`​`​")
					modWebhookLog("Client activity reported webdriver usage:\nClient data:\n```\n" +
						`Ip: ${ws.data.ip}\nChat name: ${ws.data.chatName}\nUser ID: ${ws.data.intId}\nPerms: ${ws.data.perms}\nHeaders: ${JSON.stringify(ws.data.headers, null, 4)}\n` +
						`Connect date: ${new Date(ws.data.connDate).toLocaleString()}\nLast period captcha: ${new Date(ws.data.lastPeriodCaptcha).toLocaleString()}\n` +
						`\`\`\`\nClient details (untrusted):\n\`\`\`\n${sanitisedDetail}\n\`\`\`\nServer has temporarily shadowbanned this connection.`)
					break
				}
				case 96: { // Set preban
					let offset = 1
					if (ws.data.perms !== "admin" && ws.data.perms !== "canvasmod") return
					const violation = data[offset++] // 0 - kick, 1 - ban, 2 - nothing (log)
					const startI = data.readUint32BE(offset); offset += 4
					const endI = data.readUint32BE(offset); offset += 4
					const x1 = startI % WIDTH
					const y1 = Math.floor(startI / WIDTH)
					const x2 = endI % WIDTH
					const y2 = Math.floor(endI / WIDTH)

					modWebhookLog(`Moderator (${ws.data.codeHash}) requested to **set preban area** from (${
						x1}, ${y1}) to (${x2}, ${y2}), with violation action ${["kick", "ban", "none"][violation]}`)
					break
				}
				case 98: { // User moderation
					if (ws.data.perms !== "admin" && ws.data.perms !== "chatmod") return
					let offset = 1
					const action = data[offset++]

					switch (action) {
						case 0: { // Kick
							const actionIntId = data.readUInt32BE(offset); offset += 4
							const actionReason = data.slice(offset, Math.min(data.byteLength, 300 + offset)).toString()
							if (actionReason.length == 0) return

							let actionCli:ServerWebSocket<ClientData>|null = null
							for (const [p, uid] of playerIntIds) {
								if (uid === actionIntId) actionCli = p
							}
							if (actionCli === null) return

							if (action == 0) { // kick
								modWebhookLog(`Moderator (${ws.data.codeHash}) requested to **kick** user **${
									actionCli.data.ip}**, with reason: '${
									actionReason.replaceAll("@", "@​")}'`)
								actionCli.close()
							}
							break
						}
						case 1: // Mute
						case 2: { // Ban
							const actionIntId = data.readUInt32BE(offset); offset += 4
							const actionTimeS = data.readUInt32BE(offset); offset += 4
							const actionReason = data.slice(offset, Math.min(data.byteLength, 300 + offset)).toString()
							if (actionReason.length == 0) return

							let actionCli:ServerWebSocket<ClientData>|null = null
							for (const [p, uid] of playerIntIds) {
								if (uid === actionIntId) actionCli = p
							}
							if (actionCli == null) return

							modWebhookLog(`Moderator (${ws.data.codeHash}) requested to **${["mute", "ban"][action - 1]
								}** user **${actionCli.data.intId} (${actionCli.data.chatName})**, for **${formatTimeSeconds(actionTimeS)}** seconds, with reason: '${
								actionReason.replaceAll("@", "@​")}'`)

							if (action == 1) mute(actionIntId, actionTimeS, actionReason, ws.data.intId)
							else ban(actionIntId, actionTimeS, actionReason, ws.data.intId)
							break
						}
						case 3: { // Force captcha revalidation
							const actionIntId = data.readUInt32BE(offset); offset += 4
							const actionReason = data.subarray(offset, Math.min(data.byteLength, 300 + offset)).toString()
							if (actionReason.length == 0) return

							let actionCli:ServerWebSocket<ClientData>|null = null
							if (actionIntId !== 0) {
								for (const [p, uid] of playerIntIds) {
									if (uid === actionIntId) actionCli = p
								}
								if (actionCli == null) return

								await forceCaptchaSolve(actionCli)
							}
							else {
								for (const p of wss.clients) {
									forceCaptchaSolve(p)
								}
							}

							modWebhookLog(`Moderator (${ws.data.codeHash}) requested to **force captcha revalidation** for ${
								actionIntId === 0 ? "**__all clients__**" : ("user **" + actionCli?.data.ip + "**")}, with reason: '${
								actionReason.replaceAll("@", "@​")}'`)
							break
						}
						case 4: { // Delete chat message
							const actionMsgId = data.readUInt32BE(offset); offset += 4
							const actionReason = data.subarray(offset, Math.min(data.byteLength, 300 + offset)).toString()
							if (actionMsgId === 0 || actionReason.length == 0) return

							postDbMessage("deleteLiveChat", {
								messageId: actionMsgId,
								reason: actionReason,
								moderatorIntId: ws.data.intId })

							const deleteBuf = Buffer.allocUnsafe(9)
							deleteBuf[0] = 17
							deleteBuf.writeUInt32BE(actionMsgId, 1)
							wss.publish("all", deleteBuf)

							modWebhookLog(`Moderator (${ws.data.codeHash}) requested to **delete chat message** with id ${actionMsgId
								}, with reason: '${actionReason.replaceAll("@", "@​")}'`)
							break
						}
					}
					break
				}
				case 99: {
					if (ws.data.perms !== "admin" && ws.data.perms !== "canvasmod") return
					const w = data[1]
					let i = data.readUInt32BE(2)
					const h = Math.floor((data.length - 6) / w)
					if (i % WIDTH + w >= WIDTH || i + h * WIDTH >= WIDTH * HEIGHT) return

					let hi = 6
					const target = w * h + 6

					while (hi < target) {
						CHANGES.set(data.subarray(hi, hi + w), i)
						i += WIDTH
						hi += w
					}

					modWebhookLog(`Moderator (${ws.data.codeHash}) requested to **rollback area** at (${
						i % WIDTH}, ${Math.floor(i / WIDTH)}), ${w}x${h}px (${w * h} pixels changed)`)
					break
				}
				case 110: {
					const linkKey = randomString(32)
					linkKeyInfos.set(linkKey, { intId: ws.data.intId, dateCreated: Date.now(), canvasId: CANVAS_ID })
					const linkKeyBytes = encoderUTF8.encode(linkKey)
					const linkResponseBuf = Buffer.alloc(5 + linkKeyBytes.byteLength)
					linkResponseBuf[0] = 110
					linkResponseBuf.writeUInt32BE(CANVAS_ID, 1)
					linkResponseBuf.set(linkKeyBytes, 5)
					ws.send(linkResponseBuf)
					break
				}
			}
		},
		async close(ws:ServerWebSocket<ClientData>, code: number, message: string) {
			playerChatNames.delete(ws.data.intId)
			playerIntIds.delete(ws)
			toValidate.delete(ws)
			activeVips.delete(ws.data.codeHash)
			dbWorker.postMessage({ call: "exec", data: {
				stmt: "UPDATE Users SET playTimeSeconds = playTimeSeconds + ?1 WHERE intId = ?2",
				params: [ Math.floor((NOW - ws.data.connDate) / 1000), ws.data.intId ] } })
			wss.clients.delete(ws)
		},
		perMessageDeflate: false,
	},
	port: PORT
}
if (SECURE) {
	// NOTE: Bun may segfault when giving a TLS cert and key path that doesn't exist
	// Path to certbot certificate, i.e: etc/letsencrypt/live/server.rplace.live/fullchain.pem,
	// Path to certbot key, i.e: etc/letsencrypt/live/server.rplace.live/privkey.pem
	const cert = Bun.file(CERT_PATH)
	const key = Bun.file(KEY_PATH)
	if (cert.size !== 0 && key.size !== 0) {
		serverOptions.tls = { cert, key }
	}
	else {
		throw new Error("Could not start server with SECURE, cert and key file could not be opened.")
	}
}
const wss: RplaceServer = Object.assign(
	Bun.serve(serverOptions),
	{
		clients: new Set<ServerWebSocket<ClientData>>()
	}
)

/**
 * Log a moderation-only message to console, the mod webhook, and the mod log text file
 * @param {string} message Raw composite string message to be logged
 */
async function modWebhookLog(message:string) {
	const messageString = `[${new Date().toLocaleString()}] ${message}`
	console.log(messageString)
	fs.appendFile("./modlog.txt", messageString+"\n\n---\n\n")

	if (MOD_WEBHOOK_URL) {
		message = message.replace("@", "@​")
		const msgHook = { username: "RPLACE SERVER", content: message }
		await fetch(MOD_WEBHOOK_URL + "?wait=true", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(msgHook) })    
	}
}

let NOW = Date.now()
setInterval(() => {
	NOW = Date.now()
}, 50)

let currentCaptcha:zcaptcha.GeneratedCaptcha|null = zcaptcha.genEmojiCaptcha
try {
	zcaptcha.init()
}
catch (e) {
	currentCaptcha = null
}

// Max prev live chat messages to compare
let previousBucketMax = 5
// <5 chars, < 50 chars, < 150 chars, >= 150 chars
let similarThresholdWord = 0.6 // word must be an exact match to 60% of prev
let similarThresholdShort = 5 
let similarThresholdMedium = 10
let similarThresholdLong = 20 

/**
 * Uses levenstein distance & fuzzy heuristics to determine message
 * similarity to previous messages, weighing the oldest previous message lower in
 * the mean distance than the most recent previous message, etc
 * @param {string} message Current message being compared
 * @param {string} previous Array of previous messages (first - oldest, last - most recent)
 */
function isSimilarToPrevious(message: string, previous: string[]): boolean {
	if (message.length < 5) {
		let totalSame = 0
		for (const prevMessage of previous) {
			if (prevMessage === message) {
				totalSame++
			}
		}
		return totalSame / previous.length >= similarThresholdWord
	}
	else {
		const threshold = message.length < 50 ? similarThresholdShort
		: message.length < 150 ? similarThresholdMedium : similarThresholdLong 
   
		let totalWeight = 0
		let weightedSum = 0
		previous.forEach((prevMessage, index) => {
			const dist = distance(message, prevMessage)
			// Weight increases for more recent messages
			const weight = (index + 1) / previous.length
			totalWeight += weight
			weightedSum += dist * weight
		})

		// Average dist
		return weightedSum / totalWeight <= threshold
	}
}

async function verifyTurnstile(turnstileToken:string, ip:string) {
	const formData = new FormData()
	formData.append("secret", TURNSTILE_PRIVATE_KEY)
	formData.append("response", turnstileToken)
	formData.append("remoteip", ip)
	try {
		const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
			body: formData,
			method: "POST"
		})
		if (!response.ok) {
			return { result: "error", response }
		}
		const outcome:any = await response.json()
		return { result: outcome?.success ? "success" : "fail", response }
	}
	catch (error) {
		console.error("Error verifying Turnstile:", error)
		return { result: "error", error }
	}
}

/**
 * Force a client to redo the captcha
 * @param {string|number|import('bun').ServerWebSocket<any>} identifier - String client ip address, intId or client websocket instance
 */
async function forceCaptchaSolve(identifier:string|number|ServerWebSocket<ClientData>) {
	// @ts-ignore
	let cli = identifier
	if (typeof identifier === "number") {
		for (const p of wss.clients) {
			if (p.data.intId == identifier) {
				p.close()
			}
		}
	}
	else if (typeof identifier === "string") {
		for (const p of wss.clients) {
			if (p.data.ip === identifier) {
				cli = p
			}
		}
	}
	if (!cli || typeof cli !== "object") return

	try {
		if (currentCaptcha === null) {
			throw new Error("Could not generate captcha packet. Current captcha was null")
		}
		const result = currentCaptcha()
		if (!result) return cli.close()
		const encodedDummies = encoderUTF8.encode(result.dummies)

		toValidate.set(cli, { start: NOW, answer: result.answer })
		const dv = new DataView(new ArrayBuffer(3 + encodedDummies.byteLength + result.data.byteLength))
		if (currentCaptcha == zcaptcha.genTextCaptcha) {
			dv.setUint8(0, 20)
		}
		else if (currentCaptcha == zcaptcha.genMathCaptcha) {
			dv.setUint8(0, 21)
		}
		else if (currentCaptcha == zcaptcha.genEmojiCaptcha) {
			dv.setUint8(0, 22)
		}
		else {
			throw new Error("Could not generate captcha packet. Handler for packet code doesn't exist")
		}
		dv.setUint8(1, encodedDummies.byteLength)

		const dataArray = new Uint8Array(result.data)
		const dvArray = new Uint8Array(dv.buffer)
		dvArray.set(encodedDummies, 2)
		dvArray.set(dataArray, 2 + encodedDummies.byteLength)
		cli.send(dv)
	}
	catch (e) {
		console.error(e)
		cli.close()
	}
}

async function pushImage() {
	for (let i = BOARD.length - 1; i >= 0; i--) { if (CHANGES[i] != 255) BOARD[i] = CHANGES[i] }

	const metadata = {  palette: PALETTE, width: WIDTH, height: HEIGHT }
	try {
		await Bun.write(path.join(PUSH_PLACE_PATH, "metadata.json"), JSON.stringify(metadata))
		await Bun.write(path.join(PUSH_PLACE_PATH, "place"), BOARD)
		await fs.unlink(path.join(PUSH_PLACE_PATH, ".git/index.lock")).catch(_ => { })
	}
	catch (error) {
		console.error("Failed to write files:", error)
		return
	}

	try {
		const addResult = await $`git add -A`.cwd(PUSH_PLACE_PATH).quiet()
		if (addResult.exitCode != 0 && addResult.stderr) {
			console.error("Failed to push canvas backup image (failure during git add)\n", addResult.stderr.toString())
			return
		}
		const pushResult = await $`git commit -a -m 'Canvas backup'; git push --force ${PUSH_LOCATION}`.cwd(PUSH_PLACE_PATH).quiet()
		if (pushResult.exitCode != 0 && pushResult.stderr) {
			console.error("Failed to push canvas backup image (fail during push)\n", pushResult.stderr.toString())
			return
		}
	}
	catch (error) {
		console.error("Failed to execute git commands:", error)
		return
	}

	// [If successful push] Serve old changes for 11 more mins before wipe just to be 100% safe
	// of slow git sync or http canvas file server caching...
	const curr = new Uint8Array(CHANGES)
	setTimeout(() => {
		// After 11 minutes, remove all old changes. Where there is a new change, curr[i] != CHANGES[i] and so it will be kept, but otherwise, remove
		for (let i = curr.length - 1; i >= 0; i--) {
			if (curr[i] == CHANGES[i]) CHANGES[i] = 255
		}
	}, 200e3)
}

// Rolling array of window size
let pastPxps:number[] = []
let pastPxpsMin = 10 // below = unchecked
let pastPxpsWindowSize = 60 // secs = n elements in pastPxps
let pastPxpsThresholdLow = 1.2 // 120% increase
let pastPxpsThresholdHigh = 3.5 // 350% increase
let pastPxpsActionDate = 0
let unlockTimeout: Timer|null = null

let pixelTick = 0
setInterval(function () {
	let pxps = 0
	for (const newPixel of newPixels) {
		if (newPixel.placer.data.perms !== "admin"
			&& newPixel.placer.data.perms !== "canvasmod") {
			pxps++
		}
	}
	// Above min check threshold, has been window size secs since last corrective action, captcha enabled
	if (pxps > pastPxpsMin && NOW - pastPxpsActionDate > pastPxpsWindowSize && PXPS_SECURITY) {
		const pastSum = pastPxps.reduce((acc, val) => acc + val, 0)
		const pastAverage = pastPxps.length > 0 ? pastSum / pastPxps.length : 0
		const pastIncrease = ((pxps - pastAverage) / pastAverage)

		if (pastIncrease > pastPxpsThresholdLow) {
			let mitigation = ""
			if (CAPTCHA) {
				mitigation = "Issuing captcha to **all non admin** clients."
				for (const p of wss.clients) {
					if (p.data.perms !== "admin") {
						forceCaptchaSolve(p)
					}
				}
			}
			if (pastIncrease > pastPxpsThresholdHigh) {
				const pxpsLogName = `${NOW}.pxpslog.txt`
				mitigation = `Forcing captcha for **all** non admin clients, ` +
					`dumping a list of **all** clients to ${pxpsLogName
					} and locking canvas for **${pastPxpsWindowSize}** seconds.`

				const reason = `Server anticheat - Locking canvas for **${pastPxpsWindowSize
					}** seconds. Sorry for the inconvenience!`
				const reasonBuffer = encoderUTF8.encode(reason)
				const restrictionsBuffer = Buffer.alloc(2 + reasonBuffer.byteLength)
				restrictionsBuffer[0] = 8
				restrictionsBuffer[1] = 1
				restrictionsBuffer.set(reasonBuffer, 2)

				LOCKED = true
				if (unlockTimeout) {
					clearTimeout(unlockTimeout)
				}
				unlockTimeout = setTimeout(() => {
					LOCKED = false
					const unrestrictionsBuffer = Buffer.alloc(2)
					unrestrictionsBuffer[0] = 8
					unrestrictionsBuffer[1] = 0
					wss.publish("all", unrestrictionsBuffer)
				}, pastPxpsWindowSize * 1000)

				const pxpsLogPath = `./${pxpsLogName}`
				if (!fs.exists(pxpsLogPath)) {
					fs.appendFile(pxpsLogPath, "ip,intId,connDate,lastPeriodCaptcha,perms")
				}
				for (const p of wss.clients) {
					fs.appendFile(pxpsLogPath, `\n${p.data.ip},${p.data.intId},${p.data.connDate
						},${p.data.lastPeriodCaptcha},${p.data.perms}`)
					p.send(restrictionsBuffer)
				}
			}

			modWebhookLog(`Detected unusual increase in pixels per second (average ${
				pastAverage / pastPxpsWindowSize}px/s over last ${pastPxpsWindowSize
				} seconds -> ${pxps}px/s (${pastIncrease * 100
				}% increase)). ${mitigation}`)

			pastPxpsActionDate = NOW
		}
	}
	pastPxps.push(pxps)
	if (pastPxps.length > pastPxpsWindowSize) {
		pastPxps.shift()
	}
	fs.appendFile("./pxps.txt", `\n${pxps},${NOW}`)

	// No new pixels
	if (newPixels.length !== 0) {
		let i = 1
		let newPixelsBuffer = null
		let newPixel = null
		if (INCLUDE_PLACER) {
			newPixelsBuffer = Buffer.alloc(1 + newPixels.length * 9)
			newPixelsBuffer[0] = 5
			while ((newPixel = newPixels.shift()) !== undefined) {
				newPixelsBuffer.writeInt32BE(newPixel.index, i); i += 4
				newPixelsBuffer[i++] = newPixel.colour
				newPixelsBuffer.writeInt32BE(newPixel.placer.data.intId, i); i += 4
			}
		}
		else {
			newPixelsBuffer = Buffer.alloc(1 + newPixels.length * 5)
			newPixelsBuffer[0] = 6
			while ((newPixel = newPixels.shift()) !== undefined) {
				newPixelsBuffer.writeInt32BE(newPixel.index, i); i += 4
				newPixelsBuffer[i++] = newPixel.colour
			}    
		}
		wss.publish("all", newPixelsBuffer)    
	}

	// Sweep up expired account linkages - 1 minute should be reasonable
	if (pixelTick % LINK_EXPIRY_SECS == 0) {
		for (const [key, info] of linkKeyInfos) {
			if (info.dateCreated + LINK_EXPIRY_SECS * 1000 < NOW) {
				linkKeyInfos.delete(key)
			}
		}
	}
	// Captcha tick
	if (pixelTick % CAPTCHA_EXPIRY_SECS == 0) {
		for (const [c, info] of toValidate.entries()) {
			if (info.start + CAPTCHA_EXPIRY_SECS * 1000 < NOW) {
				c.close()
				toValidate.delete(c.data.ip)
			}
		}

		// How long before the server will forget their captcha fails
		for (const [ip, info] of captchaFailed.entries()) {
			if (info.last + 2 ** info.fails < NOW) captchaFailed.delete(ip)
		}
	}
	pixelTick++
}, 1000)

let pushTick = 0
const infoBuffer = Buffer.alloc(3)
setInterval(async function () {
	pushTick++
	// Send periodic online players info
	infoBuffer[0] = 3 // @ts-ignore
	infoBuffer.writeUInt16BE(realPlayers + playersOffset, 1)
	wss.publish("all", infoBuffer) // @ts-ignore
	fs.appendFile("./stats.txt", "\n" + realPlayers + "," + NOW)

	if (LOCKED === true) {
		return
	}
	await Bun.write(path.join(PUSH_PLACE_PATH, "change" + (pushTick & 1 ? "2" : "")), CHANGES)
	if (INCLUDE_PLACER) {
		await Bun.write(path.join(PUSH_PLACE_PATH, "placers"), PLACERS)
	}
	if (pushTick % (PUSH_INTERVAL_MINS / 5 * 60) == 0) {
		try {
			await pushImage()
		} catch (e) {
			console.log("[" + new Date().toISOString() + "] Error pushing image", e)
		}
		for (const [k, t] of cooldowns) {
			if (t > NOW) cooldowns.delete(k)
		}
	}
}, 5000)

repl("|place$ ", (input:string) => console.log(eval(input)))

/**
 * Fill given canvas area with certain colour
 * @param {number} x - Start X of region
 * @param {number} y - Start Y of region
 * @param {number} x1 - End X of region
 * @param {number} y1 - End Y of region
 * @param {number} x - Int colour code index to be used
 * @param {boolean} random - Fill with random colours instead
 */
function fill(x: number, y: number, x1: number, y1: number, c = 27, random: boolean = false) {
	let w = x1 - x, h = y1 - y
	for (; y < y1; y++) {
		for (; x < x1; x++) {
			CHANGES[x + y * WIDTH] = random ? Math.floor(Math.random() * 24) : c
		}
		x = x1 - w
	}

	return `Filled an area of ${w}*${h} (${(w * h)} pixels), reload the game to see the effects`
}

type ActionFunc = (p: ServerWebSocket<any>, incomingX:number, incomingY:number) => boolean
type PrebanAction = ("kick"|"ban"|"blacklist"|"none"|ActionFunc)
interface PrebanArea {
	x: number
	y: number
	x1: number
	y1: number
	action: PrebanAction
}
const prebanArea:PrebanArea = { x: 0, y: 0, x1: 0, y1: 0, action: "kick" }
/**
 * This function is intended to allow us to ban any contributors to a heavily botted area (most likely botters)
 * by banning them as soon as we notice them placing a pixel in such area.
 * @param {number} _x - x start
 * @param {number} _y - y start
 * @param {number} _x1 - x end
 * @param {number} _y1 - y end
 * @param {PrebanAction} _action - The action to be performed on catch
 */
function setPreban(_x: number, _y: number, _x1: number, _y1: number, _action:"kick"|"ban"|"blacklist"|"none" = "kick") {
	prebanArea.x = _x; prebanArea.y = _y; prebanArea.x1 = _x1; prebanArea.y1 = _y1; prebanArea.action = _action
}
function clearPreban() {
	prebanArea.x = 0; prebanArea.y = 0; prebanArea.x1 = 0; prebanArea.y1 = 0; prebanArea.action = "kick"
}
function applyPreban(incomingX: number, incomingY: number, p: ServerWebSocket<ClientData>) {
	if (prebanArea.x == 0 && prebanArea.y == 0 && prebanArea.x1 == 0 && prebanArea.y1 == 0) return false
	if ((incomingX > prebanArea.x && incomingX < prebanArea.x1) && (incomingY > prebanArea.y && incomingY < prebanArea.y1)) {
		modWebhookLog(`Pixel placed in preban area at ${incomingX}, ${incomingY} by ${p.data.ip}`)

		if (typeof prebanArea.action === "function") {
			return prebanArea.action(p, incomingX, incomingY)
		}
		switch(prebanArea.action) {
			case "blacklist":
				blacklist(p.data.ip, "Violating canvas preban")
				return true
			case "ban":
				ban(p.data.intId, 0xFFFFFFFF / 1000, "Violating canvas preban")
				return true
			case "kick":
				p.close()
				return true
			case "none":
				return true
		}
	}

	return false
}



/**
 * Softban a client using their intId for a finite amount of time
 * @param {number} intId - Integer id of client that is to be banned
 * @param {number} duration - Integer duration (seconds) for however long this client will be muted for
 * @param {string?} reason - String reason for which client is being muted
 * @param {number?} modIntId - Responsible moderator integer ID
*/
async function ban(intId: number, duration: number, reason: string|null = null, modIntId: number|null = null) {
	const start = NOW
	const finish = start + duration * 1000
	const banDbData = {
		stmt: "INSERT OR REPLACE INTO Bans (startDate, finishDate, userIntId, moderatorIntId, " +
			"reason, userAppeal, appealRejected) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
		params: [ start, finish, intId, modIntId, reason, null, 0 ] }
	dbWorker.postMessage({ call: "exec", data: banDbData })

	const ips:any = await makeDbRequest("exec", {
		stmt: "SELECT ip FROM KnownIps WHERE userIntId = ?1", params: intId })
	for (const ipObject of ips) {
		bans.set(ipObject.ip, finish)
	}
}

/**
 * Mute a client using their intId for a finite amount of time
 * @param {number} intId - Integer id of client that is to be muted
 * @param {number} duration - Integer duration (seconds) for however long this client will be muted for
 * @param {string?} reason - String reason for which client is being muted
 * @param {number?} modIntId - Responsible moderator integer ID
 */
async function mute(intId: number, duration: number, reason: string|null = null, modIntId: number|null = null) {
	const start = NOW
	const finish = start + duration * 1000
	const muteDbData = {
		stmt: `INSERT OR REPLACE INTO Mutes
				(startDate, finishDate, userIntId, moderatorIntId, "reason, userAppeal, appealRejected)
				VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
		params: [ start, finish, intId, modIntId, reason, null, 0 ] }
	postDbMessage("exec", muteDbData)

	const ips:any = await makeDbRequest("exec", { stmt: "SELECT ip FROM KnownIps WHERE userIntId = ?", params: intId })
	for (const ipObject of ips) {
		mutes.set(ipObject.ip, finish)
	}
}

/**
 * Permamently IP block a player by IP, via WS instance or via intID
 */
function blacklist(identifier: ServerWebSocket<any>|number|string, reason: string = "Blacklisted IP") {
	let ip:string|null = null
	if (typeof identifier === "number") {
		for (const p of wss.clients) {
			if (p.data.intId == identifier) {
				ip = p.data.ip
				p.close()
			}
		}
	}
	else if (typeof identifier === "string") {
		ip = identifier
		for (const p of wss.clients) {
			if (p.data.ip === ip) p.close()
		}
	}
	else if (identifier instanceof Object) {
		const cli = identifier
		cli.close()
		ip = cli.data.ip
	}
	if (!ip) return

	const info = { reason: reason, date: Date.now() }
	BLACKLISTED.set(ip, info)
	const entry = `\n${ip} ${JSON.stringify(info)}`
	fs.appendFile("./blacklist.txt", entry)
}

const defaultChannels = ["en", "zh", "hi", "es", "fr", "ar", "bn", "ru", "pt", "ur", "de", "jp", "tr", "vi", "ko", "it", "fa", "nl", "az"]
/**
 * Broadcast a message as the server to all default channels, or a specific provided channel
 */
function announce(msg: string, channel: string|null = null, repliesTo:number|null = null) {
	const targetChannels = channel ? [channel] : defaultChannels
	for (const ch of targetChannels) {
		const packet = createChatPacket(0, msg, Math.floor(NOW / 1000), 0, 0, ch, repliesTo)
		wss.publish("all", packet)
	}
}
/**
 * Expands canvas, along with updating changes and alerting all clients to a given size
 */
function expand(newWidth:number, newHeight:number) {
	if (newHeight < HEIGHT || newWidth < WIDTH) {
		console.error(`Can not expand board. ${newWidth}, ${newHeight
			} is smaller than current dimensions (${WIDTH}, ${HEIGHT}))`)
		return
	}
	const newBoard = new Uint8Array(newWidth * newHeight)
	const newChanges = new Uint8Array(newWidth * newHeight).fill(255)
	for (let y = 0; y < HEIGHT; y++) {
		newBoard.set(BOARD.subarray(y * WIDTH, (y + 1) * WIDTH), y * newWidth)
		newChanges.set(CHANGES.subarray(y * WIDTH, (y + 1) * WIDTH), y * newWidth)
	}
	BOARD = newBoard
	CHANGES = newChanges
	WIDTH = newWidth
	HEIGHT = newHeight

	const newChangesPacket = runLengthChanges()
	wss.publish("all", newChangesPacket)
	console.log(`Successfully resized canvas to (${WIDTH}, ${HEIGHT}) and messaged all clients`)
	console.log("\x1b[33;4;1mREMEMBER TO UPDATE server_config.json with the new board dimensions" +
		"to avoid potential canvas corruption.\x1b[0m")
	console.log("\x1b[33;4;1mREMEMBER TO CALL pushImage() to push commit new canvas dimensions" +
		"to git\x1b[0m")
}

/**
 * Converts seconds to a formatted string depending on the magnitude.
 * @returns {string} - Fuzzy time string, e.g 1h 1m 1s / 1m 1s / 59s
 */
function formatTimeSeconds(seconds:number): string {
	const hours = Math.floor(seconds / 3600)
	const minutes = Math.floor((seconds % 3600) / 60)
	const remainingSeconds = seconds % 60

	let result = ""
	if (hours > 0) {
		result += `${hours}h `;
	}
	if (minutes > 0 || hours > 0) {
		result += `${minutes}m `
	}
	result += `${remainingSeconds}s`

	return result.trim()
}

let shutdown = false
process.on("unhandledRejection", console.error)
process.on("uncaughtException", console.error)
process.on("SIGINT", function () {
	if (shutdown) {
		console.log("Bruh impatient")
		process.exit(0)
	}
	else {
		shutdown = true
		process.stdout.write("\rShutdown received. Wait a sec");

		(async function() {
			await makeDbRequest("commitShutdown")
			console.log("\rBye-bye!                             ")
			process.exit(0)
		})()
	}
})
process.on("SIGSEGV", async function() {
	console.trace("Segfault encountered. Quitting")
	process.exit(1)
})
