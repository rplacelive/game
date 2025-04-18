import { forceTheme } from "./index.js";
/**@type {Set<any>|null}*/ let fallingMessages = null;
/**@type {Timer|null}*/let fallingMessageInterval = null;
/**@type {HTMLCanvasElement|null}*/let backgroundCanvas = null;

export async function enableDarkplace() {
	forceTheme("r/place 2022", "dark")
	const bgWrapper = document.getElementById("bgWrapper")
	backgroundCanvas = /**@type {HTMLCanvasElement}*/(document.getElementById("backgroundCanvas") || document.createElement("canvas"))
	backgroundCanvas.id = "backgroundCanvas"
	backgroundCanvas.style.position = "absolute"
	backgroundCanvas.style.top = "0"
	backgroundCanvas.style.left = "0"
	backgroundCanvas.style.width = "100%"
	backgroundCanvas.style.height = "100%"
	backgroundCanvas.style.filter = "blur(1px)"
	bgWrapper?.appendChild(backgroundCanvas)

	function updateBgCanvasSize() {
		backgroundCanvas.width = window.innerWidth
		backgroundCanvas.height = window.innerHeight
	}
	updateBgCanvasSize()
	window.addEventListener("resize", updateBgCanvasSize)

	const messages = [
		"88",
		"Zekiah",
		"X!Gaster",
		"Zubigri",
		"Lazvell.09",
		"Thiagoxnahuel",
		"Ward",
		"Bushi",
		"Lapis",
		"Relick",
		"BlobKat",
		"BeyazVoid",
		"Ysufxad",
		"Redje",
		"Etta",
		"BiskivitliTost",
		"MTC",
		"TmusiniYan",
		"SUS",
		"Люти Омни",
		"Авир",
		"Ых",
		"Insertnamehere",
		"Mr. John",
		"Царь изумрудного королевства",
		"The Great Wall",
		"C42Ё!!!",
		"Forbidding racism is racist",
		"Bugfix when? No",
		"Later, never",
		"∆∆∆",
		"∆  ∆∆",
		"Zubigri write this text",
		"Geometry Dash",
		"TK",
		"BCS",
		"rplace.live",
		"not rplace.tk",
		"darkplace.live",
		"susplace.live",
		"is am are what???",
		"r/place 2 ad it",
		"The Bullet? The Bullet!",
		"BloodBath",
		"Legalise nuclear bombs",
		"Absence of proof is not proof of absence",
		"Proof of absence is not absence of proof",
		"Qwertyuiop",
		"Asdfghjkl",
		"Zxcvbnm",
		"Site is saled",
		"(Nothing)",
		"Loading...)",
		"...---...",
		"Code",
		"Decode",
		"Delete :vip? Too lazy",
		"АРМОРС!!!",
		"КОНЬ НИЗКО ЛЕТИТ К ДОЖДЮ, НЕГРОВАЯ КРАСКА СЛЕЗЛА С ФЕРЗЯ И ОН ОТБЕЛИЛСЯ!!!",
		"Make Flag Speedrun Here",
		"3301",
		"42",
		"666",
		"777",
		"13",
		"284654548244662065667669143349975505484487365510612937903489695250411210311237163400731822443778191321442634040459295815516156858468105775285314299961880757005305548204686781529063932731323704485670912",
		"Ñ",
		"196883 Dimensions?",
		"Peace is never was an opinion",
		"Loading screen text",
		"Zek add loading screen text — ©Zubigri",
		"blobk.at 19132 mc server join",
		"We eat pixels",
		"The End.",
		"爱国无罪",
		"富狗",
		"我是好黑",
		"1",
		"2",
		"3",
		"4",
		"5",
		"6",
		"7",
		"8",
		"9",
		"10",
		"❤️ ataturk"
	]

	let wind = 1
	const gravity = 0.001
	const messageColours = ["#fff", "#aaa", "#db7c7c", "#4a4949"]

	class FallingMessage {
		/**
		 * @param {number} x
		 * @param {number} y
		 * @param {string} msg
		 */
		constructor(x, y, msg) {
			this.x = x
			this.y = y
			this.msg = msg
			this.colour = messageColours[Math.floor(Math.random() * messageColours.length)]
			this.fontSize = Math.random() * 32 + 6
			this.velocityY = Math.random() * 0.4
			this.velocityX = Math.random() - 0.5
		}

		/**
		 * @param {CanvasRenderingContext2D} ctx
		 */
		update(ctx) {
			this.velocityX += wind * (38 / this.fontSize) * 0.014
			this.x += this.velocityX
			this.velocityY += gravity
			this.y += this.velocityY
			const speed = Math.abs(this.velocityX * this.velocityY)
			ctx.globalAlpha = Math.min(1, speed * 0.4 + 0.4)
			ctx.font = `${this.fontSize}px 'Brush Script MT', cursive`
			ctx.fillStyle = this.colour
			ctx.fillText(this.msg, this.x, this.y)
		}
	}

	const backgroundContext = backgroundCanvas.getContext("2d")
	if (backgroundContext == null) {
		return
	}
	fallingMessages = new Set()
	let lastWindChange = Date.now()
	let lastSpawn = Date.now()
	clearInterval(fallingMessageInterval)
	fallingMessageInterval = setInterval(() => {
		backgroundContext.clearRect(0, 0, window.innerWidth, window.innerHeight)
		if (Date.now() - lastSpawn > 400 && Math.random() < 0.1) {
			const chosenMessage = messages[Math.floor(Math.random() * messages.length)]
			fallingMessages.add(new FallingMessage(Math.random() * window.innerWidth - 100, 0, chosenMessage))
			lastSpawn = Date.now()
		}
		if (Date.now() - lastWindChange > 5_000 && Math.random() < 0.3) {
			wind = Math.random() * 0.1 - 0.05
			lastWindChange = Date.now()
		}
		for (const message of fallingMessages) {
			message.update(backgroundContext)
			if (message.y > window.innerHeight) {
				fallingMessages.delete(message)
			}
		}
	}, 17)
}

export function disableDarkplace() {
	fallingMessages?.clear()
	clearInterval(fallingMessageInterval)
	backgroundCanvas?.remove()
}
