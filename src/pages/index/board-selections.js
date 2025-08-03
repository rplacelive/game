"use strict";
import { BoardRenderer } from "./board-renderer.js";

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

/**
 * Selections management extension class for board renderer
 */
export class BoardSelections extends EventTarget {
	static selectionFragmentSource = `#version 300 es
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
				fragColour = vec4(1.0, 1.0, 1.0, 0.0);
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
			
			fragColour = vec4(1.0, 1.0, 1.0, isSelected ? 0.2 : 0.0);
		}`;

	/**@type {BoardSelection[]}*/selections;
	/**@type {BoardSelection|null}*/currentSelection;

	/**
	 * @param {BoardRenderer} renderer
	 * @param {HTMLElement} viewport 
	 */
	constructor(renderer, viewport) {
		super();
		this.boardRenderer = renderer;
		this.viewport = viewport;
		this.selections = [];
		this.currentSelection = null;

		this.boardRenderer.addEventListener("positionchange", () => this.#queueSelectionsPositionsRedraw());
		this.boardRenderer.addEventListener("rotationchange", () => this.#queueSelectionsPositionsRedraw());
	}

	#queueSelectionsPositionsRedraw() {
		// Update selection handle positions
		requestAnimationFrame(() => {
			for (const selection of this.selections) {
				if (!selection.handles) {
					continue;
				}

				this.#updateSelectionHandles(selection);
				this.#updateSelectionLabel(selection);
			}
		})
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} width
	 * @param {number} height
	 * @returns {import("./board-renderer.js").RenderLayer}
	 */
	createSelectionLayer(x, y, width, height) {
		const selectionTex = this.#createSelectionTexture(width, height);
		const layerShader = this.boardRenderer.createLayerShader(BoardSelections.selectionFragmentSource, BoardRenderer.boardVertexSource, "u_selectionTex", {
			"u_selectionPos": {
				type: "2i"
			},
			"u_selectionSize": {
				type: "2i"
			}
		});
		const renderLayer = this.boardRenderer.addRenderLayer(selectionTex, layerShader, true, {
			"u_selectionPos": [ x, y ],
			"u_selectionSize": [ width, height ]
		});
		renderLayer.blendMode = "additive";

		return renderLayer;
	}

	/**
	 * @param {number} width 
	 * @param {number} height 
	 * @returns 
	 */
	#createSelectionTexture(width, height) {
		const gl = this.boardRenderer.getContext();
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

		return selectionTex;
	}

	/**
	 * @param {BoardSelection} selection
	 */
	#uploadSelectionTexture(selection) {
		if (!this.boardRenderer || !selection.layer || !selection.mask) {
			return;
		}

		const gl = this.boardRenderer.getContext();
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

	/**
	 * @param {BoardSelection} selection
	 */
	#createSelectionLabel(selection) {
		const labelEl = document.createElement("span");
		labelEl.dataset.x = String(selection.x);
		labelEl.dataset.y = String(selection.y);
		labelEl.classList.add("selection-label");
		this.viewport.appendChild(labelEl);

