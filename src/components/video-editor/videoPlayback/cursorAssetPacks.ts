import crosshairClassicUrl from "../../../assets/cursors/Cursor=Cross.svg";
import arrowClassicUrl from "../../../assets/cursors/Cursor=Default.svg";
import closedHandClassicUrl from "../../../assets/cursors/Cursor=Hand-(Grabbing).svg";
import openHandClassicUrl from "../../../assets/cursors/Cursor=Hand-(Open).svg";
import pointerClassicUrl from "../../../assets/cursors/Cursor=Hand-(Pointing).svg";
import resizeNsClassicUrl from "../../../assets/cursors/Cursor=Resize-North-South.svg";
import resizeEwClassicUrl from "../../../assets/cursors/Cursor=Resize-West-East.svg";
import textClassicUrl from "../../../assets/cursors/Cursor=Text-Cursor.svg";
import closedHandCustomUrl from "../../../assets/cursors/custom/closed-hand.svg";
import copyCustomUrl from "../../../assets/cursors/custom/copy.svg";
import helpCustomUrl from "../../../assets/cursors/custom/help.svg";
import moveCustomUrl from "../../../assets/cursors/custom/move.svg";
import notAllowedCustomUrl from "../../../assets/cursors/custom/not-allowed.svg";
import openHandCustomUrl from "../../../assets/cursors/custom/open-hand.svg";
import pointerCustomUrl from "../../../assets/cursors/custom/pointer.svg";
import resizeNeswCustomUrl from "../../../assets/cursors/custom/resize-nesw.svg";
import screenshotSelectionCustomUrl from "../../../assets/cursors/custom/screenshot-selection.svg";
import zoomInCustomUrl from "../../../assets/cursors/custom/zoom-in.svg";
import zoomOutCustomUrl from "../../../assets/cursors/custom/zoom-out.svg";
import arrowMacosUrl from "../../../assets/cursors/macos/arrow.svg";
import closedHandMacosUrl from "../../../assets/cursors/macos/closed-hand.svg";
import copyMacosUrl from "../../../assets/cursors/macos/copy.svg";
import crosshairMacosUrl from "../../../assets/cursors/macos/crosshair.svg";
import helpMacosUrl from "../../../assets/cursors/macos/help.svg";
import moveMacosUrl from "../../../assets/cursors/macos/move.svg";
import notAllowedMacosUrl from "../../../assets/cursors/macos/not-allowed.svg";
import openHandMacosUrl from "../../../assets/cursors/macos/open-hand.svg";
import pointerMacosUrl from "../../../assets/cursors/macos/pointer.svg";
import resizeEwMacosUrl from "../../../assets/cursors/macos/resize-ew.svg";
import resizeNeswMacosUrl from "../../../assets/cursors/macos/resize-nesw.svg";
import resizeNsMacosUrl from "../../../assets/cursors/macos/resize-ns.svg";
import screenshotSelectionMacosUrl from "../../../assets/cursors/macos/screenshot-selection.svg";
import textMacosUrl from "../../../assets/cursors/macos/text.svg";
import zoomInMacosUrl from "../../../assets/cursors/macos/zoom-in.svg";
import zoomOutMacosUrl from "../../../assets/cursors/macos/zoom-out.svg";
import type { CursorPack, CursorType } from "../types";

export type CursorAssetDefinition = {
	url: string;
	trim?: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	fallbackAnchor: {
		x: number;
		y: number;
	};
};

export const CURSOR_ASSET_SAMPLE_SIZE = 1024;

export const SUPPORTED_CURSOR_KEYS: CursorType[] = [
	"arrow",
	"text",
	"pointer",
	"crosshair",
	"open-hand",
	"closed-hand",
	"resize-ew",
	"resize-ns",
	"resize-nesw",
	"not-allowed",
	"copy",
	"help",
	"move",
	"zoom-in",
	"zoom-out",
	"screenshot-selection",
];

export const cursorAssetPacks: Record<
	CursorPack,
	Partial<Record<CursorType, CursorAssetDefinition>>
