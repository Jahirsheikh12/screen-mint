import type {
	CameraLayoutMode,
	CameraLayoutRegion,
	WebcamRegion,
	ZoomRegion,
} from "./types";
import { CAMERA_ZOOM_SCALE_DISABLED } from "./types";
import { findDominantRegion } from "./videoPlayback/zoomRegionUtils";

export interface ResolvedCameraLayoutState {
	mode: CameraLayoutMode;
	region: WebcamRegion;
	mirror: boolean;
	scale: number;
	isZoomScaled: boolean;
	activeLayoutId: string | null;
}

function clampPercent(value: number) {
	return Math.min(100, Math.max(0, value));
}

export function mergeWebcamRegion(
	baseRegion: WebcamRegion,
	override?: Partial<WebcamRegion>,
): WebcamRegion {
	if (!override) {
		return { ...baseRegion, position: { ...baseRegion.position }, size: { ...baseRegion.size } };
	}

	return {
		...baseRegion,
		...override,
		position: {
			...baseRegion.position,
			...override.position,
		},
		size: {
			...baseRegion.size,
			...override.size,
		},
	};
}

export function scaleWebcamRegion(region: WebcamRegion, scale: number): WebcamRegion {
	if (!Number.isFinite(scale) || scale <= 0 || Math.abs(scale - 1) < 0.0001) {
		return { ...region, position: { ...region.position }, size: { ...region.size } };
	}

	const scaledWidth = clampPercent(region.size.width * scale);
	const scaledHeight = clampPercent(region.size.height * scale);
	const deltaX = (region.size.width - scaledWidth) / 2;
	const deltaY = (region.size.height - scaledHeight) / 2;

	return {
		...region,
		position: {
			x: clampPercent(region.position.x + deltaX),
			y: clampPercent(region.position.y + deltaY),
		},
		size: {
			width: scaledWidth,
			height: scaledHeight,
		},
	};
}

export function getActiveCameraLayout(
	cameraLayouts: CameraLayoutRegion[] | undefined,
	timeMs: number,
): CameraLayoutRegion | null {
	if (!cameraLayouts?.length) {
		return null;
	}

	const active = cameraLayouts
		.filter((layout) => timeMs >= layout.startMs && timeMs <= layout.endMs)
		.sort((a, b) => {
			if (a.startMs !== b.startMs) {
				return a.startMs - b.startMs;
			}

			return a.endMs - b.endMs;
		});

	return active.length > 0 ? active[active.length - 1] : null;
}

export function resolveCameraLayoutState(params: {
	timeMs: number;
	webcamRegion: WebcamRegion;
	showWebcam: boolean;
	mirrorWebcam?: boolean;
	cameraLayouts?: CameraLayoutRegion[];
	zoomRegions?: ZoomRegion[];
	connectZooms?: boolean;
	cameraSizeDuringZoom?: number;
}): ResolvedCameraLayoutState {
	const {
		timeMs,
		webcamRegion,
		showWebcam,
		mirrorWebcam = false,
		cameraLayouts = [],
		zoomRegions = [],
		connectZooms = true,
		cameraSizeDuringZoom = CAMERA_ZOOM_SCALE_DISABLED,
	} = params;

	const activeLayout = getActiveCameraLayout(cameraLayouts, timeMs);
	const mode = activeLayout?.mode ?? (showWebcam ? "default" : "hidden");
	const mergedRegion = mergeWebcamRegion(webcamRegion, activeLayout?.regionOverride);
	const zoomScale =
		mode === "default" &&
		cameraSizeDuringZoom > 0 &&
		cameraSizeDuringZoom < CAMERA_ZOOM_SCALE_DISABLED &&
		findDominantRegion(zoomRegions, timeMs, { connectZooms }).region
			? cameraSizeDuringZoom
			: CAMERA_ZOOM_SCALE_DISABLED;

	return {
		mode,
		region: scaleWebcamRegion(mergedRegion, zoomScale),
		mirror: mirrorWebcam,
		scale: zoomScale,
		isZoomScaled: zoomScale !== CAMERA_ZOOM_SCALE_DISABLED,
		activeLayoutId: activeLayout?.id ?? null,
	};
}
