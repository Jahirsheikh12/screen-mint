import {
	createCaptionRenderBlock,
	getCaptionPlacement,
	hexToRgba,
} from "@/components/video-editor/captionLayout";
import type {
	AnnotationRegion,
	ArrowDirection,
	BlurData,
	CaptionRegion,
	CaptionSettings,
} from "@/components/video-editor/types";

// SVG path data for each arrow direction
const ARROW_PATHS: Record<ArrowDirection, string[]> = {
	up: ["M 50 20 L 50 80", "M 50 20 L 35 35", "M 50 20 L 65 35"],
	down: ["M 50 20 L 50 80", "M 50 80 L 35 65", "M 50 80 L 65 65"],
	left: ["M 80 50 L 20 50", "M 20 50 L 35 35", "M 20 50 L 35 65"],
	right: ["M 20 50 L 80 50", "M 80 50 L 65 35", "M 80 50 L 65 65"],
	"up-right": ["M 25 75 L 75 25", "M 75 25 L 60 30", "M 75 25 L 70 40"],
	"up-left": ["M 75 75 L 25 25", "M 25 25 L 40 30", "M 25 25 L 30 40"],
	"down-right": ["M 25 25 L 75 75", "M 75 75 L 70 60", "M 75 75 L 60 70"],
	"down-left": ["M 75 25 L 25 75", "M 25 75 L 30 60", "M 25 75 L 40 70"],
};

function parseSvgPath(
	pathString: string,
	scaleX: number,
	scaleY: number,
): Array<{ cmd: string; args: number[] }> {
	const commands: Array<{ cmd: string; args: number[] }> = [];
	const parts = pathString.trim().split(/\s+/);

	let i = 0;
	while (i < parts.length) {
		const cmd = parts[i];
		if (cmd === "M" || cmd === "L") {
			const x = parseFloat(parts[i + 1]) * scaleX;
			const y = parseFloat(parts[i + 2]) * scaleY;
			commands.push({ cmd, args: [x, y] });
			i += 3;
		} else {
			i++;
		}
	}

	return commands;
}

function renderArrow(
	ctx: CanvasRenderingContext2D,
	direction: ArrowDirection,
	color: string,
	strokeWidth: number,
	x: number,
	y: number,
	width: number,
	height: number,
	_scaleFactor: number,
) {
	const paths = ARROW_PATHS[direction];
	if (!paths) return;

	ctx.save();
	ctx.translate(x, y);

	const padding = 8 * _scaleFactor;
	const availableWidth = Math.max(0, width - padding * 2);
	const availableHeight = Math.max(0, height - padding * 2);

	const scale = Math.min(availableWidth / 100, availableHeight / 100);

	const offsetX = padding + (availableWidth - 100 * scale) / 2;
	const offsetY = padding + (availableHeight - 100 * scale) / 2;

	// Apply centering offset
	ctx.translate(offsetX, offsetY);

	// Apply shadow filter
	ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
	ctx.shadowBlur = 8 * scale;
	ctx.shadowOffsetX = 0;
	ctx.shadowOffsetY = 4 * scale;

	ctx.strokeStyle = color;
	ctx.lineWidth = strokeWidth * scale;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";

	// Draw all paths as a single shape to avoid overlapping shadows/strokes
	ctx.beginPath();

	for (const pathString of paths) {
		const commands = parseSvgPath(pathString, scale, scale);

		for (const { cmd, args } of commands) {
			if (cmd === "M") {
				ctx.moveTo(args[0], args[1]);
			} else if (cmd === "L") {
				ctx.lineTo(args[0], args[1]);
			}
		}
	}

	ctx.stroke();

	ctx.restore();
}

