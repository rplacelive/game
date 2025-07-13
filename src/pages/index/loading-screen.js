import { translate, lerp } from "../../shared.js";

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
		this.boxSize = 80;
		/**@type {Box[][]}*/this.columns = [];
		this.gravity = 0.36;
		this.initializeColumns();
	}

	initializeColumns() {
		const columnCount = Math.ceil(innerWidth / this.boxSize);
		this.columns = new Array(columnCount).fill(0).map(() => []);
	}

	start() {
		if (this.started || !this.ctx) return;

		this.canvas.width = innerWidth;
		this.canvas.height = innerHeight;
		this.initializeColumns();
		
		this.interval = setInterval(() => {
			if (!this.ctx) {
				clearInterval(this.interval);
				return;
			}
			this.#update();
		}, 16);
		this.started = true;
	}

	stop() {
		clearInterval(this.interval);
		this.columns = [];
		this.initializeColumns();
		this.clear();
		this.started = false;
	}

	#update() {
		if (!this.ctx) {
			return;
		}

		this.clear();
		for (let col = 0; col < this.columns.length; col++) {
			for (let i = 0; i < this.columns[col].length; i++) {
				this.columns[col][i].update(this.ctx, col, i);
			}
		}
	}

	clear() {
		this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	/**
	 * 
	 * @param {number} x 
	 * @param {number} y 
	 * @param {string} colour 
	 */
	addBox(x, y, colour) {
		const col = Math.floor(x / this.boxSize);
		if (col >= 0 && col < this.columns.length) {
			const column = this.columns[col];
			const insertIndex = this.#findInsertIndex(column, y);
			column.splice(insertIndex, 0, new Box(colour, y, this.boxSize));
		}
	}

	/**
	 * @param {Box[]} column 
	 * @param {number} y 
	 */
	#findInsertIndex(column, y) {
		for (let i = 0; i < column.length; i++) {
			if (y > column[i].y) {
				return i;
			}
		}
		return column.length;
	}

	/**
	 * @param {number} col 
	 * @param {number} index
	 */
	getFloorY(col, index) {
		const column = this.columns[col];
		return index > 0 ? column[index - 1].y : this.canvas.height;
	}
}

class Box {
	/**
	 * @param {string} colour 
	 * @param {number} y 
	 * @param {number} size 
	 */
	constructor(colour, y, size) {
		this.colour = colour;
		this.y = y;
		this.size = size;
		this.gravitySpeed = 0;
		this.stretch = this.gravitySpeed;
		this.hitFlash = 0;
	}

	/**
	 * 
	 * @param {CanvasRenderingContext2D} ctx 
	 * @param {number} col 
	 * @param {number} stackIndex 
	 */
	update(ctx, col, stackIndex) {
		const targetY = waitingGame.getFloorY(col, stackIndex) - this.size;
		
		if (this.y >= targetY) {
			if (this.gravitySpeed > 0) {
				this.hitFlash = 15;
			}
			this.y = targetY;
			this.gravitySpeed = 0;
		}
		else {
			this.gravitySpeed += waitingGame.gravity;
			this.y += this.gravitySpeed;
		}

		if (this.hitFlash > 0) {
			this.hitFlash--;
		}

		const x = col * this.size;
		const stretch = lerp(this.stretch, this.gravitySpeed * 2, 0.3);
		
		ctx.fillStyle = this.colour;
		ctx.fillRect(x + (stretch / 2), this.y - (stretch / 2), this.size - stretch, this.size + stretch);
		
		if (this.hitFlash > 0) {
			const flashAlpha = this.hitFlash / 15 * 0.5;
			ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
			ctx.fillRect(x + (stretch / 2), this.y - (stretch / 2), this.size - stretch, this.size + stretch);
		}
	}
}

/**
 * @param {number} x 
 * @param {number} y 
 */
function handleGameCanvasClick(x, y) {
	const colours = ["grey", "lightgray", "darkgray", "whiteSmoke"];
	let colour = colours[Math.floor(Math.random() * 4)];
	
	if (Math.random() < 1/100) {
		colour = "#FF5700";
	}
	
	waitingGame.addBox(x, y, colour);
}

const waitingGameCanvas = /**@type {HTMLCanvasElement}*/(document.getElementById("waitingGameCanvas"));
const waitingGame = new WaitingGame(waitingGameCanvas);
waitingGameCanvas.addEventListener("mousedown", (event) => { 
	handleGameCanvasClick(event.clientX, event.clientY);
	event.preventDefault();
	event.stopPropagation();
});
waitingGameCanvas.addEventListener("touchstart", (event) => {
	if (event.touches[0]) {
		handleGameCanvasClick(event.touches[0].clientX, event.touches[0].clientY);
		event.preventDefault();
		event.stopPropagation();

	}
});
window.addEventListener("resize", () => {
	const mainContent = /**@type {HTMLElement}*/(document.getElementById("maincontent"));
	waitingGame.canvas.width = innerWidth;
	waitingGame.canvas.height = mainContent.offsetHeight;
	waitingGame.columns = [];
	waitingGame.initializeColumns();
});