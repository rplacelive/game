"use strict";
import { mat4, vec4 } from "gl-matrix";

/**
 * @typedef {Object} UniformSchema
 * @property {string} type - Uniform type: "1f", "2f", "3f", "4f", "1i", "2i", "3i", "4i", "mat4", "sampler2D"
 * @property {number} [textureUnit] - For sampler2D uniforms, which texture unit to use
 */

/**
 * @typedef {Object} LayerShader
 * @property {WebGLProgram} program
 * @property {WebGLUniformLocation} mvpUniformLoc 
 * @property {WebGLUniformLocation} boardSizeUniformLoc
 * @property {WebGLUniformLocation} textureUniformLoc
 * @property {WebGLUniformLocation} paletteTexUniformLoc
 * @property {Object<string, UniformSchema>} [uniformSchema] - Schema for additional uniforms
 * @property {Record<string, WebGLUniformLocation>} [uniformLocations] - Cached uniform locations
 */

/**
 * @typedef {Object} RenderLayer
 * @property {WebGLTexture} texture
 * @property {LayerShader} shader
 * @property {string} [blendMode]
 * @property {boolean} enabled
 * @property {Object<string, any>} [uniforms] - Values for custom uniforms
 */

export class BoardRenderer {
	/**@type {HTMLCanvasElement}*/canvas;
	/**@type {WebGL2RenderingContext}*/_gl;
	/**@type {ResizeObserver}*/_resizeObserver;

	// We separate into different render layers for mod & debugging purposes
	/**@type {Uint8Array|null}*/_board = null;
	/**@type {Uint8Array|null}*/_changes = null;
	/**@type {Uint8Array|null}*/_socketPixels = null;	
	/**@type {Uint32Array|null}*/_palette = null;
	/**@type {number}*/_boardWidth = 0;
	/**@type {number}*/_boardHeight = 0;
	/**@type {number|null}*/_redrawHandle = null;
	/**@type {number}*/_x = 0;
	/**@type {number}*/_y = 0;
	/**@type {number}*/_zoom = 1;
	/**@type {number}*/_devicePixelRatio = 1;

	// Default textures and shader program
	/**@type {WebGLProgram}*/_boardProgram;
	/**@type {WebGLVertexArrayObject}*/_vao;
	/**@type {WebGLTexture}*/_canvasTex;
	/**@type {WebGLTexture}*/_changesTex;
	/**@type {WebGLTexture}*/_socketPixelsTex;
	/**@type {WebGLTexture}*/_paletteTex;

	// Transform handling
	/**@type {mat4}*/_modelMatrix;
	/**@type {mat4}*/_viewMatrix;
	/**@type {mat4}*/_projectionMatrix;
	/**@type {mat4}*/_mvpMatrix;

	// Default board shader handling
	/**@type {WebGLUniformLocation}*/_boardMvpUniformLoc;
	/**@type {WebGLUniformLocation}*/_boardSizeUniformLoc;
	/**@type {WebGLUniformLocation}*/_boardTexUniformLoc;
	/**@type {WebGLUniformLocation}*/_paletteTexUniformLoc;

	// Render layers configuration
	/**@type {LayerShader}*/_boardLayerShader;
	/**@type {Array<RenderLayer>}*/_renderLayers = [];

	// Picking handling
	/**@type {WebGLFramebuffer}*/_pickFBO;
	/**@type {WebGLTexture}*/_pickFBOTex;
	/**@type {WebGLTexture}*/_pickTex;
	/**@type {WebGLProgram}*/_pickProgram;
	/**@type {WebGLUniformLocation}*/_pickMvpUniformLoc;
	/**@type {WebGLUniformLocation}*/_pickBoardSizeUniformLoc;
	/**@type {WebGLUniformLocation}*/_pickTexUniformLoc;

	// Geometry
	/**@type {Float32Array}*/_uv;
	/**@type {Float32Array}*/_vertices;
	/**@type {number}*/_vertexCount;

