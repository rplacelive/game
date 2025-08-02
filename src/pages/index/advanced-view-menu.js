"use strict";
import { BoardRenderer } from "./board-renderer.js";
import { boardRenderer } from "./viewport.js";
import { $ } from "../../shared.js";
import { HEIGHT, WIDTH } from "./game-state.js";

const viewport = /**@type {HTMLElement}*/($("#viewport"));
const advancedViewMenu = /**@type {HTMLElement}*/($("#advancedViewMenu"));
const closeButton = /**@type {HTMLButtonElement}*/($("#avmCloseButton"));
const createSelectionButton = /**@type {HTMLButtonElement}*/($("#avmCreateSelectionButton"));
const viewCanvasLayer = /**@type {HTMLInputElement}*/($("#viewCanvasLayer"));
const viewChangesLayer = /**@type {HTMLInputElement}*/($("#viewChangesLayer"));
const viewSocketPixelsLayer = /**@type {HTMLInputElement}*/($("#viewSocketPixelsLayer"));

// Selections
const selectionFragmentSource = `#version 300 es
	precision highp float;
	precision highp usampler2D;

	in vec2 v_uv;
	out vec4 fragColour;

	uniform usampler2D u_selectionTex;
	uniform usampler2D u_paletteTex;
	uniform ivec2 u_boardSize;
	uniform ivec2 u_selectionPos;
	uniform ivec2 u_selectionSize;

	void main() {
		ivec2 texSize = textureSize(u_selectionTex, 0);
		ivec2 screenCoord = ivec2(v_uv * vec2(u_boardSize));
		
		// Check if we're within the selection bounds
		if (screenCoord.x < u_selectionPos.x || screenCoord.x >= u_selectionPos.x + u_selectionSize.x ||
			screenCoord.y < u_selectionPos.y || screenCoord.y >= u_selectionPos.y + u_selectionSize.y) {
			fragColour= vec4(1.0, 1.0, 1.0, 0.0);
			return;
		}
		
		// Calculate local coordinates within the selection
		ivec2 localCoord = screenCoord - u_selectionPos;
		int pixelIndex = localCoord.y * u_selectionSize.x + localCoord.x;
		
		// Calculate which byte and bit within that byte
		int byteIndex = pixelIndex / 8;
		int bitIndex = pixelIndex % 8;
		
		// Calculate texture coordinates for the bitfield
		int bytesPerRow = texSize.x;
		ivec2 texelCoord = ivec2(byteIndex % bytesPerRow, byteIndex / bytesPerRow);
		
		// Fetch the byte containing our bit
		uint byteValue = texelFetch(u_selectionTex, texelCoord, 0).r;
		
		// Extract the specific bit
		uint bitMask = 1u << uint(bitIndex);
		bool isSelected = (byteValue & bitMask) != 0u;
		
		fragColour = vec4(0.0, 0.0, 1.0, isSelected ? 0.2 : 0.0);
	}`;


/**
 * @typedef {Object} BoardSelection
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {Uint8Array} mask
 * @property {import("./board-renderer.js").RenderLayer} layer
 * @property {{ tl:HTMLElement, tr:HTMLElement, bl:HTMLElement, br:HTMLElement }} [handles]
 * @property {HTMLElement} [label]
 */
/**@type {Array<BoardSelection>}*/let selections = [];

/**
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @returns {import("./board-renderer.js").RenderLayer}
 */
function createSelectionLayer(x, y, width, height) {
	if (!boardRenderer) {
		throw new Error("Board renderer was null");
	}

	const gl = boardRenderer.getContext();
	const selectionTex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, selectionTex);
	
	// Calculate texture dimensions for bitfield
	const totalPixels = width * height;
	const bitfieldSize = Math.ceil(totalPixels / 8);
	const bytesPerRow = Math.ceil(Math.sqrt(bitfieldSize));
	const textureHeight = Math.ceil(bitfieldSize / bytesPerRow);
	
	gl.texImage2D(
		gl.TEXTURE_2D,
		0,
		gl.R8UI,
		bytesPerRow,
		textureHeight,
		0,
		gl.RED_INTEGER,
		gl.UNSIGNED_BYTE,
		null
	);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	
	const layerShader = boardRenderer.createLayerShader(selectionFragmentSource, BoardRenderer.boardVertexSource, "u_selectionTex", {
		"u_selectionPos": {
			type: "2i"
		},
		"u_selectionSize": {
			type: "2i"
		}
	});
	return boardRenderer.addRenderLayer(selectionTex, layerShader, true, {
		"u_selectionPos": [ x, y ],
		"u_selectionSize": [ width, height ]
	});
}

createSelectionButton.addEventListener("click", function(e) {
	if (!boardRenderer) {
		return;
	}
	addSelection(50, 50, 100, 100);
});

/**
 * @param {BoardSelection} selection
 */
function createSelectionLabel(selection) {
	if (!boardRenderer) {
		throw new Error("Board renderer was null");
	}

	const labelEl = document.createElement("span");
	labelEl.dataset.x = String(selection.x);
	labelEl.dataset.y = String(selection.y);
	labelEl.classList.add("selection-label");
	viewport.appendChild(labelEl);

	return labelEl;
}

