import { openAccountFrame } from "../../services/account-manager.js";

// Canvas setup
const canvas = /**@type {HTMLCanvasElement}*/(document.getElementById("backgroundPixelsCanvas"));
const ctx = /**@type {CanvasRenderingContext2D}*/(canvas.getContext("2d"));
/**@type {number}*/let animationId;
/**@type {Pixel[]}*/let pixels = [];

// Resize canvas to match window
function resizeCanvas() {
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Pixel colours
const colours = [
	"rgba(255, 255, 255, 0.1)",
	"rgba(255, 107, 107, 0.3)",
	"rgba(255, 217, 61, 0.3)",
	"rgba(107, 207, 127, 0.3)",
	"rgba(69, 183, 209, 0.3)",
	"rgba(118, 75, 162, 0.3)"
];

// Pixel class
class Pixel {
	constructor() {
		this.x = Math.random() * canvas.width;
		this.y = canvas.height + 20;
		this.size = 8;
		this.color = colours[Math.floor(Math.random() * colours.length)];
		this.velocityY = Math.random() * 2 + 1;
		this.velocityX = 0;
		this.rotation = 0;
		this.rotationSpeed = (Math.random() - 0.5) * 0.1;
		this.opacity = 0;
		this.life = 0;
		this.maxLife = Math.random() * 4000 + 6000;
	}

	update() {
		this.life += 16;
		this.y -= this.velocityY;
		this.x += this.velocityX;
		this.rotation += this.rotationSpeed;

		// Fade in/out logic
		if (this.life < this.maxLife * 0.1) {
			this.opacity = this.life / (this.maxLife * 0.1);
		}
		else if (this.life > this.maxLife * 0.9) {
			this.opacity = 1 - (this.life - this.maxLife * 0.9) / (this.maxLife * 0.1);
		}
		else {
			this.opacity = 1;
		}

		return this.life < this.maxLife && this.y > -20;
	}

	draw() {
		ctx.save();
		ctx.translate(this.x + this.size / 2, this.y + this.size / 2);
		ctx.rotate(this.rotation);
		ctx.globalAlpha = this.opacity;
		ctx.fillStyle = this.color;
		ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
		ctx.restore();
	}
}

// Animation loop
function animate() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// Update and draw pixels
	pixels = pixels.filter(pixel => {
		const alive = pixel.update();
		if (alive) {
			pixel.draw();
		}
		return alive;
	});

	animationId = requestAnimationFrame(animate);
}

// Create pixels continuously
function createPixel() {
	if (pixels.length < 100) {
		pixels.push(new Pixel());
	}
}

/**
 * @param {number} x 
 * @param {number} y 
 */
function spawnPixelsExplosion(x, y) {
	for (let i = 0; i < Math.random() * 100; i++) {
		const pixel = new Pixel();
		pixel.x = x;
		pixel.y = y;
		pixel.opacity = 0.5;
		pixel.velocityX = Math.random() * 10 - 5;
		pixel.velocityY = Math.random() * 10 - 5;
		pixels.push(pixel);
	}
}
document.body.addEventListener("click", (e) =>
	spawnPixelsExplosion(e.clientX, e.clientY));
document.body.addEventListener("touchstart", (e) =>
	e.touches[0] && spawnPixelsExplosion(e.touches[0].clientX, e.touches[0].clientY))

// Create initial pixels & start animation
animate();
setInterval(createPixel, 300);
for (let i = 0; i < 20; i++) {
	setTimeout(createPixel, i * 100);
}


// Card scroll animations
const observerOptions = {
	threshold: 0.1,
	rootMargin: "0px 0px -50px 0px"
};
const observer = new IntersectionObserver((entries) => {
	entries.forEach(entry => {
		if (entry.isIntersecting) {
			entry.target.classList.add("visible");
		}
	});
}, observerOptions);
document.querySelectorAll(".fade-in").forEach(el => {
	observer.observe(el);
});