function renderText(
	ctx: CanvasRenderingContext2D,
	annotation: AnnotationRegion,
	x: number,
	y: number,
	width: number,
	height: number,
	scaleFactor: number,
) {
	const style = annotation.style;

	ctx.save();

	// Clip text to annotation box bounds (matches editor's overflow: hidden)
	ctx.beginPath();
	ctx.rect(x, y, width, height);
	ctx.clip();

	const fontWeight = style.fontWeight === "bold" ? "bold" : "normal";
	const fontStyle = style.fontStyle === "italic" ? "italic" : "normal";
	const scaledFontSize = style.fontSize * scaleFactor;
	ctx.font = `${fontStyle} ${fontWeight} ${scaledFontSize}px ${style.fontFamily}`;
	ctx.textBaseline = "middle";

	const containerPadding = 8 * scaleFactor;

	let textX = x;
	let textY = y + height / 2;

	if (style.textAlign === "center") {
		textX = x + width / 2;
		ctx.textAlign = "center";
	} else if (style.textAlign === "right") {
		textX = x + width - containerPadding;
		ctx.textAlign = "right";
	} else {
		textX = x + containerPadding;
		ctx.textAlign = "left";
	}

	const availableWidth = width - containerPadding * 2;
	const rawLines = annotation.content.split("\n");
	const lines: string[] = [];
	for (const rawLine of rawLines) {
		if (!rawLine) {
			lines.push("");
			continue;
		}
		const words = rawLine.split(/(\s+)/);
		let current = "";
		for (const word of words) {
			const test = current + word;
			if (current && ctx.measureText(test).width > availableWidth) {
				lines.push(current);
				current = word.trimStart();
			} else {
				current = test;
			}
		}
		if (current) lines.push(current);
	}
	const lineHeight = scaledFontSize * 1.4;

	const startY = textY - ((lines.length - 1) * lineHeight) / 2;

	lines.forEach((line, index) => {
		const currentY = startY + index * lineHeight;

		if (style.backgroundColor && style.backgroundColor !== "transparent") {
			const metrics = ctx.measureText(line);
			const verticalPadding = scaledFontSize * 0.1;
			const horizontalPadding = scaledFontSize * 0.2;
			const borderRadius = 4 * scaleFactor;

			let bgX = textX - horizontalPadding;
			const bgWidth = metrics.width + horizontalPadding * 2;

			const contentHeight = scaledFontSize * 1.4;
			const bgHeight = contentHeight + verticalPadding * 2;
			const bgY = currentY - bgHeight / 2;

			if (style.textAlign === "center") {
				bgX = textX - bgWidth / 2;
			} else if (style.textAlign === "right") {
				bgX = textX - bgWidth;
			}

			ctx.fillStyle = style.backgroundColor;
			ctx.beginPath();
			ctx.roundRect(bgX, bgY, bgWidth, bgHeight, borderRadius);
			ctx.fill();
		}

		ctx.fillStyle = style.color;
		ctx.fillText(line, textX, currentY);

		if (style.textDecoration === "underline") {
			const metrics = ctx.measureText(line);
			let underlineX = textX;
			const underlineY = currentY + scaledFontSize * 0.15;

			if (style.textAlign === "center") {
				underlineX = textX - metrics.width / 2;
			} else if (style.textAlign === "right") {
				underlineX = textX - metrics.width;
			}

			ctx.strokeStyle = style.color;
			ctx.lineWidth = Math.max(1, scaledFontSize / 16);
			ctx.beginPath();
			ctx.moveTo(underlineX, underlineY);
			ctx.lineTo(underlineX + metrics.width, underlineY);
			ctx.stroke();
		}
	});

	ctx.restore();
}

async function renderImage(
	ctx: CanvasRenderingContext2D,
	annotation: AnnotationRegion,
	x: number,
	y: number,
	width: number,
	height: number,
): Promise<void> {
	if (!annotation.content || !annotation.content.startsWith("data:image")) {
		return;
	}

	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			// Preserve aspect ratio - contain the image within the bounds
			const imgAspect = img.width / img.height;
			const boxAspect = width / height;

			let drawWidth = width;
			let drawHeight = height;
			let drawX = x;
			let drawY = y;

			if (imgAspect > boxAspect) {
				drawHeight = width / imgAspect;
				drawY = y + (height - drawHeight) / 2;
			} else {
				drawWidth = height * imgAspect;
				drawX = x + (width - drawWidth) / 2;
			}

			ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
			resolve();
		};
		img.onerror = () => {
			console.error("[AnnotationRenderer] Failed to load image annotation");
			resolve();
		};
		img.src = annotation.content;
	});
}

function renderBlur(
	ctx: CanvasRenderingContext2D,
	blurData: BlurData,
	x: number,
	y: number,
	width: number,
	height: number,
) {
	const { blurAmount, shape } = blurData;

	ctx.save();

	// Clip to the blur region shape
	ctx.beginPath();
	if (shape === "circle") {
		const cx = x + width / 2;
		const cy = y + height / 2;
		const rx = width / 2;
		const ry = height / 2;
		ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
	} else {
		ctx.roundRect(x, y, width, height, 8);
	}
	ctx.clip();

	// Use CanvasRenderingContext2D filter to blur the region
	// We draw the current canvas content back into itself within the clip
	ctx.filter = `blur(${blurAmount}px)`;
	ctx.drawImage(ctx.canvas, 0, 0);
	ctx.filter = "none";

	ctx.restore();
}