/**
 * @param {BoardSelection} selection
 * @param {"tl"|"tr"|"bl"|"br"} type 
 */
function createSelectionHandle(selection, type) {
	if (!boardRenderer) {
		throw new Error("Board renderer was null");
	}

	const handleEl = document.createElement("div");
	handleEl.dataset.type = type;
	handleEl.classList.add("selection-handle");
	viewport.appendChild(handleEl);

	/**@type {{ x: number, y:number }|null}*/let dragPos = null;
	/**
	 * @param {number} clientX 
	 * @param {number} clientY 
	 */
	function beginDrag(clientX, clientY) {
		if (!boardRenderer) {
			return;
		}

		const boardPos = boardRenderer.hitTest(clientX, clientY);
		if (!boardPos) {
			return;
		}

		dragPos = { x: Math.floor(boardPos.x), y: Math.floor(boardPos.y) };
		handleEl.style.cursor = "grabbing";
	}
	/**
	 * @param {number} clientX 
	 * @param {number} clientY 
	 */
	function dragMove(clientX, clientY) {
		if (!dragPos || !boardRenderer) {
			return;
		}

		const boardPos = boardRenderer.hitTest(clientX, clientY); 
		if (!boardPos) {
			return;
		}
		let dx = Math.floor(boardPos.x - dragPos.x);
		let dy = Math.floor(boardPos.y - dragPos.y);

		if ((type[0] === "t" && selection.height <= 8 && dy > 0)
			|| (type[0] === "b" && selection.height <= 8 && dy < 0)) {
			dy = 0;
		}
		if ((type[1] === "l" && selection.width <= 8 && dx > 0)
			|| type[1] === "r" && selection.width <= 8 && dx < 0) {
			dx = 0;
		}

		if (type === "tl") {
			selection.x += dx;
			selection.y += dy;
			selection.width -= dx;
			selection.height -= dy;
		}
		else if (type === "tr") {
			selection.y += dy;
			selection.width += dx;
			selection.height -= dy;
		}
		else if (type == "bl") {
			selection.x += dx;
			selection.width -= dx;
			selection.height += dy;
		}
		else if (type == "br") {
			selection.width += dx;
			selection.height += dy;
		}

		dragPos = { x: Math.floor(boardPos.x), y: Math.floor(boardPos.y) };
		updateSelection(selection);
	}
	function endDrag() {
		dragPos = null;
		handleEl.style.cursor = "grab";
	}
	handleEl.addEventListener("mousedown", (e) => {
		e.preventDefault();
		e.stopPropagation();
		beginDrag(e.clientX, e.clientY)
	});
	viewport.addEventListener("mousemove", (e) => dragMove(e.clientX, e.clientY));
	viewport.addEventListener("mouseup", () => endDrag());

	return handleEl;
}

/**
 * @param {BoardSelection} selection
 */
function updateSelectionHandles(selection) {
	if (!boardRenderer) {
		throw new Error("Board renderer was null");
	}
	if (!selection.handles) {
		return;
	}

	const { tl, tr, bl, br } = selection.handles;
	for (const handleEl of [ tl, tr, bl, br]) {
		let x = selection.x;
		let y = selection.y;
		switch (handleEl.dataset.type) {
			case "tr": {
				x = selection.x + selection.width;
				break;
			}
			case "bl": {
				y = selection.y + selection.height;
				break;
			}
			case "br": {
				x = selection.x + selection.width;
				y = selection.y + selection.height;
				break;
			}
		}
		handleEl.dataset.x = String(x);
		handleEl.dataset.y = String(y);

		const screenCoords = boardRenderer.boardToCanvasElementCoords(x, y);
		handleEl.style.left = `${screenCoords.x}px`;
		handleEl.style.top = `${screenCoords.y}px`;
	}
}

/**
 * @param {BoardSelection} selection
 */
function updateSelectionLabel(selection) {
	if (!boardRenderer) {
		throw new Error("Board renderer was null");
	}

	const labelEl = selection.label;
	if (!labelEl) {
		return;
	}

	labelEl.dataset.x = String(selection.x);
	labelEl.dataset.y = String(selection.y);
	const screenCoords = boardRenderer.boardToCanvasElementCoords(selection.x, selection.y);
	labelEl.style.left = `${screenCoords.x}px`;
	labelEl.style.top = `${screenCoords.y}px`;
	labelEl.textContent = `${selection.x},${selection.y}  (${selection.width}x${selection.height})`;
}

window.addEventListener("pos", (/**@type {Event}*/e) => {
	if (!(e instanceof CustomEvent)) {
		throw new Error("Pos event was not of type CustomEvent");
	}

	// Update selection handle positions
	requestAnimationFrame(() => {
		for (const selection of selections) {
			if (!selection.handles) {
				continue;
			}

			updateSelectionHandles(selection);
			updateSelectionLabel(selection);
		}
	})
});


