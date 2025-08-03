"use strict";
import { boardRenderer } from "./viewport.js";
import { $ } from "../../shared.js";
import { BoardSelections } from "./board-selections.js";
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
						<button type="button" @click=${() => this.#handleSelectionDelete(selection)}>x</button>
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