> = {
	classic: {
		arrow: {
			url: arrowClassicUrl,
			trim: { x: 480, y: 435, width: 333, height: 553 },
			fallbackAnchor: { x: 0.18, y: 0.1 },
		},
		text: {
			url: textClassicUrl,
			trim: { x: 404, y: 192, width: 247, height: 596 },
			fallbackAnchor: { x: 0.5, y: 0.5 },
		},
		pointer: {
			url: pointerClassicUrl,
			trim: { x: 352, y: 441, width: 466, height: 583 },
			fallbackAnchor: { x: 0.37, y: 0.08 },
		},
		crosshair: {
			url: crosshairClassicUrl,
			trim: { x: 288, y: 288, width: 480, height: 480 },
			fallbackAnchor: { x: 0.5, y: 0.5 },
		},
		"open-hand": {
			url: openHandClassicUrl,
			trim: { x: 288, y: 188, width: 512, height: 580 },
			fallbackAnchor: { x: 0.5, y: 0.28 },
		},
		"closed-hand": {
			url: closedHandClassicUrl,
			trim: { x: 344, y: 365, width: 432, height: 403 },
			fallbackAnchor: { x: 0.5, y: 0.28 },
		},
		"resize-ew": {
			url: resizeEwClassicUrl,
			trim: { x: 187, y: 384, width: 669, height: 270 },
			fallbackAnchor: { x: 0.5, y: 0.5 },
		},
		"resize-ns": {
			url: resizeNsClassicUrl,
			trim: { x: 376, y: 178, width: 271, height: 669 },
			fallbackAnchor: { x: 0.5, y: 0.5 },
		},
	},
	custom: {
		pointer: {
			url: pointerCustomUrl,
			fallbackAnchor: { x: 0.36, y: 0.08 },
		},
		"open-hand": {
			url: openHandCustomUrl,
			fallbackAnchor: { x: 0.5, y: 0.28 },
		},
		"closed-hand": {
			url: closedHandCustomUrl,
			fallbackAnchor: { x: 0.5, y: 0.28 },
		},
		"resize-nesw": {
			url: resizeNeswCustomUrl,
			fallbackAnchor: { x: 0.5, y: 0.5 },
		},
		"not-allowed": {
			url: notAllowedCustomUrl,
			fallbackAnchor: { x: 0.18, y: 0.1 },
		},
		copy: {
			url: copyCustomUrl,
			fallbackAnchor: { x: 0.18, y: 0.1 },
		},
		help: {
			url: helpCustomUrl,
			fallbackAnchor: { x: 0.5, y: 0.5 },
		},
		move: {
			url: moveCustomUrl,
			fallbackAnchor: { x: 0.5, y: 0.5 },
		},
		"zoom-in": {
			url: zoomInCustomUrl,
			fallbackAnchor: { x: 0.4, y: 0.35 },
		},
		"zoom-out": {
			url: zoomOutCustomUrl,
			fallbackAnchor: { x: 0.4, y: 0.35 },
		},
		"screenshot-selection": {
			url: screenshotSelectionCustomUrl,
			fallbackAnchor: { x: 0.5, y: 0.5 },
		},
	},
	macos: {
		arrow: {
			url: arrowMacosUrl,
			fallbackAnchor: { x: 0.18, y: 0.1 },
		},
		text: {
			url: textMacosUrl,
			fallbackAnchor: { x: 0.5, y: 0.5 },
		},
		pointer: {
			url: pointerMacosUrl,
			fallbackAnchor: { x: 0.36, y: 0.08 },
		},
		crosshair: {
			url: crosshairMacosUrl,
			fallbackAnchor: { x: 0.5, y: 0.5 },
		},
		"open-hand": {
			url: openHandMacosUrl,
			fallbackAnchor: { x: 0.5, y: 0.28 },
		},
		"closed-hand": {
			url: closedHandMacosUrl,
			fallbackAnchor: { x: 0.5, y: 0.28 },
		},
		"resize-ew": {
			url: resizeEwMacosUrl,
			fallbackAnchor: { x: 0.5, y: 0.5 },
		},
		"resize-ns": {
			url: resizeNsMacosUrl,
			fallbackAnchor: { x: 0.5, y: 0.5 },
		},
		"resize-nesw": {
			url: resizeNeswMacosUrl,
			fallbackAnchor: { x: 0.5, y: 0.5 },
		},
		"not-allowed": {
			url: notAllowedMacosUrl,
			fallbackAnchor: { x: 0.18, y: 0.1 },
		},
		copy: {
			url: copyMacosUrl,
			fallbackAnchor: { x: 0.18, y: 0.1 },
		},
		help: {
			url: helpMacosUrl,
			fallbackAnchor: { x: 0.5, y: 0.5 },
		},
		move: {
			url: moveMacosUrl,
			fallbackAnchor: { x: 0.5, y: 0.5 },
		},
		"zoom-in": {
			url: zoomInMacosUrl,
			fallbackAnchor: { x: 0.4, y: 0.35 },
		},
		"zoom-out": {
			url: zoomOutMacosUrl,
			fallbackAnchor: { x: 0.4, y: 0.35 },
		},
		"screenshot-selection": {
			url: screenshotSelectionMacosUrl,
			fallbackAnchor: { x: 0.5, y: 0.5 },
		},
	},
};

export const cursorPackPreviewUrls: Record<CursorPack, string> = {
	classic: arrowClassicUrl,
	custom: pointerCustomUrl,
	macos: arrowMacosUrl,
};
