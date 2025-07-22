import { mat4 } from "gl-matrix";

export class BoardRenderer {
	/**@type {ResizeObserver}*/#resizeObserver
	/**@type {HTMLCanvasElement}*/canvas
	/**@type {WebGL2RenderingContext}*/#gl;

	// We separate into different render layers for mod & debugging purposes
	/**@type {Uint8Array|null}*/#board = null;
	/**@type {Uint8Array|null}*/#changes = null;
	/**@type {Uint8Array|null}*/#socketPixels = null;	
	/**@type {Uint32Array|null}*/#palette = null;
	/**@type {number}*/#width = 0;
	/**@type {number}*/#height = 0;
	/**@type {number|null}*/#redrawHandle = null;
	/**@type {number}*/#x = 0;
	/**@type {number}*/#y = 0;
	/**@type {number}*/#zoom = 1;
	/**@type {number}*/#devicePixelRatio = 1;

	/**@type {WebGLProgram}*/#program
	/**@type {WebGLVertexArrayObject}*/#vao
	/**@type {WebGLTexture}*/#canvasTex
	/**@type {WebGLTexture}*/#changesTex
	/**@type {WebGLTexture}*/#socketPixelsTex
	/**@type {WebGLTexture}*/#paletteTex

	/**@type {mat4}*/#modelMatrix
	/**@type {mat4}*/#viewMatrix
	/**@type {mat4}*/#projectionMatrix
	/**@type {mat4}*/#mvpMatrix

	/**@type {WebGLUniformLocation}*/#mvpUniformLoc
	/**@type {WebGLUniformLocation}*/#boardTexUniformLoc
	/**@type {WebGLUniformLocation}*/#paletteTexUniformLoc

	// Render layers configuration
	/**
	 * @typedef {{texture: WebGLTexture, enabled: boolean, blendMode?: string}} RenderLayer
	 */
	/**@type {Array<RenderLayer>}*/#renderLayers = [];