	static uv = new Float32Array([
			0.0, 0.0,
			1.0, 0.0,
			0.0, 1.0,
			0.0, 1.0,
			1.0, 0.0,
			1.0, 1.0
		]);
	static vertices = new Float32Array([
			-1.0, -1.0, 0.0,
			1.0, -1.0, 0.0,
			-1.0,  1.0, 0.0,
			-1.0,  1.0, 0.0,
			1.0, -1.0, 0.0,
			1.0,  1.0, 0.0
		]);

	// Shaders
	static boardVertexSource = `#version 300 es
		in vec3 a_position;
		in vec2 a_uv;
		out vec2 v_uv;

		uniform mat4 u_modelViewProjection;

		void main() {
			v_uv = vec2(a_uv.x, 1.0 - a_uv.y);
			gl_Position = u_modelViewProjection * vec4(a_position, 1.0); 
		}`;

	static boardFragmentSource = `#version 300 es
		precision highp float;
		precision highp usampler2D;

		in highp vec2 v_uv;
		out vec4 fragColour;

		uniform usampler2D u_boardTex;
		uniform usampler2D u_paletteTex;
		uniform ivec2 u_boardSize;

		void main() {
			ivec2 texelCoord = ivec2(v_uv * vec2(u_boardSize));

			// Get palette index from board texture
			uint index = texelFetch(u_boardTex, texelCoord, 0).r;
			
			if (index == 255u) {
				// Changes / socketPixels alpha index
				fragColour = vec4(1.0, 1.0, 1.0, 0.0);
				return;
			}

			// Get colour from palette texture
			uvec4 raw = texelFetch(u_paletteTex, ivec2(int(index), 0), 0);

			// Convert to normalized float
			fragColour = vec4(raw) / 255.0;
		}`;
	static pickFragmentSource = `#version 300 es
		precision highp float;
		precision highp usampler2D;

		in highp vec2 v_uv;
		layout(location = 0) out uvec4 fragColour;

		uniform usampler2D u_pickTex;
		uniform ivec2 u_boardSize;

		void main() {
			ivec2 texelCoord = ivec2(v_uv * vec2(u_boardSize));
			uvec4 pixelId = texelFetch(u_pickTex, texelCoord, 0);

			if (texelCoord.x >= 0 && texelCoord.x < u_boardSize.x && 
				texelCoord.y >= 0 && texelCoord.y < u_boardSize.y) {
				fragColour = pixelId;
			}
			else {
				// Outside board bounds - output invalid ID
				fragColour = uvec4(255u, 255u, 255u, 255u);
			}
		}`;

	/**
	 * @param {HTMLCanvasElement} canvas
	 * @param {Float32Array} uv
	 * @param {Float32Array} vertices
	 * @param {number} vertexCount
	 */
	constructor(canvas, uv = BoardRenderer.uv, vertices = BoardRenderer.vertices, vertexCount = 6) {
		this.canvas = canvas;
		this._uv = uv;
		this._vertices = vertices;
		this._vertexCount = vertexCount;

		// Init context & handlers
		this._resizeObserver = new ResizeObserver(() => {
			this._updateCanvasSize();
			this._updatePickFrameBufferSize();
			this.queueRedraw();
		});
		this._resizeObserver.observe(canvas);
		window.addEventListener("resize", () => {
			this._devicePixelRatio = window.devicePixelRatio ?? 1;
			this._updateCanvasSize();
			this._updatePickFrameBufferSize();
		});
		this._devicePixelRatio = window.devicePixelRatio ?? 1;
		const gl = this._gl = /**@type {WebGL2RenderingContext}*/(canvas.getContext("webgl2", { alpha: true }));
		if (!gl) {
			throw new Error("WebGL2 not supported");
		}

		// Shader setup
		const boardProgram = this._boardProgram = this._createShader(
			BoardRenderer.boardFragmentSource, BoardRenderer.boardVertexSource);

		// Vertex array setup
		const vao = this._vao = gl.createVertexArray();
		gl.bindVertexArray(vao);

		// Vertex position buffer setup
		const vbo = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
		gl.bufferData(gl.ARRAY_BUFFER, this._vertices, gl.STATIC_DRAW);

		const posLoc = gl.getAttribLocation(boardProgram, "a_position");
		gl.enableVertexAttribArray(posLoc);
		gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

		const uvBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, this._uv, gl.STATIC_DRAW);

