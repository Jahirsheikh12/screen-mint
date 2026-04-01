export type HudCompactLayout = {
	width: number;
	height: number;
};

export type RectLike = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export const HUD_COMPACT_BOTTOM_MARGIN = 5;

export const DEFAULT_HUD_COMPACT_LAYOUT: HudCompactLayout = {
	width: 980,
	height: 400,
};

export function computeHudCompactBounds(
	workArea: RectLike,
	layout: HudCompactLayout,
	bottomMargin = HUD_COMPACT_BOTTOM_MARGIN,
): RectLike {
	const safeBottomMargin = Math.max(0, Math.round(bottomMargin));
	const width = Math.max(1, Math.min(Math.round(layout.width), workArea.width));
	const availableHeight = Math.max(1, workArea.height - safeBottomMargin);
	const height = Math.max(1, Math.min(Math.round(layout.height), availableHeight));
	const x = workArea.x + Math.floor((workArea.width - width) / 2);
	const y = Math.max(workArea.y, workArea.y + workArea.height - height - safeBottomMargin);

	return { x, y, width, height };
}