export async function renderAnnotations(
	ctx: CanvasRenderingContext2D,
	annotations: AnnotationRegion[],
	canvasWidth: number,
	canvasHeight: number,
	currentTimeMs: number,
	scaleFactor: number = 1.0,
): Promise<void> {
	// Filter active annotations at current time
	const activeAnnotations = annotations.filter(
		(ann) => currentTimeMs >= ann.startMs && currentTimeMs <= ann.endMs,
	);

	// Sort by z-index (lower first, so higher z-index draws on top)
	const sortedAnnotations = [...activeAnnotations].sort((a, b) => a.zIndex - b.zIndex);

	for (const annotation of sortedAnnotations) {
		const x = (annotation.position.x / 100) * canvasWidth;
		const y = (annotation.position.y / 100) * canvasHeight;
		const width = (annotation.size.width / 100) * canvasWidth;
		const height = (annotation.size.height / 100) * canvasHeight;

		switch (annotation.type) {
			case "text":
				renderText(ctx, annotation, x, y, width, height, scaleFactor);
				break;

			case "image":
				await renderImage(ctx, annotation, x, y, width, height);
				break;

			case "figure":
				if (annotation.figureData) {
					renderArrow(
						ctx,
						annotation.figureData.arrowDirection,
						annotation.figureData.color,
						annotation.figureData.strokeWidth,
						x,
						y,
						width,
						height,
						scaleFactor,
					);
				}
				break;

			case "blur":
				if (annotation.blurData) {
					renderBlur(ctx, annotation.blurData, x, y, width, height);
				}
				break;
		}
	}
}

