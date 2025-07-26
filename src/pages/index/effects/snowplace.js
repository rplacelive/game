// @ts-expect-error No typescript definitions
import CanvasSnow from "@cycjimmy/canvas-snow";

/**@type {CanvasSnow}*/let winterCanvasSnow = null;
/**@type {HTMLImageElement|null}*/let winterHat = null;

/**
 * @param {Function} forceTheme 
 */
export function enable(forceTheme) {
	forceTheme("r/place 2022", "light")
	console.log(
		"%cHappy Holidays!",
		"font-size: 24px;color: #c00; background-color: #fff; padding: 10px; border: 2px solid #00f; border-radius: 5px; text-shadow: 1px 1px 0 #c00, 2px 2px 0 #00f, 3px 3px 0 #c00, 4px 4px 0 #00f, 5px 5px 0 #c00, 6px 6px 0 #00f, 7px 7px 0 #c00, 8px 8px 0 #00f, 9px 9px 0 #c00, 10px 10px 0 #00f, 11px 11px 0 #c00, 12px 12px 0 #00f, 13px 13px 0 #c00, 14px 14px 0 #00f, 15px 15px 0 #c00, 16px 16px 0 #00f, 17px 17px 0 #c00, 18px 18px 0 #00f, 19px 19px 0 #c00, 20px 20px 0 #00f"
	);
	winterHat = document.createElement("img");
	winterHat.src = "/svg/santa-hat.svg";
	winterHat.setAttribute("style", "position: absolute;  height: 128px; z-index: 22;left: calc(50% - 160px);top: calc(50% - 110px);transform: rotate(-30deg);");
	document.getElementById("loadingScreen")?.appendChild(winterHat);

	winterCanvasSnow = new CanvasSnow({
		context: "#bgWrapper",
		cell: 30
	}).init();
	winterCanvasSnow.start();
}

export function disable() {
	winterHat?.remove();
	winterCanvasSnow?.stop();
	winterCanvasSnow?.clear();
}