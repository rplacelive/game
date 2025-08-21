"use strict";
import { BoardRenderer } from "./board-renderer.js";
import { mat4 } from "gl-matrix";

export class BoardRendererSphere extends BoardRenderer {
	static sphereVertexSource = `#version 300 es
		in vec3 a_position;
		in vec2 a_uv;
		out vec2 v_uv;

		uniform mat4 u_modelViewProjection;

		void main() {
			v_uv = vec2(a_uv.x, 1.0 - a_uv.y);
			gl_Position = u_modelViewProjection * vec4(a_position, 1.0); 
		}`;

	static sphereFragmentSource = `#version 300 es
		precision highp float;
		precision highp usampler2D;

		in highp vec2 v_uv;
		out vec4 fragColour;

		uniform usampler2D u_boardTex;
		uniform usampler2D u_paletteTex;
		uniform ivec2 u_boardSize;
		uniform vec3 u_xyz;
		uniform float u_radius;
		uniform float u_strength;

		void main() {
			vec2 centerOffset = v_uv - 0.5;
			float distFromCenter = length(centerOffset);
			
			float scaledRadius = u_radius * u_xyz.z;
			
			if (distFromCenter > scaledRadius) {
				fragColour = vec4(0.0, 0.0, 0.0, 0.0);
				return;
			}
			
			vec2 bulgedUV = v_uv;
			if (distFromCenter > 0.0) {
				float normalizedDist = distFromCenter / scaledRadius;
				float z = sqrt(1.0 - normalizedDist * normalizedDist);
				float newRadius = atan(normalizedDist, z) / (3.14159265359 * 0.5);
				bulgedUV = 0.5 + normalize(centerOffset) * newRadius * scaledRadius;
			}
			
			vec2 targetUV = (vec2(u_xyz.xy) + 0.5) / vec2(u_boardSize);
			vec2 uv = (bulgedUV - 0.5) / (u_xyz.z) + 0.5;
			uv += (0.5 - targetUV);

			uv = mod(uv, 1.0);

			ivec2 texelCoord = ivec2(uv * vec2(u_boardSize));
			uint index = texelFetch(u_boardTex, texelCoord, 0).r;

			if (index == 255u) {
				fragColour = vec4(1.0, 1.0, 1.0, 0.0);
				return;
			}

			uvec4 raw = texelFetch(u_paletteTex, ivec2(int(index), 0), 0);
			fragColour = vec4(raw) / 255.0;
		}`;

	/**
	 * @param {HTMLCanvasElement} canvas
	 */
	constructor(canvas) {
		super(canvas, BoardRenderer.uv, BoardRenderer.vertices, 6,
			BoardRendererSphere.sphereFragmentSource, BoardRendererSphere.sphereVertexSource);
		
		const layerShader = this.createLayerShader(
			BoardRendererSphere.sphereFragmentSource, BoardRendererSphere.sphereVertexSource, "u_boardTex", {
			"u_xyz": {
				type: "3f"
			},
			"u_radius": {
				type: "1f"
			}
		});
		this._boardLayerShader = layerShader;
		this._renderLayers[0].shader = layerShader;
		this._renderLayers[1].shader = layerShader;
		this._renderLayers[2].shader = layerShader;
		this._updateUniforms();
	}

	_updateUniforms() {
		const boardUniforms = {
			u_xyz: [-this._x, -this._y, this._z * this._devicePixelRatio * 50],
			u_radius: 0.5 * this._devicePixelRatio
		};
		this._renderLayers[0].uniforms = boardUniforms;
		this._renderLayers[1].uniforms = boardUniforms;
		this._renderLayers[2].uniforms = boardUniforms;
	}

	_updateMatrices() {
		this._updateUniforms();
		return;
	}
}