		return labelEl;
	}

	/**
	 * @param {BoardSelection} selection
	 * @param {"tl"|"tr"|"bl"|"br"} type 
	 */
	#createSelectionHandle(selection, type) {
		const handleEl = document.createElement("div");
		handleEl.dataset.type = type;
		handleEl.classList.add("selection-handle");
		this.viewport.appendChild(handleEl);

		/**@type {{ x: number, y:number }|null}*/let dragPos = null;
		/**
		 * @param {number} clientX 
		 * @param {number} clientY 
		 */
		const beginDrag = (clientX, clientY) => {
			const boardPos = this.boardRenderer.hitTest(clientX, clientY);
			if (!boardPos) {
				return;
			}

			dragPos = { x: Math.floor(boardPos.x), y: Math.floor(boardPos.y) };
			handleEl.style.cursor = "grabbing";
			this.setCurrentSelection(selection);
		}
		/**
		 * @param {number} clientX 
		 * @param {number} clientY 
		 */
		const dragMove = (clientX, clientY) => {
			if (!dragPos) {
				return;
			}

			const boardPos = this.boardRenderer.hitTest(clientX, clientY); 
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
			this.updateSelection(selection);
		}
		const endDrag = () => {
			dragPos = null;
			handleEl.style.cursor = "grab";
		}
		handleEl.addEventListener("mousedown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			beginDrag(e.clientX, e.clientY)
		});
		this.viewport.addEventListener("mousemove", (e) => dragMove(e.clientX, e.clientY));
		this.viewport.addEventListener("mouseup", () => endDrag());

		return handleEl;
	}

	/**
	 * @param {BoardSelection} selection
	 */
	#updateSelectionHandles(selection) {
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

			const screenCoords = this.boardRenderer.boardToCanvasElementCoords(x, y);
			handleEl.style.left = `${screenCoords.x}px`;
			handleEl.style.top = `${screenCoords.y}px`;
		}
	}

	/**
	 * @param {BoardSelection} selection
	 */
	#updateSelectionLabel(selection) {
		const labelEl = selection.label;
		if (!labelEl) {
			return;
		}

		labelEl.dataset.x = String(selection.x);
		labelEl.dataset.y = String(selection.y);
		const screenCoords = this.boardRenderer.boardToCanvasElementCoords(selection.x, selection.y);
		labelEl.style.left = `${screenCoords.x}px`;
		labelEl.style.top = `${screenCoords.y}px`;
		labelEl.textContent = `${selection.x},${selection.y}  (${selection.width}x${selection.height})`;
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} width
	 * @param {number} height
	 * @param {Uint8Array|null} mask
	 */
	addSelection(x, y, width, height, mask = null) {
		const layer = this.createSelectionLayer(x, y, width, height);
		
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
			tl: this.#createSelectionHandle(selection, "tl"),
			tr: this.#createSelectionHandle(selection, "tr"),
			bl: this.#createSelectionHandle(selection, "bl"),
			br: this.#createSelectionHandle(selection, "br")
		};
		selection.label = this.#createSelectionLabel(selection);
		this.selections.push(selection);
		this.updateSelection(selection);

		const selectionUpdateEvent = new CustomEvent("selectionadd", {
			detail: { selection },
			bubbles: true,
			composed: true
		});
		this.dispatchEvent(selectionUpdateEvent);
		this.#emitChangeEvent();
	}

	/**
	 * @param {BoardSelection} selection
	 */
	updateSelection(selection) {
		// DOM side
		this.#updateSelectionHandles(selection);
		this.#updateSelectionLabel(selection);

		// Renderer side
		// TODO: If the size of the selection has changed and is now bigger, we need
		// TODO: to create a new selection texture with the new size
		this.#uploadSelectionTexture(selection);
		selection.layer.uniforms = {
			"u_selectionPos": [ selection.x, selection.y ],
			"u_selectionSize": [ selection.width, selection.height ]
		};
		this.boardRenderer.queueRedraw();

		const selectionUpdateEvent = new CustomEvent("selectionupdate", {
			detail: { selection },
			bubbles: true,
			composed: true
		});
		this.dispatchEvent(selectionUpdateEvent);
		this.#emitChangeEvent();
	}

	/**
	 * @param {number|BoardSelection} value
	 */
	#toSelectionIndex(value) {
		let index = -1;
		if (typeof value === "number") {
			index = value;
		}
		else if (typeof value === "object") {
			const selection = /**@type {BoardSelection}*/(value);
			index = this.selections.indexOf(selection);
		}
		if (index < 0 || index >= this.selections.length) {
			return -1;
		}

		return index;
	}

	/**
	 * @param {number|BoardSelection} remove
	 */
	removeSelection(remove) {
		const index = this.#toSelectionIndex(remove);
		const selection = this.selections[index];
		if (!selection) {
			return -1;
		}

		// State
		this.selections.splice(index, 1);
		if (selection === this.currentSelection) {
			this.setCurrentSelection(null);
		}

		// DOM side
		if (selection.handles) {
			const { tl, tr, bl, br } = selection.handles;
			for (const handleEl of [ tl, tr, bl, br]) {
				handleEl?.remove();
			}
		}
		selection.label?.remove();

		// Renderer side
		this.boardRenderer.removeRenderLayer(selection.layer);
		this.boardRenderer.queueRedraw();

		const removeEvent = new CustomEvent("selectionremove", {
			detail: { selection },
			bubbles: true,
			composed: true
		});
		this.dispatchEvent(removeEvent);
		this.#emitChangeEvent();
		return index;
	}

	/**
	 * @param {BoardSelection|number|null} current 
	 */
	setCurrentSelection(current) {
		/**@type {BoardSelection|null}*/let selection = null;
		if (current !== null) {
			const index = this.#toSelectionIndex(current);
			if (index !== -1) {
				selection = this.selections[index] ?? null;
			}
		}

		if (this.currentSelection?.handles) {
			const { tl, tr, bl, br } = this.currentSelection.handles;
			tl.classList.remove("active");
			tr.classList.remove("active");
			bl.classList.remove("active");
			br.classList.remove("active");
		}

		const currentSelectionChangeEvent = new CustomEvent("currentselectionchange", {
			detail: { oldValue: this.currentSelection, newValue: selection },
			bubbles: true,
			composed: true
		});
		this.currentSelection = selection;

		if (this.currentSelection?.handles) {
			const { tl, tr, bl, br } = this.currentSelection.handles;
			tl.classList.add("active");
			tr.classList.add("active");
			bl.classList.add("active");
			br.classList.add("active");
		}

		this.dispatchEvent(currentSelectionChangeEvent);
		this.#emitChangeEvent();
	}

	#emitChangeEvent() {
		const changeEvent = new CustomEvent("change", {
			detail: { },
			bubbles: true,
			composed: true
		});
		this.dispatchEvent(changeEvent);
	}

	clearSelections() {
		// Remove all layers
		for (const selection of this.selections) {
			this.boardRenderer.removeRenderLayer(selection.layer);
		}
		
		this.selections.length = 0;
		this.boardRenderer.queueRedraw();

		const clearEvent = new CustomEvent("selectionsclear", {
			detail: { },
			bubbles: true,
			composed: true
		});
		this.dispatchEvent(clearEvent);
		this.#emitChangeEvent();
	}

	/**
	 * @param {BoardSelection} selection
	 * @param {number} localX - X coordinate within the selection
	 * @param {number} localY - Y coordinate within the selection
	 * @param {boolean} selected - Whether to select or deselect this pixel
	 */
	setSelectionPixel(selection, localX, localY, selected) {
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

		this.#uploadSelectionTexture(selection);
		this.boardRenderer.queueRedraw();
	}
}