export function renderCaptions(
	ctx: CanvasRenderingContext2D,
	captions: CaptionRegion[],
	settings: CaptionSettings,
	canvasWidth: number,
	canvasHeight: number,
	currentTimeMs: number,
): void {
	const renderBlock = createCaptionRenderBlock(captions, settings, currentTimeMs);
	if (!renderBlock) return;
	if (renderBlock.blockOpacity <= 0.001) return;

	const { style } = settings;
	const scaleFactor = canvasWidth / 1920;
	const fontSize = Math.max(12, Math.round(style.fontSize * scaleFactor));
	const padX = Math.round(16 * scaleFactor);
	const padY = Math.round(8 * scaleFactor);
	const borderRadius = Math.round(style.borderRadius * scaleFactor);
	const wordGap = Math.max(4, Math.round(fontSize * 0.18));
	const lineGap = Math.max(2, Math.round(fontSize * 0.12));
	const letterSpacing = style.letterSpacing * scaleFactor;
	const inactiveColor = hexToRgba(style.color, 0.58);
	const visibleLines = renderBlock.lines
		.map((line) => ({
			words: line.words.filter((word) => word.isVisible),
		}))
		.filter((line) => line.words.length > 0);
	if (visibleLines.length === 0) return;

	ctx.save();
	ctx.globalAlpha = clamp(renderBlock.blockOpacity, 0, 1);
	const fontStyleToken = style.fontStyle === "italic" ? "italic " : "";
	ctx.font = `${fontStyleToken}${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
	ctx.textAlign = "left";
	ctx.textBaseline = "middle";
	const lineHeight = fontSize * style.lineHeight;

	const computeWordWidth = (text: string) => ctx.measureText(text).width;
	const lineWidths = visibleLines.map((line) =>
		line.words.reduce((total, word, index) => {
			const text = style.textTransform === "uppercase" ? word.text.toUpperCase() : word.text;
			const wordWidth = computeWordWidth(text) + Math.max(0, (text.length - 1) * letterSpacing);
			const next = total + wordWidth;
			return index === line.words.length - 1 ? next : next + wordGap;
		}, 0),
	);
	const blockHeight =
		visibleLines.length * lineHeight + Math.max(0, visibleLines.length - 1) * lineGap + padY * 2;
	const blockWidthMax = canvasWidth * 0.85;
	const blockWidth = Math.min(blockWidthMax, Math.max(...lineWidths, 0) + padX * 2);

	const placement = getCaptionPlacement(settings, canvasWidth, canvasHeight, blockHeight);
	const cx = placement.cx;
	const cy = placement.cy;

	// Apply pop scale around block center
	if (renderBlock.blockScale !== 1) {
		ctx.translate(cx, cy);
		ctx.scale(renderBlock.blockScale, renderBlock.blockScale);
		ctx.translate(-cx, -cy);
	}

	const bx = cx - blockWidth / 2;
	const by = cy - blockHeight / 2;

	// Background
	if (style.backgroundOpacity > 0 && style.backgroundColor !== "transparent") {
		ctx.fillStyle = hexToRgba(style.backgroundColor, style.backgroundOpacity);
		ctx.beginPath();
		ctx.roundRect(bx, by, blockWidth, blockHeight, borderRadius);
		ctx.fill();
	}

	const outlineWidth = style.outlineWidth * scaleFactor;
	if (outlineWidth > 0) {
		ctx.strokeStyle = style.outlineColor;
		ctx.lineWidth = outlineWidth * 2;
		ctx.lineJoin = "round";
		ctx.miterLimit = 2;
	}

	// Shadow setup (applied per fillText call)
	const applyShadow = () => {
		if (style.shadowBlur > 0 || style.shadowOffsetY !== 0) {
			ctx.shadowColor = style.shadowColor;
			ctx.shadowBlur = Math.max(0, style.shadowBlur * scaleFactor);
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = style.shadowOffsetY * scaleFactor;
		} else {
			ctx.shadowColor = "transparent";
			ctx.shadowBlur = 0;
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
		}
	};

	const drawWordText = (
		text: string,
		startX: number,
		y: number,
		fillStyle: string | CanvasGradient,
	) => {
		if (letterSpacing === 0) {
			if (outlineWidth > 0) {
				ctx.strokeStyle = style.outlineColor;
				ctx.shadowColor = "transparent";
				ctx.strokeText(text, startX, y);
			}
			applyShadow();
			ctx.fillStyle = fillStyle;
			ctx.fillText(text, startX, y);
			return;
		}
		let x = startX;
		for (const char of text) {
			if (outlineWidth > 0) {
				ctx.strokeStyle = style.outlineColor;
				ctx.shadowColor = "transparent";
				ctx.strokeText(char, x, y);
			}
			applyShadow();
			ctx.fillStyle = fillStyle;
			ctx.fillText(char, x, y);
			x += ctx.measureText(char).width + letterSpacing;
		}
	};

	let yCursor = by + padY + lineHeight / 2;
	for (let lineIndex = 0; lineIndex < visibleLines.length; lineIndex++) {
		const line = visibleLines[lineIndex];
		const lineWidth = lineWidths[lineIndex] ?? 0;
		let xCursor = cx - lineWidth / 2;

		for (const word of line.words) {
			const text = style.textTransform === "uppercase" ? word.text.toUpperCase() : word.text;
			const wordWidth = computeWordWidth(text) + Math.max(0, (text.length - 1) * letterSpacing);

			const fillStyle = resolveWordFillStyle(
				ctx,
				word,
				settings.animationMode,
				style.color,
				style.highlightColor,
				inactiveColor,
				xCursor,
				wordWidth,
			);

			drawWordText(text, xCursor, yCursor, fillStyle);
			xCursor += wordWidth + wordGap;
		}

		yCursor += lineHeight + lineGap;
	}

	ctx.restore();
}

function resolveWordFillStyle(
	ctx: CanvasRenderingContext2D,
	word: { isActive: boolean; isPast: boolean; wordProgress: number },
	mode: CaptionSettings["animationMode"],
	baseColor: string,
	highlightColor: string,
	inactiveColor: string,
	wordX: number,
	wordWidth: number,
): string | CanvasGradient {
	switch (mode) {
		case "active-word":
			if (word.isActive) return highlightColor;
			if (word.isPast) return baseColor;
			return inactiveColor;
		case "typewriter":
			return word.isActive ? highlightColor : baseColor;
		case "karaoke-fill": {
			const progress = clamp(word.wordProgress, 0, 1);
			const gradient = ctx.createLinearGradient(wordX, 0, wordX + wordWidth, 0);
			gradient.addColorStop(0, highlightColor);
			gradient.addColorStop(progress, highlightColor);
			gradient.addColorStop(progress, baseColor);
			gradient.addColorStop(1, baseColor);
			return gradient;
		}
		case "fade":
		case "pop":
		case "static":
		default:
			return baseColor;
	}
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}