/**
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {Uint8Array|null} mask
 */
function addSelection(x, y, width, height, mask = null) {
	if (!boardRenderer) {
		return;
	}

	const layer = createSelectionLayer(x, y, width, height);
	
	// Create default mask (fully selected) if none provided
	const totalPixels = width * height;
	const bitfieldSize = Math.ceil(totalPixels / 8);
	const selectionMask = mask ?? new Uint8Array(bitfieldSize);
	
	if (!mask) {
		// Fill with all bits set (fully selected)
		selectionMask.fill(255);
		// Handle partial last byte
		const remainingBits = totalPixels % 8;
		if (remainingBits > 0) {
			const lastByteIndex = bitfieldSize - 1;
			selectionMask[lastByteIndex] = (1 << remainingBits) - 1;
		}
	}

	/**@type {BoardSelection}*/const selection = {
		x,
		y,
		width,
		height,
		mask: selectionMask,
		layer,
	};
	selection.handles =  {
		tl: createSelectionHandle(selection, "tl"),
		tr: createSelectionHandle(selection, "tr"),
		bl: createSelectionHandle(selection, "bl"),
		br: createSelectionHandle(selection, "br")
	};
	selection.label = createSelectionLabel(selection);
	updateSelectionHandles(selection);
	updateSelectionLabel(selection);
	selections.push(selection);

	uploadSelectionTexture(selection);
	boardRenderer.queueRedraw();
}

/**
 * @param {BoardSelection} selection
 */
function updateSelection(selection) {
	if (!boardRenderer) {
		return;
	}

	// DOM side
	updateSelectionHandles(selection);
	updateSelectionLabel(selection);

	// Renderer side
	// TODO: If the size of the selection has changed and is now bigger, we need
	// TODO: to create a new selection texture with the new size
	selection.layer.uniforms = {
		"u_selectionPos": [ selection.x, selection.y ],
		"u_selectionSize": [ selection.width, selection.height ]
	};
	boardRenderer.queueRedraw();
}

/**
 * @param {number} index
 */
function removeSelection(index) {
	if (!boardRenderer || index < 0 || index >= selections.length) {
		return;
	}

	const selection = selections[index];
	boardRenderer.removeRenderLayer(selection.layer);

	selections.splice(index, 1);
	boardRenderer.queueRedraw();
}

function clearSelections() {
	if (!boardRenderer) {
		return;
	}

	// Remove all layers
	for (const selection of selections) {
		boardRenderer.removeRenderLayer(selection.layer);
	}
	
	selections.length = 0;
	boardRenderer.queueRedraw();
}

/**
 * @param {BoardSelection} selection
 * @param {number} localX - X coordinate within the selection
 * @param {number} localY - Y coordinate within the selection
 * @param {boolean} selected - Whether to select or deselect this pixel
 */
function setSelectionPixel(selection, localX, localY, selected) {
	if (!boardRenderer) {
		return;
	}
	if (localX < 0 || localX >= selection.width || localY < 0 || localY >= selection.height) {
		return;
	}

	const pixelIndex = localY * selection.width + localX;
	const arrayIndex = Math.floor(pixelIndex / 8);
	const bitIndex = pixelIndex % 8;

	if (selected) {
		selection.mask[arrayIndex] |= (1 << bitIndex);
	}
	else {
		selection.mask[arrayIndex] &= ~(1 << bitIndex);
	}

	uploadSelectionTexture(selection);
	boardRenderer.queueRedraw();
}


/**
 * @param {BoardSelection} selection
 */
function uploadSelectionTexture(selection) {
	if (!boardRenderer || !selection.layer || !selection.mask) {
		return;
	}

	const gl = boardRenderer.getContext();
	const bitfieldSize = selection.mask.length;
	const bytesPerRow = Math.ceil(Math.sqrt(bitfieldSize));
	const textureHeight = Math.ceil(bitfieldSize / bytesPerRow);
	
	// Create padded data if needed
	const paddedSize = bytesPerRow * textureHeight;
	let uploadData = selection.mask;
	if (paddedSize > bitfieldSize) {
		uploadData = new Uint8Array(paddedSize);
		uploadData.set(selection.mask);
	}

	gl.bindTexture(gl.TEXTURE_2D, selection.layer.texture);
	gl.texSubImage2D(
		gl.TEXTURE_2D,
		0,
		0,
		0,
		bytesPerRow,
		textureHeight,
		gl.RED_INTEGER,
		gl.UNSIGNED_BYTE,
		uploadData
	);
}

// View layers
viewCanvasLayer.addEventListener("change", function() {
	boardRenderer?.setLayerEnabled(0, viewCanvasLayer.checked);
});
viewChangesLayer.addEventListener("change", function() {
	boardRenderer?.setLayerEnabled(1, viewChangesLayer.checked);
});
viewSocketPixelsLayer.addEventListener("change", function() {
	boardRenderer?.setLayerEnabled(2, viewSocketPixelsLayer.checked);
});

// Misc
closeButton.addEventListener("click", function() {
	advancedViewMenu.removeAttribute("open");
});