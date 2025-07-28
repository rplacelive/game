"use strict";
import { boardRenderer } from "./viewport.js";

const selectionDimFragment = `#version 300 es
	precision highp float;
	precision highp usampler2D;

	in vec2 v_uv;
	out vec4 fragColour;

	uniform usampler2D u_selectionTex;

	void main() {
		ivec2 texSize = textureSize(u_selectionTex, 0);
		ivec2 texelCoord = ivec2(v_uv * vec2(texSize));

		// Get selection value
		uint value = texelFetch(u_selectionTex, texelCoord, 0).r;
		fragColour = vec4(1.0, 1.0, 1.0, float(value) / 255.0);
	}`;

const createSelectionButton = /**@type {HTMLButtonElement}*/(document.getElementById("avmCreateSelectionButton"));

createSelectionButton.addEventListener("click", function(e) {
	if (!boardRenderer) {
		return;
	}

	const boardWidth = boardRenderer.getBoardWidth();
	const boardHeight = boardRenderer.getBoardHeight();
	const selectionMask = new Uint8Array(boardWidth * boardHeight).fill(128);

	// Create layer shader for selection
	const gl = boardRenderer.getContext();
	const selectionTex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, selectionTex);
	gl.texImage2D(
		gl.TEXTURE_2D, // target
		0, // internal level
		gl.R8UI, // format
		boardWidth, // width
		boardHeight, // height
		0, // border
		gl.RED_INTEGER, // format
		gl.UNSIGNED_BYTE, // type
		selectionMask //data
	);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	const layerShader = boardRenderer.createLayerShader(selectionDimFragment, "u_selectionTex");

	// Add to render layers
	boardRenderer.addRenderLayer(selectionTex, layerShader);
	boardRenderer.queueRedraw();
});
