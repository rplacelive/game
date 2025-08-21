"use strict";
import { $ } from "../src/shared.js";
import { BoardRenderer } from "../src/pages/index/board-renderer.js";
import { BoardRendererMesh } from "../src/pages/index/board-renderer-mesh.js";
import { BoardRendererSphere } from "../src/pages/index/board-renderer-sphere.js";

// Fetch test board
const boardRes = await fetch("./test-place-1000x1000");
if (!boardRes.ok) {
	throw new Error("Failed to fetch test place file");
}
const boardData = await boardRes.arrayBuffer();

// Setup test board
const boardWidth = 1000;
const boardHeight = 1000;
const boardSize = boardWidth * boardHeight;
const board = new Uint8Array(boardData);
const changes = new Uint8Array(boardSize).fill(255);
const socketPixels = new Uint8Array(boardSize).fill(255);
const palette = new Uint32Array([
	0xFF000000,
	0xFF696969,
	0xFF555555,
	0xFF808080,
	0xFFD3D3D3,
	0xFFFFFFFF,
	0xFF9999FF,
	0xFF3333CC,
	0xFF3C14DC,
	0xFF000099,
	0xFF000080,
	0xFF0057FF,
	0xFF8CFFCC,
	0xFF76DE81,
	0xFF003C6F,
	0xFFB4553A,
	0xFFDFAD6C,
	0xFFFFD98C,
	0xFFFFFFFF,
	0xFFFF7DB7,
	0xFFFF45BE,
	0xFF8339FA,
	0xFF0099FF,
	0xFF00E6FF,
	0xFF003457,
	0xFF001A1A
]);


// Basic 2D
{
	const canvas = /**@type {HTMLCanvasElement}*/($("#basic2DCanvas"));
	const renderer = new BoardRenderer(canvas);
	renderer.setSources(board, changes, socketPixels, palette, boardWidth, boardHeight);
	renderer.setPosition(50, 50, 0.01)
	renderer.queueRedraw();
}


// 3D Cube
{
	const objSource = `# Cube
o Board
v 1.0000 1.0000 1.0000
v 1.0000 1.0000 0.0000
v 1.0000 0.0000 0.0000
v 1.0000 0.0000 1.0000
v 0.0000 1.0000 0.0000
v 0.0000 1.0000 1.0000
v 0.0000 0.0000 1.0000
v 0.0000 0.0000 0.0000

# UV coordinates
vt 0.0 0.0
vt 1.0 0.0
vt 1.0 1.0
vt 0.0 1.0

# Quad faces with UV mapping
f 4/4 3/3 2/2 1/1
f 8/4 7/3 6/2 5/1
f 6/4 1/3 2/2 5/1
f 8/4 3/3 4/2 7/1
f 7/4 4/3 1/2 6/1
f 3/4 8/3 5/2 2/1`

	let x = 50;
	let y = 50;
	let z = 0.01;
	let rx = 0;
	let ry = 0;
	let rz = 0;
	let minZoom = 0;
	let mouseDown = -1;

	const canvas =  /**@type {HTMLCanvasElement}*/($("#basic3DCanvas"));

	const renderer = new BoardRendererMesh(canvas, objSource);
	renderer.setSources(board, changes, socketPixels, palette, boardWidth, boardHeight);
	renderer.setPosition(x, y, z);
	renderer.queueRedraw();

	canvas.addEventListener("mousedown", (e) => {
		mouseDown = e.button;
	});
	canvas.addEventListener("mouseup", (e) => {
		mouseDown = -1;
	});
	canvas.addEventListener("mousemove", (e) => {
		if (mouseDown === -1) {
			return;
		}

		if (mouseDown === 1) {
			rx += e.movementY * 0.01;
			ry += e.movementX * 0.01;
			renderer.setRotation(rx, ry, rz);
		}
		else {
			let dx = e.movementX;
			let dy = e.movementY;
			x -= dx / (z * 50);
			y -= dy / (z * 50);
			renderer.setPosition(x, y, z);
		}
	});
	canvas.addEventListener("wheel", (e) => {
		e.preventDefault();
		e.stopPropagation();

		const d = Math.max(minZoom / z, Math.min(3 ** Math.max(-0.5, Math.min(0.5, e.deltaY * -0.01)), 1 / z));
		z *= d;
		renderer.setPosition(x, y, z);
	});
	canvas.addEventListener("scroll", (e) => {
		e.preventDefault();
		e.stopPropagation();
	});
	function updateMinZoom() {
		minZoom = Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height) / 100;
	}
	window.addEventListener("resize", updateMinZoom);
	updateMinZoom();
}

