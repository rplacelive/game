"use strict";
import * as gio from "@thi.ng/geom-io-obj";
import { BoardRenderer3D } from "./board-renderer-3d";

export class BoardRendererMesh extends BoardRenderer3D {
	/**@type {import("@thi.ng/geom-io-obj").OBJModel}*/_object;

	/**
	 * @param {HTMLCanvasElement} canvas
	 * @param {string} objSource  
	 */
	constructor(canvas, objSource) {
		const model = gio.parseOBJ(objSource, { tessellate: true });

		const boardObject = model.objects.find(object => object.id === "Board");
		if (!boardObject) {
			throw new Error("Could not locate 'Board' object within mesh");
		}
		const boardFaces = boardObject.groups[0].faces;

		const vertices = new Float32Array(boardFaces.length * 9); // 3 vertices per face, 3 coords per vertex
		const uv = new Float32Array(boardFaces.length * 6); // 3 vertices per face, 2 UV coords per vertex
		for (let i = 0; i < boardFaces.length; i++) {
			const face = boardFaces[i];
			for (let j = 0; j < 3; j++) {
				const vertexIndex = face.v[j]; // vertex index from face.v array
				const uvIndex = face.uv ? face.uv[j] : vertexIndex; // UV index from face.uv array
				
				const vi = (i * 9) + (j * 3);
				const ui = (i * 6) + (j * 2);
				
				vertices[vi] = model.vertices[vertexIndex][0];
				vertices[vi + 1] = model.vertices[vertexIndex][1];
				vertices[vi + 2] = model.vertices[vertexIndex][2];
				
				if (model.uvs && uvIndex < model.uvs.length) {
					uv[ui] = model.uvs[uvIndex][0];
					uv[ui + 1] = model.uvs[uvIndex][1];
				}
				else {
					// Default UV coords if none available
					uv[ui] = 0;
					uv[ui + 1] = 0;
				}
			}
		}
		super(canvas, uv, vertices, boardFaces.length * 3);
		this._object = model;
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

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} z
	 */
	setRotation(x, y, z) {
		this._rotationX = x;
		this._rotationY = y;
		this._rotationZ = z;
		this.queueRedraw();

		const rotationChangeEvent = new CustomEvent("rotationchange", {
			detail: { x, y, z },
			bubbles: true,
			composed: true
		});
		this.dispatchEvent(rotationChangeEvent);
	}
}