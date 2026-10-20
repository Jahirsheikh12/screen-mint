import type { PaddingValue } from "../../components/video-editor/types";

/**
 * Area left for the frame after padding. Each side unit insets 0.2% of the container, so a
 * uniform value p shrinks the frame to (1 - 0.4·p/100) and stays centered.
 */
export function resolvePaddedArea(
	containerWidth: number,
	containerHeight: number,
	padding: PaddingValue = 0,
) {
	const sides =
		typeof padding === "number"
			? { top: padding, bottom: padding, left: padding, right: padding }
			: padding;
	const inset = (value: number, size: number) => (Math.max(0, value) / 100) * 0.2 * size;
	const left = inset(sides.left, containerWidth);
	const right = inset(sides.right, containerWidth);
	const top = inset(sides.top, containerHeight);
	const bottom = inset(sides.bottom, containerHeight);
	return {
		x: left,
		y: top,
		width: Math.max(1, containerWidth - left - right),
		height: Math.max(1, containerHeight - top - bottom),
	};
}
