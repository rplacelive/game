import { $ } from "./shared.js";

export let enableWebglCanvas = localStorage.enableWebglCanvas === "true";
export let enableNewOverlayMenu = localStorage.enabledNewOverlayMenu === "true";

// Experimental settings
const enableWebglCanvasCheckbox = /**@type {HTMLInputElement}*/($("#enableWebglCanvasCheckbox"));
enableWebglCanvasCheckbox.checked = enableWebglCanvas;
enableWebglCanvasCheckbox.addEventListener("change", function() {
	enableWebglCanvas = !enableWebglCanvas;
	localStorage.enableWebglCanvas = String(enableWebglCanvas);
	enableWebglCanvasCheckbox.checked = enableWebglCanvas;
});
const enableNewOverlayMenuCheckbox = /**@type {HTMLInputElement}*/($("#enableNewOverlayMenuCheckbox"));
enableNewOverlayMenuCheckbox.checked = !enableNewOverlayMenu;
enableNewOverlayMenuCheckbox.addEventListener("change", function() {
	enableNewOverlayMenu = !enableNewOverlayMenu;
	localStorage.enabledNewOverlayMenu = String(enableNewOverlayMenu);
	enableNewOverlayMenuCheckbox.checked = enableNewOverlayMenu;
});

// Secret settings
const editLocalStorageList = /**@type {HTMLElement}*/($("#editLocalStorageList"));
function refreshEditLocalStorageList() {
	editLocalStorageList.innerHTML = "";
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key === null) {
			continue;
		}
	
		const li = document.createElement("li");
		const label = document.createElement("label");
		const span = document.createElement("span");
		span.textContent = key;
		label.appendChild(span);
		const input = document.createElement("input");
		input.type = "text";
		input.placeholder = key ? localStorage.getItem(key) || "" : "";
		input.addEventListener("change", function() {
			if (confirm(`Are you sure you want to change localStorage item '${key}''s value to '${input.value}'`)) {
				localStorage.setItem(key, input.value);
				input.placeholder = input.value;
			}
		});
		label.appendChild(input);
		li.appendChild(label);
		const button = document.createElement("button");
		button.textContent = "x";
		button.addEventListener("click", function() {
			if (confirm(`Are you sure you want to delete localStorage item '${key}'?`)) {
				localStorage.removeItem(key);
				li.remove();
			}
		});
		li.appendChild(button);
		editLocalStorageList.appendChild(li);
	}	
}
refreshEditLocalStorageList();
