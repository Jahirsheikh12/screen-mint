import type { DeviceMockup } from "../types";

/**
 * Describes the inset region where video content should be placed
 * within a device mockup, as fractions of the total mockup area (0-1).
 */
export interface MockupInset {
	top: number;
	bottom: number;
	left: number;
	right: number;
}

export interface MockupDefinition {
	/** Preferred aspect ratio of the full device frame (width / height) */
	aspectRatio: number;
	/** Inset describing where the screen sits inside the frame */
	inset: MockupInset;
	/** Draws the device frame onto a canvas context (video area already drawn) */
	drawFrame: (
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
		screenRect: { x: number; y: number; w: number; h: number },
	) => void;
}

function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + r);
	ctx.lineTo(x + w, y + h - r);
	ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	ctx.lineTo(x + r, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - r);
	ctx.lineTo(x, y + r);
	ctx.quadraticCurveTo(x, y, x + r, y);
	ctx.closePath();
}

function drawLaptopBase(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	screenBottom: number,
	bezelColor: string,
	baseColor: string,
) {
	const baseHeight = height - screenBottom;
	const hingeHeight = baseHeight * 0.3;
	const bottomHeight = baseHeight * 0.7;

	// Hinge (narrow strip)
	const hingeWidth = width * 0.12;
	ctx.fillStyle = bezelColor;
	roundRect(
		ctx,
		(width - hingeWidth) / 2,
		screenBottom,
		hingeWidth,
		hingeHeight,
		hingeHeight * 0.3,
	);
	ctx.fill();

	// Base body (wider trapezoid-like shape with rounded corners)
	const baseInset = width * 0.05;
	ctx.fillStyle = baseColor;
	roundRect(
		ctx,
		baseInset,
		screenBottom + hingeHeight - 1,
		width - baseInset * 2,
		bottomHeight + 1,
		bottomHeight * 0.35,
	);
	ctx.fill();

	// Subtle line at top of base
	ctx.strokeStyle = "rgba(255,255,255,0.06)";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(baseInset + bottomHeight * 0.35, screenBottom + hingeHeight);
	ctx.lineTo(width - baseInset - bottomHeight * 0.35, screenBottom + hingeHeight);
	ctx.stroke();
}

function drawBezelFrame(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	bezelColor: string,
	cornerRadius: number,
) {
	ctx.fillStyle = bezelColor;
	roundRect(ctx, x, y, w, h, cornerRadius);
	ctx.fill();

	// Inner glow
	ctx.strokeStyle = "rgba(255,255,255,0.05)";
	ctx.lineWidth = 1;
	roundRect(ctx, x + 1, y + 1, w - 2, h - 2, cornerRadius - 1);
	ctx.stroke();
}

