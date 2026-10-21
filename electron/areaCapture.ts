import type { SelectedArea } from "../src/lib/recording/session";

const round = (value: number) => Math.round(value * 1e6) / 1e6;

/**
 * ffmpeg crop for a normalized area. Width, height and offsets are kept even because
 * H.264 4:2:0 output rejects odd sizes.
 */
export function buildAreaCropFilter(bounds: SelectedArea["normalizedBounds"]): string {
	const x = round(bounds.x);
	const y = round(bounds.y);
	const w = round(bounds.width);
	const h = round(bounds.height);
	return `crop=max(2\\,trunc(iw*${w}/2)*2):max(2\\,trunc(ih*${h}/2)*2):trunc(iw*${x}/2)*2:trunc(ih*${y}/2)*2`;
}

/** The area relative to its display's top-left, in points, for the native recorder. */
export function toDisplaySourceRect(
	area: SelectedArea,
	displayId: number,
): { x: number; y: number; width: number; height: number } | null {
	if (area.displayId !== displayId || area.bounds.width < 2 || area.bounds.height < 2) {
		return null;
	}
	return {
		x: area.bounds.x - area.displayBounds.x,
		y: area.bounds.y - area.displayBounds.y,
		width: area.bounds.width,
		height: area.bounds.height,
	};
}
