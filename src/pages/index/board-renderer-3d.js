"use strict";
import { BoardRenderer } from "./board-renderer.js";
import { mat4 } from "gl-matrix";

export class BoardRenderer3D extends BoardRenderer {
	/**@type {number}*/_rotationX;
	/**@type {number}*/_rotationY;
	/**@type {number}*/_rotationZ;

	/**
	 * @param {HTMLCanvasElement} canvas
	 * @param {Float32Array} uv
	 * @param {Float32Array} vertices
	 * @param {number} vertexCount
	 */
	constructor(canvas, uv, vertices, vertexCount) {
		super(canvas, uv, vertices, vertexCount);
		this._rotationX = 0;
		this._rotationY = 0;
		this._rotationZ = 0;

		// Enable depth testing and backface culling
		const gl = this._gl;
		gl.enable(gl.DEPTH_TEST);
		gl.enable(gl.CULL_FACE);
		gl.cullFace(gl.BACK);
		gl.frontFace(gl.CCW);
	}

	_updateMatrices() {
		const model = this._modelMatrix;
		const view = this._viewMatrix;
		const projection = this._projectionMatrix;  
		const mvp = this._mvpMatrix;

		// Calculate camera params
		const fov = Math.PI / 4; // 45 deg
		const aspect = this.canvas.width / this.canvas.height;
		const near = 0.01;
		const far = 100;

		const scale = 1 / (this._z * 50 * this._devicePixelRatio); 
		const camZ = scale;

		const ndcX = -(this._x - this._boardWidth / 2) / (this._boardWidth / 2);
		const ndcY = (this._y - this._boardHeight / 2) / (this._boardHeight / 2);

		// Reset matrices
		mat4.identity(model);
		mat4.identity(view);
		mat4.identity(projection);

		// View matrix: look from a point above canvas Z
		mat4.translate(view, view, [ndcX, ndcY, -camZ]);
		mat4.rotateX(view, view, this._rotationX);
		mat4.rotateY(view, view, this._rotationY);
		mat4.rotateZ(view, view, this._rotationZ);

		// Perspective projection matrix
		mat4.perspective(projection, fov, aspect, near, far);

		// Combine matrices
		mat4.multiply(mvp, projection, view);
		mat4.multiply(mvp, mvp, model);
	}

	/**
	 * @param {number} clientX 
	 * @param {number} clientY 
	 * @returns {{ x: number, y: number }|null}
	 */
	hitTest(clientX, clientY) {
		const gl = this._gl;
		const rect = this.canvas.getBoundingClientRect();
		const x = Math.floor((clientX - rect.left) * (gl.drawingBufferWidth / rect.width));
		const y = Math.floor((rect.bottom - clientY) * (gl.drawingBufferHeight / rect.height));

		// Framebuffer tex must be 1:1 with screen else readback will break entirely
		this._updatePickFrameBufferSize(); //TODO: only on resize

		// Init
		gl.bindFramebuffer(gl.FRAMEBUFFER, this._pickFBO);
		gl.viewport(0.0, 0.0, this.canvas.width, this.canvas.height);
		gl.clearBufferuiv(gl.COLOR, 0, new Uint32Array([0, 0, 0, 0]));
		gl.disable(gl.BLEND);

		// Update matrices
		this._updateMatrices();

		gl.useProgram(this._pickProgram);
		gl.bindVertexArray(this._vao);
		gl.uniformMatrix4fv(this._pickMvpUniformLoc, false, this._mvpMatrix);
		gl.uniform2i(this._pickBoardSizeUniformLoc, this._boardWidth, this._boardHeight);
		
		// Bind pick texture
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this._pickTex);
		gl.uniform1i(this._pickTexUniformLoc, 0);

		gl.drawArrays(gl.TRIANGLES, 0, this._vertexCount);

		// Readback
		const pixel = new Uint8Array(4);
		gl.readPixels(x, y, 1, 1, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, pixel);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		const error = gl.getError();
		if (error !== gl.NO_ERROR) {
			console.error("WebGL Error in hitTest:", error);
			return null;
		}
	
		if (pixel[0] === 255 && pixel[1] === 255 && pixel[2] === 255 && pixel[3] === 255) {
			return null;
		}

		const pixelId = pixel[0] | (pixel[1] << 8) | (pixel[2] << 16) | (pixel[3] << 24);

		// Convert pixel ID back to screen coordinates
		const boardX = pixelId % this._boardWidth;
		const boardY = Math.floor(pixelId / this._boardWidth);

		return { x: boardX, y: boardY };
	}

	enableBackfaceCulling() {
		this._gl.enable(this._gl.CULL_FACE);
	}

	disableBackfaceCulling() {
		this._gl.disable(this._gl.CULL_FACE);
	}

    _draw() {
		const gl = this._gl;

		// Check if sources are properly initialized
		if (!this._board || !this._palette || this._boardWidth === 0 || this._boardHeight === 0) {
			return;
		}

		gl.viewport(0, 0, this.canvas.width, this.canvas.height);
		gl.clearColor(0.0, 0.0, 0.0, 0.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		// Update matrices
		this._updateMatrices();

		// Render all enabled layers in order
		for (const layer of this._renderLayers) {
			this._renderLayer(layer);
		}

		const error = gl.getError();
		if (error !== gl.NO_ERROR) {
			console.error("WebGL Error:", error);
		}
    }
}