function drawNotch(
	ctx: CanvasRenderingContext2D,
	centerX: number,
	y: number,
	notchW: number,
	notchH: number,
) {
	const r = notchH * 0.4;
	ctx.fillStyle = "#1a1a1a";
	roundRect(ctx, centerX - notchW / 2, y, notchW, notchH, r);
	ctx.fill();

	// Camera dot
	ctx.fillStyle = "#2a2a2a";
	ctx.beginPath();
	ctx.arc(centerX, y + notchH / 2, notchH * 0.18, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = "#1a2a3a";
	ctx.beginPath();
	ctx.arc(centerX, y + notchH / 2, notchH * 0.08, 0, Math.PI * 2);
	ctx.fill();
}

function drawBrowserChrome(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	barH: number,
) {
	// Traffic lights
	const dotR = barH * 0.14;
	const dotY = y + barH / 2;
	const startX = x + barH * 0.55;
	const gap = barH * 0.42;
	const colors = ["#ff5f57", "#febc2e", "#28c840"];
	for (let i = 0; i < 3; i++) {
		ctx.fillStyle = colors[i];
		ctx.beginPath();
		ctx.arc(startX + i * gap, dotY, dotR, 0, Math.PI * 2);
		ctx.fill();
	}

	// URL bar
	const urlBarX = startX + 3 * gap + barH * 0.4;
	const urlBarW = w - (urlBarX - x) - barH * 0.4;
	const urlBarH = barH * 0.42;
	const urlBarY = y + (barH - urlBarH) / 2;
	ctx.fillStyle = "rgba(255,255,255,0.06)";
	roundRect(ctx, urlBarX, urlBarY, urlBarW, urlBarH, urlBarH / 2);
	ctx.fill();

	// URL text
	ctx.fillStyle = "rgba(255,255,255,0.25)";
	const fontSize = Math.max(8, urlBarH * 0.55);
	ctx.font = `${fontSize}px -apple-system, system-ui, sans-serif`;
	ctx.textBaseline = "middle";
	ctx.fillText("screenmint.app", urlBarX + urlBarH * 0.4, urlBarY + urlBarH / 2);
}

const mockupDefinitions: Record<Exclude<DeviceMockup, "none">, MockupDefinition> = {
	"macbook-pro": {
		aspectRatio: 16 / 10.5,
		inset: { top: 0.04, bottom: 0.12, left: 0.05, right: 0.05 },
		drawFrame(ctx, width, height, screen) {
			const bezelR = Math.min(width, height) * 0.02;
			const bezelColor = "#1c1c1e";

			// Outer shell
			drawBezelFrame(
				ctx,
				screen.x - width * 0.015,
				screen.y - height * 0.025,
				screen.w + width * 0.03,
				screen.h + height * 0.04,
				bezelColor,
				bezelR,
			);

			// Notch
			const notchW = width * 0.08;
			const notchH = height * 0.018;
			drawNotch(ctx, width / 2, screen.y - height * 0.025, notchW, notchH);

			// Laptop base
			drawLaptopBase(
				ctx,
				width,
				height,
				screen.y + screen.h + height * 0.015,
				"#2c2c2e",
				"#222224",
			);
		},
	},
	"macbook-air": {
		aspectRatio: 16 / 10.8,
		inset: { top: 0.035, bottom: 0.13, left: 0.045, right: 0.045 },
		drawFrame(ctx, width, height, screen) {
			const bezelR = Math.min(width, height) * 0.018;
			const bezelColor = "#d1d1d6";

			// Silver outer shell
			drawBezelFrame(
				ctx,
				screen.x - width * 0.012,
				screen.y - height * 0.02,
				screen.w + width * 0.024,
				screen.h + height * 0.032,
				bezelColor,
				bezelR,
			);

			// Camera dot (no notch on Air)
			ctx.fillStyle = "#888";
			ctx.beginPath();
			ctx.arc(width / 2, screen.y - height * 0.008, height * 0.004, 0, Math.PI * 2);
			ctx.fill();

			// Laptop base
			drawLaptopBase(
				ctx,
				width,
				height,
				screen.y + screen.h + height * 0.012,
				"#c7c7cc",
				"#b8b8bf",
			);
		},
	},
	imac: {
		aspectRatio: 16 / 12,
		inset: { top: 0.03, bottom: 0.2, left: 0.04, right: 0.04 },
		drawFrame(ctx, width, height, screen) {
			const bezelR = Math.min(width, height) * 0.02;

			// Silver outer shell
			drawBezelFrame(
				ctx,
				screen.x - width * 0.015,
				screen.y - height * 0.018,
				screen.w + width * 0.03,
				screen.h + height * 0.055,
				"#e5e5ea",
				bezelR,
			);

			// Chin area
			const chinTop = screen.y + screen.h + height * 0.01;
			const chinH = height * 0.037 - height * 0.01;
			ctx.fillStyle = "#e5e5ea";
			ctx.fillRect(screen.x - width * 0.015, chinTop, screen.w + width * 0.03, chinH);

			// Camera
			ctx.fillStyle = "#c7c7cc";
			ctx.beginPath();
			ctx.arc(width / 2, screen.y - height * 0.006, height * 0.004, 0, Math.PI * 2);
			ctx.fill();

			// Stand
			const standTop = screen.y + screen.h + height * 0.037;
			const standW = width * 0.14;
			const standH = height * 0.12;

			// Stand neck
			ctx.fillStyle = "#c7c7cc";
			ctx.beginPath();
			ctx.moveTo(width / 2 - standW * 0.3, standTop);
			ctx.lineTo(width / 2 + standW * 0.3, standTop);
			ctx.lineTo(width / 2 + standW * 0.5, standTop + standH);
			ctx.lineTo(width / 2 - standW * 0.5, standTop + standH);
			ctx.closePath();
			ctx.fill();

			// Stand base
			const baseW = width * 0.22;
			const baseH = height * 0.012;
			ctx.fillStyle = "#d1d1d6";
			roundRect(ctx, (width - baseW) / 2, standTop + standH - baseH / 2, baseW, baseH, baseH / 2);
			ctx.fill();
		},
	},
	iphone: {
		aspectRatio: 9 / 19.5,
		inset: { top: 0.04, bottom: 0.04, left: 0.045, right: 0.045 },
		drawFrame(ctx, width, height, screen) {
			const r = Math.min(width, height) * 0.08;

			// Outer frame
			ctx.fillStyle = "#1c1c1e";
			roundRect(ctx, 0, 0, width, height, r);
			ctx.fill();

			// Inner highlight
			ctx.strokeStyle = "rgba(255,255,255,0.08)";
			ctx.lineWidth = 1.5;
			roundRect(ctx, 1, 1, width - 2, height - 2, r - 1);
			ctx.stroke();

			// Side button (right)
			ctx.fillStyle = "#2c2c2e";
			const btnW = width * 0.01;
			const btnH = height * 0.06;
			roundRect(ctx, width - btnW / 2, height * 0.22, btnW, btnH, btnW / 2);
			ctx.fill();

			// Dynamic island
			const islandW = width * 0.28;
			const islandH = height * 0.018;
			const islandR = islandH / 2;
			ctx.fillStyle = "#000000";
			roundRect(ctx, (width - islandW) / 2, screen.y + height * 0.008, islandW, islandH, islandR);
			ctx.fill();
		},
	},
	ipad: {
		aspectRatio: 4 / 3.2,
		inset: { top: 0.04, bottom: 0.04, left: 0.04, right: 0.04 },
		drawFrame(ctx, width, height, screen) {
			const r = Math.min(width, height) * 0.035;

			// Outer frame
			ctx.fillStyle = "#1c1c1e";
			roundRect(ctx, 0, 0, width, height, r);
			ctx.fill();

			// Inner highlight
			ctx.strokeStyle = "rgba(255,255,255,0.06)";
			ctx.lineWidth = 1.5;
			roundRect(ctx, 1, 1, width - 2, height - 2, r - 1);
			ctx.stroke();

			// Camera (top center)
			ctx.fillStyle = "#2a2a2a";
			ctx.beginPath();
			ctx.arc(width / 2, screen.y / 2, Math.min(width, height) * 0.006, 0, Math.PI * 2);
			ctx.fill();
		},
	},
	"android-phone": {
		aspectRatio: 9 / 20,
		inset: { top: 0.03, bottom: 0.03, left: 0.035, right: 0.035 },
		drawFrame(ctx, width, height, screen) {
			const r = Math.min(width, height) * 0.06;

			// Outer frame
			ctx.fillStyle = "#1a1a1a";
			roundRect(ctx, 0, 0, width, height, r);
			ctx.fill();

			// Subtle edge
			ctx.strokeStyle = "rgba(255,255,255,0.04)";
			ctx.lineWidth = 1;
			roundRect(ctx, 0.5, 0.5, width - 1, height - 1, r);
			ctx.stroke();

			// Punch-hole camera (top center)
			ctx.fillStyle = "#0a0a0a";
			ctx.beginPath();
			ctx.arc(width / 2, screen.y + height * 0.01, width * 0.02, 0, Math.PI * 2);
			ctx.fill();
		},
	},
	"browser-window": {
		aspectRatio: 16 / 10.5,
		inset: { top: 0.06, bottom: 0.01, left: 0.01, right: 0.01 },
		drawFrame(ctx, width, height, screen) {
			const r = Math.min(width, height) * 0.015;
			const barH = screen.y;

			// Window chrome background
			ctx.fillStyle = "#28282a";
			roundRect(ctx, 0, 0, width, barH + r, r);
			ctx.fill();
			// Fill bottom of bar (square corners merging with screen)
			ctx.fillRect(0, barH - r, width, r);

			// Bottom frame
			ctx.fillStyle = "#28282a";
			ctx.fillRect(0, screen.y + screen.h, width, height - screen.y - screen.h);
			roundRect(ctx, 0, height - r * 2, width, r * 2, r);
			ctx.fill();

			// Side frames
			ctx.fillRect(0, barH, screen.x, screen.h);
			ctx.fillRect(screen.x + screen.w, barH, width - screen.x - screen.w, screen.h);

			// Separator line
			ctx.strokeStyle = "rgba(255,255,255,0.06)";
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(0, barH);
			ctx.lineTo(width, barH);
			ctx.stroke();

			// Browser chrome elements
			drawBrowserChrome(ctx, 0, 0, width, barH);
		},
	},
	monitor: {
		aspectRatio: 16 / 11.5,
		inset: { top: 0.02, bottom: 0.18, left: 0.025, right: 0.025 },
		drawFrame(ctx, width, height, screen) {
			const r = Math.min(width, height) * 0.008;

			// Monitor body
			const bodyBottom = screen.y + screen.h + height * 0.015;
			ctx.fillStyle = "#1c1c1e";
			roundRect(
				ctx,
				screen.x - width * 0.01,
				screen.y - height * 0.012,
				screen.w + width * 0.02,
				screen.h + height * 0.027,
				r,
			);
			ctx.fill();

			// LED indicator
			ctx.fillStyle = "#28c840";
			ctx.beginPath();
			ctx.arc(width / 2, bodyBottom - height * 0.006, height * 0.003, 0, Math.PI * 2);
			ctx.fill();

			// Stand neck
			const neckW = width * 0.06;
			const neckH = height * 0.1;
			ctx.fillStyle = "#2c2c2e";
			ctx.fillRect((width - neckW) / 2, bodyBottom, neckW, neckH);

			// Stand base
			const baseW = width * 0.2;
			const baseH = height * 0.015;
			const baseY = bodyBottom + neckH;
			ctx.fillStyle = "#2c2c2e";
			roundRect(ctx, (width - baseW) / 2, baseY, baseW, baseH, baseH * 0.4);
			ctx.fill();

			// Base highlight
			ctx.strokeStyle = "rgba(255,255,255,0.04)";
			ctx.lineWidth = 1;
			roundRect(ctx, (width - baseW) / 2, baseY, baseW, baseH, baseH * 0.4);
			ctx.stroke();
		},
	},
};

export function getMockupDefinition(mockup: DeviceMockup): MockupDefinition | null {
	if (mockup === "none") return null;
	return mockupDefinitions[mockup] ?? null;
}

/**
 * Computes the screen rect (where video goes) within a given canvas area,
 * based on the mockup inset and the video aspect ratio.
 */
export function computeMockupScreenRect(
	mockup: DeviceMockup,
	canvasWidth: number,
	canvasHeight: number,
	videoAspectRatio: number,
): { x: number; y: number; w: number; h: number; deviceW: number; deviceH: number } | null {
	const def = getMockupDefinition(mockup);
	if (!def) return null;

	// The device has an aspect ratio, and the video goes inside it.
	// We need to size the device so it fits in the canvas, and the video fits inside the screen area.
	const screenFracW = 1 - def.inset.left - def.inset.right;
	const screenFracH = 1 - def.inset.top - def.inset.bottom;

	// The screen area inside the device has aspect ratio:
	// (deviceW * screenFracW) / (deviceH * screenFracH)
	// = deviceAR * screenFracW / screenFracH

	// We want the video to fill the screen area.
	// Screen area aspect = deviceAR * screenFracW / screenFracH
	// If that doesn't match videoAspectRatio, we adjust the device to fit.

	// Strategy: size the device so the screen area matches the video aspect ratio
	// and the whole device fits within the canvas.
	const screenAR = videoAspectRatio;

	// Device dimensions are determined by: screen must be screenAR, device insets are fixed.
	// screenW = deviceW * screenFracW, screenH = deviceH * screenFracH
	// screenW / screenH = screenAR
	// => deviceW * screenFracW / (deviceH * screenFracH) = screenAR
	// => deviceW / deviceH = screenAR * screenFracH / screenFracW

	const adjustedDeviceAR = (screenAR * screenFracH) / screenFracW;

	// Fit device into canvas with some padding (85% of canvas)
	const fitScale = 0.85;
	const maxW = canvasWidth * fitScale;
	const maxH = canvasHeight * fitScale;

	let deviceW: number;
	let deviceH: number;
	if (adjustedDeviceAR > maxW / maxH) {
		deviceW = maxW;
		deviceH = maxW / adjustedDeviceAR;
	} else {
		deviceH = maxH;
		deviceW = maxH * adjustedDeviceAR;
	}

	// Center device in canvas
	const deviceX = (canvasWidth - deviceW) / 2;
	const deviceY = (canvasHeight - deviceH) / 2;

	// Screen rect within device
	const screenX = deviceX + deviceW * def.inset.left;
	const screenY = deviceY + deviceH * def.inset.top;
	const screenW = deviceW * screenFracW;
	const screenH = deviceH * screenFracH;

	return {
		x: screenX,
		y: screenY,
		w: screenW,
		h: screenH,
		deviceW,
		deviceH,
	};
}

/**
 * Draws the device mockup frame onto a canvas.
 * Call this AFTER drawing the video content into the screen rect.
 */
export function drawDeviceMockup(
	ctx: CanvasRenderingContext2D,
	mockup: DeviceMockup,
	canvasWidth: number,
	canvasHeight: number,
	screenRect: { x: number; y: number; w: number; h: number; deviceW: number; deviceH: number },
): void {
	const def = getMockupDefinition(mockup);
	if (!def) return;

	const deviceX = (canvasWidth - screenRect.deviceW) / 2;
	const deviceY = (canvasHeight - screenRect.deviceH) / 2;

	ctx.save();
	ctx.translate(deviceX, deviceY);
	def.drawFrame(ctx, screenRect.deviceW, screenRect.deviceH, {
		x: screenRect.x - deviceX,
		y: screenRect.y - deviceY,
		w: screenRect.w,
		h: screenRect.h,
	});
	ctx.restore();
}

/**
 * Renders a small preview of the device mockup for the settings panel.
 */
export function renderMockupPreview(canvas: HTMLCanvasElement, mockup: DeviceMockup): void {
	const ctx = canvas.getContext("2d");
	if (!ctx || mockup === "none") return;

	const w = canvas.width;
	const h = canvas.height;
	ctx.clearRect(0, 0, w, h);

	const screenRect = computeMockupScreenRect(mockup, w, h, 16 / 10);
	if (!screenRect) return;

	// Draw fake screen content
	ctx.fillStyle = "#3b82f6";
	ctx.fillRect(screenRect.x, screenRect.y, screenRect.w, screenRect.h);

	// Draw frame
	drawDeviceMockup(ctx, mockup, w, h, screenRect);
}