	/**
	 * 
	 * @param {HTMLCanvasElement} canvas 
	 */
	constructor(canvas) {
		this.canvas = canvas;
		this.#resizeObserver = new ResizeObserver(() => {
			this.#updateCanvasSize();
			this.queueRedraw();
		});
		this.#devicePixelRatio = window.devicePixelRatio || 1;
		window.addEventListener("resize", () => {
			this.#devicePixelRatio = window.devicePixelRatio || 1;
			this.#updateCanvasSize();
		});
		this.#resizeObserver.observe(canvas);
		const gl = this.#gl = /**@type {WebGL2RenderingContext}*/(canvas.getContext("webgl2"));
		if (!gl) {
			throw new Error("WebGL2 not supported");
		}

		const vertices = new Float32Array([
			-1.0, -1.0, 0.0,
			 1.0, -1.0, 0.0,
			-1.0,  1.0, 0.0,
			-1.0,  1.0, 0.0,
			 1.0, -1.0, 0.0,
			 1.0,  1.0, 0.0
		]);
		const uv = new Float32Array([
			0, 0,
			1, 0,
			0, 1,
			0, 1,
			1, 0,
			1, 1
		]);

		// Vertex Shader
		const vsSource = `#version 300 es
			in vec3 a_position;
			in vec2 a_uv;
			out vec2 v_uv;

			uniform mat4 u_modelViewProjection;

			void main() {
				v_uv = vec2(a_uv.x, 1.0 - a_uv.y);
				gl_Position = u_modelViewProjection * vec4(a_position, 1.0); 
			}`;

		// Fragment Shader
		const fsSource = `#version 300 es
			precision highp float;
			precision highp usampler2D;

			in vec2 v_uv;
			out vec4 fragColour;

			uniform usampler2D u_boardTex;
			uniform usampler2D u_paletteTex;

			void main() {
				ivec2 texSize = textureSize(u_boardTex, 0);
				ivec2 texelCoord = ivec2(v_uv * vec2(texSize));

				// Get palette index from board texture
				uint index = texelFetch(u_boardTex, texelCoord, 0).r;
				
				if (index == 255u) {
					// Changes / socketPixels alpha index
					discard;
				}

				// Get colour from palette texture
				uvec4 raw = texelFetch(u_paletteTex, ivec2(int(index), 0), 0);

				// Convert to normalized float
				fragColour = vec4(raw) / 255.0;
			}`;

		const program = this.#program = gl.createProgram();
		gl.attachShader(program, this.#compileShader(gl.VERTEX_SHADER, vsSource));
		gl.attachShader(program, this.#compileShader(gl.FRAGMENT_SHADER, fsSource));
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			const errorMsg = gl.getProgramInfoLog(program) ?? "";
			throw new Error(errorMsg);
		}

		// Vertex array setup
		const vao = this.#vao = gl.createVertexArray();
		gl.bindVertexArray(vao);

		// Vertex position buffer setup
		const vbo = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
		gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

		const posLoc = gl.getAttribLocation(program, "a_position");
		gl.enableVertexAttribArray(posLoc);
		gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, 0, 0);

		// UV buffer setup
		const uvBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);

		const uvLoc = gl.getAttribLocation(program, "a_uv");
		gl.enableVertexAttribArray(uvLoc);
		gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

		// Initialize dimensions first (required for texture creation)
		this.#width = 1;
		this.#height = 1;

		// Create image textures with valid dimensions
		this.#canvasTex = this.#initialiseBoardTexture();
		this.#changesTex = this.#initialiseBoardTexture();
		this.#socketPixelsTex = this.#initialiseBoardTexture();

		// Create palette texture with minimal valid size
		const paletteTex = this.#paletteTex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, paletteTex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI, 1, 1, 0, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, new Uint8Array(4));
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		
		// Initialise uniform locations
		this.#mvpUniformLoc = /**@type {WebGLUniformLocation}*/ (gl.getUniformLocation(program, "u_modelViewProjection"));
		this.#boardTexUniformLoc = /**@type {WebGLUniformLocation}*/ (gl.getUniformLocation(program, "u_boardTex"));
		this.#paletteTexUniformLoc = /**@type {WebGLUniformLocation}*/ (gl.getUniformLocation(program, "u_paletteTex"));

		// Initialize render layers
		this.#initializeRenderLayers();

		// Initialise matrices
		const model = this.#modelMatrix = mat4.create();
		mat4.identity(model);
		const view = this.#viewMatrix = mat4.create();
		mat4.identity(view);
		const projection = this.#projectionMatrix = mat4.create();
		mat4.identity(projection);
		const mvp = this.#mvpMatrix = mat4.create();
		mat4.identity(mvp);

		// Initial canvas size update
		this.#updateCanvasSize();
	}

	#initializeRenderLayers() {
		this.#renderLayers = [
			{ texture: this.#canvasTex, enabled: true },
			{ texture: this.#changesTex, enabled: true },
			{ texture: this.#socketPixelsTex, enabled: true }
		];
	}

	/**
	 * Enable or disable a specific render layer
	 * @param {number} layerIndex - 0: board, 1: changes, 2: socketPixels
	 * @param {boolean} enabled
	 */
	setLayerEnabled(layerIndex, enabled) {
		if (this.#renderLayers[layerIndex]) {
			this.#renderLayers[layerIndex].enabled = enabled;
			this.queueRedraw();
		}
	}

	/**
	 * Add a new render layer
	 * @param {WebGLTexture} texture
	 * @param {boolean} enabled
	 */
	addRenderLayer(texture, enabled = true) {
		this.#renderLayers.push({ texture, enabled });
		this.queueRedraw();
	}

	/**
	 *
	 * @param {GLenum} type
	 * @param {string} source
	 * @returns
	 */
	#compileShader(type, source) {
		const gl = this.#gl;
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

	#updateCanvasSize() {
		const dpr = this.#devicePixelRatio;
		const width = this.canvas.offsetWidth * dpr;
		const height = this.canvas.offsetHeight * dpr;

		if (this.canvas.width !== width || this.canvas.height !== height) {
			this.canvas.width = width;
			this.canvas.height = height;
			return true;
		}

		return false;	
	}

	#updateMatrices() {
		const model = this.#modelMatrix, 
			view = this.#viewMatrix,
			projection = this.#projectionMatrix,  
			mvp = this.#mvpMatrix;

		// Calculate canvas translation & scale
		const scale = 1 / (this.#zoom * 50 * this.#devicePixelRatio); 
		const ndcX = -(this.#x - this.#width / 2) / (this.#width / 2);
		const ndcY = (this.#y - this.#height / 2) / (this.#height / 2);

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
	#initialiseBoardTexture(boardArr = null) {
		const gl = this.#gl;
		const boardTex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, boardTex);
		
		const data = boardArr || new Uint8Array(this.#width * this.#height);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, this.#width, this.#height, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, data);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		return boardTex;
	}

	#setupBlending(blendMode = "normal") {
		const gl = this.#gl;
		
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
	#renderLayer(layer) {
		if (!layer.enabled) {
			return;
		}
		
		const gl = this.#gl;
		
		this.#setupBlending(layer.blendMode);
		
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, layer.texture);
		gl.uniform1i(this.#boardTexUniformLoc, 0);

		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, this.#paletteTex);
		gl.uniform1i(this.#paletteTexUniformLoc, 1);

		gl.drawArrays(gl.TRIANGLES, 0, 6);
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

		this.#board = canvas;
		this.#changes = changes;
		this.#socketPixels = socketPixels;
		this.#palette = palette;
		this.#width = width;
		this.#height = height;

		const gl = this.#gl;
	
		// Update board tex
		gl.bindTexture(gl.TEXTURE_2D, this.#canvasTex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, this.#width, this.#height, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, this.#board);
	
		// Update changes tex
		gl.bindTexture(gl.TEXTURE_2D, this.#changesTex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, this.#width, this.#height, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, this.#changes);

		// Update socket pixels tex
		gl.bindTexture(gl.TEXTURE_2D, this.#socketPixelsTex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, this.#width, this.#height, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, this.#socketPixels);

		// Update palette tex
		const paletteArr = new Uint8Array(this.#palette.buffer);
		gl.bindTexture(gl.TEXTURE_2D, this.#paletteTex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI, palette.length, 1, 0, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, paletteArr);

		this.queueRedraw();
	}

	/**
	 * @param {number} index 
	 * @param {number} colour 
	 */
	redrawSocketPixel(index, colour) {
		const gl = this.#gl;
		const x = index % this.#width;
		const y = Math.floor(index / this.#width);
		gl.bindTexture(gl.TEXTURE_2D, this.#socketPixelsTex);
		gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, gl.RED_INTEGER, gl.UNSIGNED_BYTE, new Uint8Array([colour]));
		this.queueRedraw();
	}

	/**
	 * @param {number} x
	 * @param {number} y
	 * @param {number} zoom
	 */
	setPosition(x, y, zoom) {
		this.#x = x
		this.#y = y
		this.#zoom = zoom
		this.queueRedraw();
	}

	queueRedraw() {
		if (this.#redrawHandle) {
			cancelAnimationFrame(this.#redrawHandle);
		}
		this.#redrawHandle = requestAnimationFrame(() => {
			this.#redrawHandle = null;
			
			const gl = this.#gl;

			// Check if sources are properly initialized
			if (!this.#board || !this.#palette || this.#width === 0 || this.#height === 0) {
				return;
			}

			gl.viewport(0, 0, this.canvas.width, this.canvas.height);
			gl.clearColor(0.0, 0.0, 0.0, 0.0);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

			// Update matrices
			this.#updateMatrices();

			gl.useProgram(this.#program);
			gl.bindVertexArray(this.#vao);
			gl.uniformMatrix4fv(this.#mvpUniformLoc, false, this.#mvpMatrix);

			// Render all enabled layers in order
			for (const layer of this.#renderLayers) {
				this.#renderLayer(layer);
			}

			const error = gl.getError();
			if (error !== gl.NO_ERROR) {
				console.error("WebGL Error:", error);
			}	
		});
	}
}