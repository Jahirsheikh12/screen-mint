import type { PixelRect } from "../cameraLayouts";

export interface PreviewGeometry {
	stageRect: PixelRect;
	frameRect: PixelRect;
	maskRect: PixelRect;
}

export function rectsEqual(left: PixelRect, right: PixelRect) {
	return (
		left.x === right.x &&
		left.y === right.y &&
		left.width === right.width &&
		left.height === right.height
	);
}