{
	const sphereRes = await fetch("./sphere.obj");
	if (!boardRes.ok) {
		throw new Error("Failed to fetch test sphere file");
	}
	const sphereSource = await sphereRes.text();

	let x = 0;
	let y = 0;
	let z = 0.01;
	let minZoom = 0;
	let mouseDown = -1;

	const canvas = /**@type {HTMLCanvasElement}*/($("#sphere3DCanvas"));
	const container = /**@type {HTMLElement}*/($("#sphere3DCanvasViewport"));

	const renderer = new BoardRendererMesh(canvas, sphereSource);
	renderer.setSources(board, changes, socketPixels, palette, boardWidth, boardHeight);
	renderer.setPosition(x, y, z);
	renderer.queueRedraw();

	function wrap(v, max) {
		return Math.min(Math.max(0, v), 1000);
		//return ((v % max) + max) % max; // handles negatives too
	}

	function setSpherePosition(x, y, z) {
		renderer.setPosition(500, 500, z);
		renderer.setRotation(-(y / 1000) * (Math.PI * 2), -(x / 1000) * (Math.PI * 2), 0);
		sphere3DCoordinates.textContent = `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`;
	}

	setSpherePosition(x, y, z);

	canvas.addEventListener("mousedown", (e) => {
		mouseDown = e.button;
	});
	canvas.addEventListener("mouseup", (e) => {
		mouseDown = -1;
	});
	canvas.addEventListener("mousemove", (e) => {
		if (mouseDown === -1) return;
		if (mouseDown !== 1) {
			let dx = e.movementX;
			let dy = e.movementY;
			x -= dx / (z * 50);
			y -= dy / (z * 50);

			x = wrap(x, boardWidth);
			y = wrap(y, boardHeight);

			setSpherePosition(x, y, z);
		}
	});
	canvas.addEventListener("keydown", (e) => {
		e.preventDefault();
		if (e.key === "ArrowUp") {
			y -= 1;
		}
		else if (e.key === "ArrowDown") {
			y += 1;
		}
		else if (e.key === "ArrowLeft") {
			x -= 1;
		}
		else if (e.key === "ArrowRight") {
			x += 1;
		}

		x = wrap(x, boardWidth);
		y = wrap(y, boardHeight);

		setSpherePosition(x, y, z);
	});
	canvas.addEventListener("wheel", (e) => {
		e.preventDefault();
		e.stopPropagation();

		const d = Math.max(minZoom / z, Math.min(3 ** Math.max(-0.5, Math.min(0.5, e.deltaY * -0.01)), 1 / z));
		z *= d;

		setSpherePosition(x, y, z);
	});
	canvas.addEventListener("scroll", (e) => {
		e.preventDefault();
		e.stopPropagation();
	});
	function updateMinZoom() {
		minZoom = Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height) / 100;
	}
	window.addEventListener("resize", updateMinZoom);
	updateMinZoom();
}


{
	const canvas = /**@type {HTMLCanvasElement}*/($("#sphere2DFragmentCanvas"));
	const coordinates = /**@type {HTMLElement}*/($("#sphere2DFragmentCoordinates"));
	const renderer = new BoardRendererSphere(canvas);
	renderer.setSources(board, changes, socketPixels, palette, boardWidth, boardHeight);
	renderer.setPosition(0, 0, 0.05)
	renderer.queueRedraw();

	let x = 0;
	let y = 0;
	let z = 0.01;
	let minZoom = 0;
	let mouseDown = -1;

	function wrap(v, max) {
		return ((v % max) + max) % max; // handles negatives too
	}

	function setPosition(x, y, z) {
		renderer.setPosition(x, y, z);
		coordinates.textContent = `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`;
	}

	canvas.addEventListener("mousedown", (e) => {
		mouseDown = e.button;
	});
	canvas.addEventListener("mouseup", (e) => {
		mouseDown = -1;
	});
	canvas.addEventListener("mousemove", (e) => {
		if (mouseDown === -1) return;
		if (mouseDown !== 1) {
			let dx = e.movementX;
			let dy = e.movementY;
			x -= dx / (z * 50);
			y -= dy / (z * 50);

			x = wrap(x, boardWidth);
			y = wrap(y, boardHeight);

			setPosition(x, y, z);
		}
	});
	canvas.addEventListener("keydown", (e) => {
		e.preventDefault();
		if (e.key === "ArrowUp") {
			y -= 1;
		}
		else if (e.key === "ArrowDown") {
			y += 1;
		}
		else if (e.key === "ArrowLeft") {
			x -= 1;
		}
		else if (e.key === "ArrowRight") {
			x += 1;
		}

		x = wrap(x, boardWidth);
		y = wrap(y, boardHeight);

		setPosition(x, y, z);
	});
	canvas.addEventListener("wheel", (e) => {
		e.preventDefault();
		e.stopPropagation();

		const d = Math.max(minZoom / z, Math.min(3 ** Math.max(-0.5, Math.min(0.5, e.deltaY * -0.01)), 1 / z));
		z *= d;
		setPosition(x, y, z);
	});
	canvas.addEventListener("scroll", (e) => {
		e.preventDefault();
		e.stopPropagation();
	});
	function updateMinZoom() {
		minZoom = Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height) / 100;
	}
	window.addEventListener("resize", updateMinZoom);
	updateMinZoom();
}
