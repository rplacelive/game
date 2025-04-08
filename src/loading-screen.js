import { translate } from "./shared";

const loadingScreen = /**@type {HTMLElement}*/(document.getElementById("loadingScreen"));

/**
 * @param {"normal"|"timeout"|"disconnected"} state
 * @param {string|null} disconnectReason
 */
export async function showLoadingScreen(state="normal", disconnectReason=null) {
	loadingScreen.style.opacity = "1";
	loadingScreen.style.display = "flex";

	if (state == "normal") {
		waitingGame.start();
	}
	else if (state == "timeout") {
		const loadingLogo = /**@type {HTMLImageElement}*/(loadingScreen.children[0]);
		loadingLogo.src = "images/rplace-offline.png";	
	}
	else if (state == "disconnected") {
		const loadingLogo = /**@type {HTMLImageElement}*/(loadingScreen.children[0]);
		loadingLogo.src = "images/rplace-offline.png"
		const loadingMessage = /**@type {HTMLElement}*/(document.getElementById("loadingMessage"));
		loadingMessage.hidden = false
		loadingMessage.textContent = `${await translate("disconnectedFromServer")}: ${disconnectReason}`
	}
}

export function hideLoadingScreen() {
	loadingScreen.style.opacity = "0";
	setTimeout(() => loadingScreen.style.display = "none", 300);
	setTimeout(() => waitingGame.stop(), 300);
}

class WaitingGame {
	/**
	 * @param {HTMLCanvasElement} canvas
	 */
	constructor(canvas) {
		this.canvas = canvas;
		this.started = false;
		this.ctx = canvas.getContext("2d");
	}

	start() {
		if (this.started || !this.ctx) {
			return;
		}

		this.canvas.width = innerWidth;
		this.canvas.height = innerHeight;
		this.context = this.canvas.getContext("2d");
		this.interval = setInterval(() => {
			if (!this.ctx) {
				clearInterval(this.interval);
				return;
			}
			waitingGame.clear()
			for (const cube of physicsCubes) {
				cube.update(this.ctx);
			}
		}, 16)
		this.started = true;
	}

	stop() {
		clearInterval(this.interval)
		physicsCubes = [];
		this.clear();
		this.started = false;
	}

	clear() {
		this.context?.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}
}

class Component {
	/**
	 * @param {number} width
	 * @param {number} height
	 * @param {string} colour
	 * @param {number} x
	 * @param {number} y
	 * @param {WaitingGame} waitingGame
	 */
	constructor(width, height, colour, x, y, waitingGame) {
		this.width = width;
		this.height = height;
		this.x = x;
		this.y = y;
		this.speedX = 0;
		this.speedY = 0;
		this.gravity = 0.36;
		this.gravitySpeed = 0;
		this.colour = colour;
		this.waitingGame = waitingGame;
	}

	/**
	 * @param {CanvasRenderingContext2D} ctx
	 */
	update(ctx) {
		//gravity calculations
		this.gravitySpeed += this.gravity;
		this.y += (waitingGame.canvas.height - this.y > 30) ? (this.speedY + this.gravitySpeed) : 0;
		this.x += this.speedX;

		//floor
		const floor = waitingGame.canvas.height - this.height
		if (this.y > floor) {
			this.y = floor;
			this.speedY = 0;
			this.gravitySpeed = 0;
		}

		//grid snap
		this.x = Math.floor(this.x / this.width) * this.width;

		//overlapping
		for (const other of physicsCubes) {
			if (other != this) {
				let calcH = (this.height + other.height) / 2, calcW = (this.width + other.width) / 2;
				if (Math.abs(this.y - other.y) < calcH && Math.abs(other.x - this.x) < calcW) { //Colliding
					this.speedY = 0;
					this.gravitySpeed = 0;
					this.y = (other.y - other.height) - 0.01;
				}
			}
		}

		//render update
		if (ctx) {
			ctx.fillStyle = this.colour;
			ctx.fillRect(this.x, this.y, this.width, this.height);
		}
	}
}

/**
 * @type {Component[]}
 */
let physicsCubes = [];
const waitingGameCanvas = /**@type {HTMLCanvasElement}*/(document.getElementById("waitingGameCanvas"));
const waitingGame = new WaitingGame(waitingGameCanvas);
waitingGame.canvas.onmousedown = function(/** @type {{ x: number; y: number; }} */ event) {
	physicsCubes.push(new Component(80, 80, (["grey", "lightgray", "darkgray", "whiteSmoke"][Math.floor(Math.random() * 4)]||"black"), Math.floor(event.x), Math.floor(event.y), waitingGame));
}

window.addEventListener("resize", () => {
	const mainContent = /**@type {HTMLElement}*/(document.getElementById("maincontent"));
	waitingGame.canvas.width = innerWidth;
	waitingGame.canvas.height = mainContent.offsetHeight;
})