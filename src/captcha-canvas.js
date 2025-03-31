//@ts-nocheck
let captchaCanvasHandle = null

export function updateImgCaptchaCanvas(imageData) {
	const ctx = setTargetCanvas(captchaCanvas)
	const patternImg = Texture().fromSrc("./images/pattern.png", _, REPEAT | MIPMAPS | UPSCALE_PIXELATED)
	const img = Texture()
	img.from(imageData, _, MIPMAPS)

	const cornerShader = Shader(`
		void main()
		{
			float u_radius = 0.02;
			vec3 u_colour = u.rgb;
			float u_edgeFeather = 0.002;
			vec2 rectSize = vec2(0.9, 0.9);

			vec2 fragCoordNorm = abs(uv.xy - 0.5);
			float distance = length(max(fragCoordNorm - rectSize * 0.5 + u_radius, 0.0)) - u_radius;
			float alpha = 1.0 - smoothstep(u_radius - u_edgeFeather, u_radius + u_edgeFeather, distance) *
				smoothstep(0.0 - u_edgeFeather, 0.0 + u_edgeFeather, length(fragCoordNorm - 0.5 * rectSize));

			color = vec4(u_colour * alpha, alpha);
		}
	`)
	const cornerTextureShader = Shader(`
		void main()
		{
			float u_radius = 0.02;
			vec3 u_colour = texture(tex0, uv.xy).rgb;
			float u_edgeFeather = 0.002;
			vec2 rectSize = vec2(0.9, 0.9);

			vec2 fragCoordNorm = abs(uv.xy - 0.5);
			float distance = length(max(fragCoordNorm - rectSize * 0.5 + u_radius, 0.0)) - u_radius;
			float alpha = 1.0 - smoothstep(u_radius - u_edgeFeather, u_radius + u_edgeFeather, distance) *
				smoothstep(0.0 - u_edgeFeather, 0.0 + u_edgeFeather, length(fragCoordNorm - 0.5 * rectSize));

			color = vec4(u_colour * alpha, alpha);
		}
	`)
	function cubicBezier(t, initial, p1, p2, final) {
		return ((1 - t) * (1 - t) * (1 - t) * initial
				+ 3 * (1 - t) * (1 - t) * t * p1
				+ 3 * (1 - t) * t * t * p2
				+ t * t * t * final)
	}
	function ease(start, end, weight) {
		return start + (end - start) * cubicBezier(weight, 0, 1.1, 0.2, 1);
	}
	function drawCaptcha() {
		if (captchaCanvasHandle === null) {
			return
		}
		captchaCanvas.width = captchaPopup.offsetWidth
		captchaCanvas.height = captchaPopup.offsetHeight
		const now = performance.now()
		const hRatio = captchaCanvas.width / captchaCanvas.height

		const patternTexSize = 64
		const scaleX = patternTexSize / captchaCanvas.width
		const scaleY = patternTexSize / captchaCanvas.height
		const patternRepeatsX = 12
		const patternRepeatsY = 16

		const weight = (now / 2200) % 1
		const shift = ease(0, patternTexSize, weight)
		const patternMesh = Mesh()
		patternMesh.translate(shift / captchaCanvas.width - scaleX, -shift / captchaCanvas.height)
		patternMesh.addRect(0, 0, scaleX * patternRepeatsX, scaleY * patternRepeatsY,
			uv(0, 0, patternRepeatsX, patternRepeatsY), _, 1, 1, 1, 0.96)
		ctx.draw(patternMesh, patternImg)

		const imgSize = 210
		const imgWidth = imgSize / captchaCanvas.width
		const imgHeight = imgWidth * hRatio
		const imageX = 0.5 - imgWidth * 0.5
		const imgBotttom = captchaImagePositon.offsetTop + captchaImagePositon.offsetHeight
		const imageY = (captchaCanvas.height - imgBotttom) / captchaCanvas.height

		let prevShader = ctx.useShader(cornerShader)
		ctx.setU(0.6, 0.6, 0.6, 1.0)
		const borderSize = 1
		const borderWidth = borderSize / captchaCanvas.width
		const bx = imageX - borderWidth
		const by = imageY - (borderWidth * hRatio)
		const bw = imgWidth + (borderWidth * 2)
		const bh = imgHeight + (borderWidth * hRatio * 2)
		const borderMesh = Mesh.singleRect(bx, by, bw, bh)
		ctx.draw(borderMesh)
		ctx.useShader(prevShader)

		prevShader = ctx.useShader(cornerTextureShader)
		const imgMesh = Mesh.singleRect(imageX, imageY, imgWidth, imgHeight)
		ctx.draw(imgMesh, img)
		ctx.useShader(prevShader)

		captchaCanvasHandle = requestAnimationFrame(drawCaptcha)
	}
	captchaCanvasHandle = requestAnimationFrame(drawCaptcha)
}

export function updateImgCaptchaCanvasFallback(imageData) {
	const ctx = captchaCanvas.getContext("2d")
	captchaCanvas.width = captchaPopup.offsetWidth
	captchaCanvas.height = captchaPopup.offsetHeight
	const captchaImg = new Image()
	const url = URL.createObjectURL(imageData)
	captchaImg.src = url
	const captchaImgRadius = 8

	captchaImg.onload = function() {
		function drawCaptcha() {
			if (captchaCanvasHandle === null) {
				return
			}
			captchaCanvas.width = captchaPopup.offsetWidth
			captchaCanvas.height = captchaPopup.offsetHeight
			const canvasImageSize = 196
			const x = captchaImagePositon.offsetLeft
			const y = captchaImagePositon.offsetTop
			ctx.clearRect(0, 0, captchaCanvas.width, captchaCanvas.height)
			ctx.save()
			ctx.beginPath()
			ctx.moveTo(x + captchaImgRadius, y)
			ctx.arcTo(x + canvasImageSize, y, x + canvasImageSize, y + canvasImageSize, captchaImgRadius)
			ctx.arcTo(x + canvasImageSize, y + canvasImageSize, x, y + canvasImageSize, captchaImgRadius)
			ctx.arcTo(x, y + canvasImageSize, x, y, captchaImgRadius)
			ctx.arcTo(x, y, x + canvasImageSize, y, captchaImgRadius)
			ctx.closePath()
			ctx.clip()
			ctx.drawImage(captchaImg, x, y, canvasImageSize, canvasImageSize)
			ctx.restore()
			const captchaImageBottom = captchaImagePositon.offsetTop + canvasImageSize
			const captchaImageCentreX = captchaCanvas.width / 2
			ctx.fillStyle = "#ff0000a3"
			ctx.font = "16px reddit"
			ctx.textAlign = "center"
			ctx.fillText("Warning: Your browser doesn't support WebGL 2,",
				captchaImageCentreX, captchaImageBottom + 16)
			ctx.fillText("this can cause some site features to break!",
				captchaImageCentreX, captchaImageBottom + 52)
			captchaCanvasHandle = requestAnimationFrame(drawCaptcha)
		}
		captchaCanvasHandle = requestAnimationFrame(drawCaptcha)
	}
}

export function clearCaptchaCanvas() {
	window.cancelAnimationFrame(captchaCanvasHandle)
	captchaCanvasHandle = null
}
