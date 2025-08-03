"use strict";
import { boardRenderer } from "./viewport.js";
import { $ } from "../../shared.js";
import { BoardSelections } from "./board-selections.js";
import { BOARD, PALETTE, WIDTH } from "./game-state.js";
import { html, LitElement } from "lit-element";

const viewport = /**@type {HTMLElement}*/($("#viewport"));
const advancedViewMenu = /**@type {HTMLElement}*/($("#advancedViewMenu"));
const closeButton = /**@type {HTMLButtonElement}*/($("#avmCloseButton"));
const createSelectionButton = /**@type {HTMLButtonElement}*/($("#avmCreateSelectionButton"));
const viewCanvasLayer = /**@type {HTMLInputElement}*/($("#viewCanvasLayer"));
const viewChangesLayer = /**@type {HTMLInputElement}*/($("#viewChangesLayer"));
const viewSocketPixelsLayer = /**@type {HTMLInputElement}*/($("#viewSocketPixelsLayer"));
const selectionsDisplay = /**@type {SelectionsDisplay}*/($("#avmSelectionsDisplay"));

class SelectionsDisplay extends LitElement {
	static properties = {
		boardSelections: { type: Object, reflect: false }
	}

	/**@type {EventListener}*/#boundOnChange;

	constructor() {
		super();
		/**@type {import("./board-selections.js").BoardSelections|null}*/ this.boardSelections = null;
		this.#boundOnChange = () => this.requestUpdate();
	}

	createRenderRoot() {
		return this;
	}

	render() {
		if (!this.boardSelections) {
			return html``;
		}

		return html`
			<ul>
				${this.boardSelections.selections.map((selection) => html`
					<li>
						<label>
							<input type="radio" .checked=${selection === this.boardSelections?.currentSelection}
								@change=${() => this.#handleCurrentSelectionChange(selection)}>
							<span>${selection.x},${selection.y} (${selection.width}x${selection.height})</span>
						</label>
						<button type="button" title="Download" class="selection-action">
							<img src="/svg/download.svg" alt="Download" @click=${() => this.#handleSelectionDownload(selection)}>
						</button>
						<button type="button" title="Delete" @click=${() => this.#handleSelectionDelete(selection)}>
							<img src="/svg/close.svg" alt="x">
						</button>
					</li>`
				)}
			</ul>`;
	}

	/**
	 * @param {import("./board-selections.js").BoardSelections} boardSelections 
	 */
	setBoardSelections(boardSelections) {
		if (this.boardSelections) {
			this.boardSelections.removeEventListener("change", this.#boundOnChange);
		}
		this.boardSelections = boardSelections;
		this.boardSelections.addEventListener("change", this.#boundOnChange);
		this.requestUpdate();
	}

	/**
	 * @param {import("./board-selections.js").BoardSelection} selection
	 */
	#handleSelectionDownload(selection) {
		const selectionDownloadEvent = new CustomEvent("selectionDownload", {
			detail: { selection },
			bubbles: true,
			composed: true
		});
		this.dispatchEvent(selectionDownloadEvent);
	}

	/**
	 * @param {import("./board-selections.js").BoardSelection} selection 
	 */
	#handleSelectionDelete(selection) {
		this.boardSelections?.removeSelection(selection);
	}

	/**
	 * @param {import("./board-selections.js").BoardSelection} selection 
	 */
	#handleCurrentSelectionChange(selection) {
		this.boardSelections?.setCurrentSelection(selection);
	}
}
customElements.define("r-selections-display", SelectionsDisplay);


/** @type {BoardSelections|null} */
export let boardSelections = null;
if (boardRenderer) {
	boardSelections = new BoardSelections(boardRenderer, viewport);
	selectionsDisplay.setBoardSelections(boardSelections);

	selectionsDisplay.addEventListener("selectionDownload", (/**@type {Event}*/e) => {
		if (!(e instanceof CustomEvent)) {
			throw new Error("Selection download event was not of type CustomEvent");
		}
		if (!BOARD || !PALETTE) {
			return;
		} 

		const selection = /**@type {import("./board-selections.js").BoardSelection}*/(e.detail.selection);
		
		// Create canvas and context
		const canvas = document.createElement("canvas");
		canvas.width = selection.width;
		canvas.height = selection.height;
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			throw new Error("Failed to get selection download canvas context");
		}
		
		// Create ImageData
		const imageData = ctx.createImageData(selection.width, selection.height);
		const data = imageData.data;
		
		// Extract selection region from board composite and convert to RGBA
		let dataIndex = 0;
		for (let y = 0; y < selection.height; y++) {
			const boardRowStart = (selection.y + y) * WIDTH + selection.x;
			for (let x = 0; x < selection.width; x++) {
				const paletteIndex = BOARD[boardRowStart + x];
				const color = PALETTE[paletteIndex];
				
				data[dataIndex++] = (color >>> 16) & 0xFF; // R
				data[dataIndex++] = (color >>> 8) & 0xFF;  // G
				data[dataIndex++] = color & 0xFF;          // B
				data[dataIndex++] = (color >>> 24) & 0xFF; // A
			}
		}
		
		// Put image data on canvas and download
		ctx.putImageData(imageData, 0, 0);
		canvas.toBlob((blob) => {
			if (!blob) {
				throw new Error("Selection download image data was null");
			}

			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `selection_${selection.x}_${selection.y}_${selection.width}x${selection.height}.png`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}, "image/png");
	});
}

createSelectionButton.addEventListener("click", function (e) {
	if (!boardSelections) {
		return;
	}

	boardSelections.addSelection(50, 50, 100, 100);
});

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