		const uvLoc = gl.getAttribLocation(boardProgram, "a_uv");
		gl.enableVertexAttribArray(uvLoc);
		gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

		// Default textures and board dimensions
		this._boardWidth = 1;
		this._boardHeight = 1;
		this._canvasTex = this._createBoardTexture();
		this._changesTex = this._createBoardTexture();
		this._socketPixelsTex = this._createBoardTexture();

		const paletteTex = this._paletteTex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, paletteTex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI, 1, 1, 0, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, new Uint8Array(4));
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		
		// Uniform locations
		this._boardMvpUniformLoc = /**@type {WebGLUniformLocation}*/ (gl.getUniformLocation(boardProgram, "u_modelViewProjection"));
		this._boardTexUniformLoc = /**@type {WebGLUniformLocation}*/ (gl.getUniformLocation(boardProgram, "u_boardTex"));
		this._boardSizeUniformLoc = /**@type {WebGLUniformLocation}*/ (gl.getUniformLocation(boardProgram, "u_boardSize"));
		this._paletteTexUniformLoc = /**@type {WebGLUniformLocation}*/ (gl.getUniformLocation(boardProgram, "u_paletteTex"));

		// Create default board layer shader
		this._boardLayerShader = {
			program: this._boardProgram,
			mvpUniformLoc: this._boardMvpUniformLoc,
			boardSizeUniformLoc: this._boardSizeUniformLoc,
			paletteTexUniformLoc: this._paletteTexUniformLoc,
			textureUniformLoc: this._boardTexUniformLoc
		}

		// Create pick handler framebuffer
		const pickFBO = this._pickFBO = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, pickFBO);

		this._pickTex = this._createPickTexture();
		
		const pickProgram = this._pickProgram = this._createShader(BoardRenderer.pickFragmentSource, BoardRenderer.boardVertexSource);
		this._pickMvpUniformLoc = /**@type {WebGLUniformLocation}*/(gl.getUniformLocation(pickProgram, "u_modelViewProjection"));
		this._pickBoardSizeUniformLoc = /**@type {WebGLUniformLocation}*/(gl.getUniformLocation(pickProgram, "u_boardSize"));
		this._pickTexUniformLoc = /**@type {WebGLUniformLocation}*/(gl.getUniformLocation(pickProgram, "u_pickTex"));

		const pickFBOTex = this._pickFBOTex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, pickFBOTex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI, canvas.width, canvas.height, 0, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, pickFBOTex, 0);

		const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
		if (status !== gl.FRAMEBUFFER_COMPLETE) {
			console.error("Incomplete framebuffer:", status.toString(16));
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		// Initialize render layers
		this._initialiseRenderLayers();

		// Initialise matrices
		const model = this._modelMatrix = mat4.create();
		mat4.identity(model);
		const view = this._viewMatrix = mat4.create();
		mat4.identity(view);
		const projection = this._projectionMatrix = mat4.create();
		mat4.identity(projection);
		const mvp = this._mvpMatrix = mat4.create();
		mat4.identity(mvp);

		// Initial canvas size update
		this._updateCanvasSize();
	}

	_initialiseRenderLayers() {
		this._renderLayers = [
			{
				texture: this._canvasTex,
				shader: this._boardLayerShader,
				enabled: true,
				uniforms: {
					"u_paletteTex": this._paletteTex
				}
			},
			{
				texture: this._changesTex,
				shader: this._boardLayerShader,
				enabled: true,
				uniforms: {
					"u_paletteTex": this._paletteTex
				}
			},
			{
				texture: this._socketPixelsTex,
				shader: this._boardLayerShader,
				enabled: true,
				uniforms: {
					"u_paletteTex": this._paletteTex
				}
			}
		];
	}

	getContext() {
		return this._gl;
	}

	/**
	 * Enable or disable a specific render layer
	 * @param {number} layerIndex - 0: board, 1: changes, 2: socketPixels
	 * @param {boolean} enabled
	 */
	setLayerEnabled(layerIndex, enabled) {
		if (this._renderLayers[layerIndex]) {
			this._renderLayers[layerIndex].enabled = enabled;
			this.queueRedraw();
		}
	}

	/**
	 * Add a new render layer
	 * @param {WebGLTexture} texture
	 * @param {LayerShader} shader
	 * @param {boolean} enabled
	 * @param {Object<string, any>} [uniforms] - Custom uniform values
	 */
	addRenderLayer(texture, shader = this._boardLayerShader, enabled = true, uniforms = {}) {
		const layer = { texture, shader, enabled, uniforms };
		this._renderLayers.push(layer);
		this.queueRedraw();
		return layer;
	}

	/**
	 * @param {RenderLayer} layer 
	 */
	removeRenderLayer(layer) {
		const index = this._renderLayers.indexOf(layer);
		if (index != -1) {
			this._renderLayers.splice(index, 1);
		}
		this.queueRedraw();
		return index;
	}

	/**
	 * Update uniform values for a specific layer
	 * @param {RenderLayer} layer
	 * @param {Object<string, any>} uniforms
	 */
	updateLayerUniforms(layer, uniforms) {
		if (!layer.uniforms) {
			layer.uniforms = {};
		}
		Object.assign(layer.uniforms, uniforms);
		this.queueRedraw();
	}

	/**
	 * @param {string} fragmentSource 
	 * @param {string} vertexSource 
	 * @param {string} textureUniform
	 * @param {Object<string, UniformSchema>} [uniformSchema] - Schema for custom uniforms
	 * @returns {LayerShader} 
	 */
	createLayerShader(fragmentSource = BoardRenderer.boardFragmentSource, vertexSource = BoardRenderer.boardVertexSource, textureUniform = "u_boardTex", uniformSchema = {}) {
		const gl = this._gl;
		const program = this._createShader(fragmentSource, vertexSource);
		const textureUniformLoc = /**@type {WebGLUniformLocation}*/ (gl.getUniformLocation(program, textureUniform));
		const mvpUniformLoc = /**@type {WebGLUniformLocation}*/ (gl.getUniformLocation(program, "u_modelViewProjection"));
		const boardSizeUniformLoc = /**@type {WebGLUniformLocation}*/ (gl.getUniformLocation(program, "u_boardSize"));
		const paletteTexUniformLoc = /**@type {WebGLUniformLocation}*/ (gl.getUniformLocation(program, "u_paletteTex"));

		// Cache uniform locations for custom uniforms
		/**@type {Record<string, WebGLUniformLocation>}*/const uniformLocations = {};
		let nextTextureUnit = 2; // Start after reserved units

		for (const [name, schema] of Object.entries(uniformSchema)) {
			const location = gl.getUniformLocation(program, name);
			if (location) {
				uniformLocations[name] = location;
				// Assign texture units for sampler2D uniforms if not specified
				if (schema.type === "sampler2D" && schema.textureUnit === undefined) {
					schema.textureUnit = nextTextureUnit++;
				}
			}
		}

		return {
			program,
			mvpUniformLoc,
			boardSizeUniformLoc,
			paletteTexUniformLoc,
			textureUniformLoc,
			uniformSchema,
			uniformLocations
		}
	}

	/**
	 * Bind custom uniforms based on schema
	 * @param {WebGL2RenderingContext} gl
	 * @param {LayerShader} shader
	 * @param {Record<string, any>} uniformValues
	 */
	_bindCustomUniforms(gl, shader, uniformValues) {
		if (!shader.uniformSchema || !shader.uniformLocations || !uniformValues) {
			return;
		}

		for (const [name, schema] of Object.entries(shader.uniformSchema)) {
			const location = shader.uniformLocations[name];
			const value = uniformValues[name];

			if (!location || value === undefined) {
				continue;
			}

			switch (schema.type) {
				case "1f":
					/**@type {number}*/const v1f = value;
					gl.uniform1f(location, v1f);
					break;
				case "2f":
					/**@type {[number, number]}*/const v2f = value;
					gl.uniform2f(location, ...v2f);
					break;
				case "3f":
					/**@type {[number, number, number]}*/const v3f = value;
					gl.uniform3f(location, ...v3f);
					break;
				case "4f":
					/**@type {[number, number, number, number]}*/const v4f = value;
					gl.uniform4f(location, ...v4f);
					break;
				case "1i":
					/**@type {number}*/const v1i = value;
					gl.uniform1i(location, v1i);
					break;
				case "2i":
					/**@type {[number, number]}*/const v2i = value;
					gl.uniform2i(location, ...v2i);
					break;
				case "3i":
					/**@type {[number, number, number]}*/const v3i = value;
					gl.uniform3i(location, ...v3i);
					break;
				case "4i":
					/**@type {[number, number, number, number]}*/const v4i = value;
					gl.uniform4i(location, ...v4i);
					break;
				case "mat4":
					/**@type {Float32Array | number[]}*/const mat = value;
					gl.uniformMatrix4fv(location, false, mat);
					break;
				case "sampler2D":
					/**@type {WebGLTexture}*/const tex = value;
					const texUnit = schema.textureUnit ?? 0;
					gl.activeTexture(gl.TEXTURE0 + texUnit);
					gl.bindTexture(gl.TEXTURE_2D, tex);
					gl.uniform1i(location, texUnit);
					break;
				default:
					console.warn(`Unknown uniform type: ${schema.type}`);
					break;
			}
		}
	}

	/**
	 * @param {string} fragmentSource 
	 * @param {string} vertexSource 
	 */
	_createShader(fragmentSource, vertexSource) {
		const gl = this._gl;
		const program = gl.createProgram();
		gl.attachShader(program, this._compileShader(gl.FRAGMENT_SHADER, fragmentSource));
		gl.attachShader(program, this._compileShader(gl.VERTEX_SHADER, vertexSource));
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			const errorMsg = gl.getProgramInfoLog(program) ?? "";
			throw new Error(errorMsg);
		}

		return program;
	}

	/**
	 *
	 * @param {GLenum} type
	 * @param {string} source
	 * @returns
	 */
	_compileShader(type, source) {
		const gl = this._gl;
		const shader = gl.createShader(type);
		if (!shader) {
			throw new Error("Failed to create shader");
		}
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			const errorMsg = gl.getShaderInfoLog(shader) ?? "";
			gl.deleteShader(shader);
			throw new Error(`Shader compilation error: ${errorMsg}`);
		}
		return shader;
	}

	_updateCanvasSize() {
		const dpr = this._devicePixelRatio;
		const width = this.canvas.offsetWidth * dpr;
		const height = this.canvas.offsetHeight * dpr;

		if (this.canvas.width !== width || this.canvas.height !== height) {
			this.canvas.width = width;
			this.canvas.height = height;
			return true;
		}

		return false;
	}

	_updateMatrices() {
		const model = this._modelMatrix;
		const view = this._viewMatrix;
		const projection = this._projectionMatrix;  
		const mvp = this._mvpMatrix;

		// Calculate canvas translation & scale
		const scale = 1 / (this._zoom * 50 * this._devicePixelRatio); 
		const ndcX = -(this._x - this._boardWidth / 2) / (this._boardWidth / 2);
		const ndcY = (this._y - this._boardHeight / 2) / (this._boardHeight / 2);

		// Reset matrices
		mat4.identity(model);
		mat4.identity(view);
		mat4.identity(projection);

		// Set up view matrix (panning)
		mat4.translate(view, view, [ndcX, ndcY, 0]);
	
		// Set up projection matrix (zooming)
		const aspect = this.canvas.width / this.canvas.height;
		mat4.ortho(projection,
			-aspect * scale, aspect * scale, // Left right
			-scale, scale, // Bottom top
			-1, 1 // Clipping plane
		);

		// Combine matrices
		mat4.multiply(mvp, projection, view);
		mat4.multiply(mvp, mvp, model);
	}

	/**
	 * @param {Uint8Array|null} boardArr Board (canvas), changes, or socket pixels array
	 */
	_createBoardTexture(boardArr = null) {
		const gl = this._gl;
		const boardTex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, boardTex);
		
		const data = boardArr || new Uint8Array(this._boardWidth * this._boardHeight);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, this._boardWidth, this._boardHeight, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, data);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		return boardTex;
	}

	_setupBlending(blendMode = "normal") {
		const gl = this._gl;
		
		if (blendMode === "normal") {
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		}
		else if (blendMode === "additive") {
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
		}
		else {
			gl.disable(gl.BLEND);
		}
	}

	/**
	 * @param {RenderLayer} layer 
	 */
	_renderLayer(layer) {
		if (!layer.enabled) {
			return;
		}
	
		const gl = this._gl;
		this._setupBlending(layer.blendMode);

		const layerShader = layer.shader;
		gl.useProgram(layerShader.program);
		gl.bindVertexArray(this._vao);
		gl.uniformMatrix4fv(layerShader.mvpUniformLoc, false, this._mvpMatrix);

		// Bind default uniforms
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, layer.texture);
		gl.uniform1i(layerShader.textureUniformLoc, 0);

		gl.uniform2i(layerShader.boardSizeUniformLoc, this._boardWidth, this._boardHeight);

		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, this._paletteTex);
		gl.uniform1i(layerShader.paletteTexUniformLoc, 1);

		// Bind custom uniforms if present
		if (layer.uniforms) {
			this._bindCustomUniforms(gl, layerShader, layer.uniforms);
		}

		gl.drawArrays(gl.TRIANGLES, 0, this._vertexCount);
	}

	/**
	 * @param {Uint8Array} canvas - Base canvas
	 * @param {Uint8Array} changes - Server delta changes from base fetched canvas
	 * @param {Uint8Array} socketPixels - Websocket received pixels layer
	 * @param {Uint32Array} palette
	 * @param {number} width
	 * @param {number} height
	 */
	setSources(canvas, changes, socketPixels, palette, width, height) {
		if (!canvas || !changes || !socketPixels || !palette || width <= 0 || height <= 0) {
			console.warn("Invalid sources provided to setSources");
			return;
		}

		this._board = canvas;
		this._changes = changes;
		this._socketPixels = socketPixels;
		this._palette = palette;
		this._boardWidth = width;
		this._boardHeight = height;

		const gl = this._gl;
	
		// Update board tex
		gl.bindTexture(gl.TEXTURE_2D, this._canvasTex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, this._boardWidth, this._boardHeight, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, this._board);
	
		// Update changes tex
		gl.bindTexture(gl.TEXTURE_2D, this._changesTex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, this._boardWidth, this._boardHeight, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, this._changes);

		// Update socket pixels tex
		gl.bindTexture(gl.TEXTURE_2D, this._socketPixelsTex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, this._boardWidth, this._boardHeight, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, this._socketPixels);

		// Update palette tex
		const paletteArr = new Uint8Array(this._palette.buffer);
		gl.bindTexture(gl.TEXTURE_2D, this._paletteTex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI, palette.length, 1, 0, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, paletteArr);

		// Update pick tex
		this._pickTex = this._createPickTexture();

		this.queueRedraw();
	}

	/**
	 * @param {number} index 
	 * @param {number} colour 
	 */
	redrawSocketPixel(index, colour) {
		const gl = this._gl;
		const x = index % this._boardWidth;
		const y = Math.floor(index / this._boardWidth);
		gl.bindTexture(gl.TEXTURE_2D, this._socketPixelsTex);
		gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, gl.RED_INTEGER, gl.UNSIGNED_BYTE, new Uint8Array([colour]));
		this.queueRedraw();
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} zoom
	 */
	setPosition(x, y, zoom) {
		this._x = x
		this._y = y
		this._zoom = zoom
		this.queueRedraw();
	}

	_updatePickFrameBufferSize() {
		const gl = this._gl;

		// Update framebuffer texture
		gl.bindTexture(gl.TEXTURE_2D, this._pickFBOTex);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA8UI,
			this.canvas.width,
			this.canvas.height,
			0,
			gl.RGBA_INTEGER,
			gl.UNSIGNED_BYTE,
			null
		);

		gl.bindFramebuffer(gl.FRAMEBUFFER, this._pickFBO);
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.TEXTURE_2D,
			this._pickFBOTex,
			0
		);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}

	_createPickTexture() {
		const gl = this._gl;
		// Create pick texture with pixel IDs
		if (this._pickTex) {
			gl.deleteTexture(this._pickTex);
		}
		
		const pickTex = this._pickTex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, pickTex);
		
		const pickTexSize = this._boardWidth * this._boardHeight * 4;
		const pickTexData = new Uint8Array(pickTexSize);
		
		// Generate pixel IDs for each screen pixel
		for (let i = 0; i < this._boardWidth * this._boardHeight; i++) {
			const pixelIndex = i * 4;
			// Encode pixel ID in RGBA channels (32-bit ID split across 4 bytes)
			pickTexData[pixelIndex] = i & 0xFF;           // R: bits 0-7
			pickTexData[pixelIndex + 1] = (i >> 8) & 0xFF;   // G: bits 8-15
			pickTexData[pixelIndex + 2] = (i >> 16) & 0xFF;  // B: bits 16-23
			pickTexData[pixelIndex + 3] = (i >> 24) & 0xFF;  // A: bits 24-31
		}
		
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA8UI,
			this._boardWidth,
			this._boardHeight,
			0,
			gl.RGBA_INTEGER,
			gl.UNSIGNED_BYTE,
			pickTexData
		);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		return pickTex;
	}

	/**
	 * @param {number} screenX 
	 * @param {number} screenY 
	 * @returns 
	 */
	#screenToGameCoords(screenX, screenY) {
		// Ensure matrices are up to date
		this._updateMatrices();
		
		// Convert screen coordinates to NDC 
		const ndcX = (2 * screenX) / this.canvas.width - 1;
		const ndcY = 1 - (2 * screenY) / this.canvas.height;

		// Inverse MVP matrix
		const inverseMVP = mat4.create();
		mat4.invert(inverseMVP, this._mvpMatrix);

		// Transform NDC coordinates using inverse MVP
		const ndcPoint = vec4.fromValues(ndcX, ndcY, 0, 1);
		const gamePoint = vec4.create();
		vec4.transformMat4(gamePoint, ndcPoint, inverseMVP);

		return {
			x: gamePoint[0],
			y: gamePoint[1]
		};
	}

	/**
	 * @param {number} clientX 
	 * @param {number} clientY 
	 * @returns {{ x: number, y: number }|null}
	 */
	hitTest(clientX, clientY) {
		const gl = this._gl;
		const rect = this.canvas.getBoundingClientRect();
		const mouseX = Math.floor((clientX - rect.left) * (gl.drawingBufferWidth / rect.width));
		const mouseY = Math.floor((clientY - rect.top) * (gl.drawingBufferHeight / rect.height));

		const { x: modelX, y: modelY } = this.#screenToGameCoords(mouseX, mouseY);
		return {
			x: (modelX + 1) / 2 * this._boardWidth,
			y: (2 - (modelY + 1)) / 2 * this._boardHeight
		};
	}

	_draw() {
		const gl = this._gl;

		// Check if sources are properly initialized
		if (!this._board || !this._palette || this._boardWidth === 0 || this._boardHeight === 0) {
			return;
		}

		gl.viewport(0, 0, this.canvas.width, this.canvas.height);
		gl.clearColor(0.0, 0.0, 0.0, 0.0);
		gl.clear(gl.COLOR_BUFFER_BIT);

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

	queueRedraw() {
		if (this._redrawHandle) {
			cancelAnimationFrame(this._redrawHandle);
		}
		this._redrawHandle = requestAnimationFrame(() => {
			this._redrawHandle = null;
			this._draw();
		});
	}
}