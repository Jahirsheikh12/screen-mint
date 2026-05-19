import type { CropRegion, CursorTelemetryBounds, CursorTelemetryPoint } from "../types";

export interface CursorProjectionDiagnostics {
	reprojectedFromRaw: boolean;
	clamped: boolean;
	lowConfidence: boolean;
	reason?: "missing-bounds" | "invalid-bounds" | "invalid-raw" | "outside-source";
}

export interface ProjectCursorSampleOptions {
	totalMs?: number;
	cropRegion?: CropRegion;
}

export interface ProjectedCursorSample extends CursorTelemetryPoint {
	projection?: CursorProjectionDiagnostics;
}

const FULL_CROP_REGION: CropRegion = { x: 0, y: 0, width: 1, height: 1 };

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function clamp01(value: number) {
	return clamp(value, 0, 1);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function hasValidBounds(
	bounds: CursorTelemetryBounds | undefined,
): bounds is CursorTelemetryBounds {
	return Boolean(
		bounds &&
			isFiniteNumber(bounds.x) &&
			isFiniteNumber(bounds.y) &&
			isFiniteNumber(bounds.width) &&
			isFiniteNumber(bounds.height) &&
			bounds.width > 0 &&
			bounds.height > 0,
	);
}

function normalizeCropRegion(cropRegion?: CropRegion): CropRegion {
	if (!cropRegion) {
		return FULL_CROP_REGION;
	}

	const x = clamp01(cropRegion.x);
	const y = clamp01(cropRegion.y);
	const width = clamp(cropRegion.width, 0.0001, Math.max(0.0001, 1 - x));
	const height = clamp(cropRegion.height, 0.0001, Math.max(0.0001, 1 - y));
	return { x, y, width, height };
}

function applyCropProjection(cx: number, cy: number, cropRegion?: CropRegion) {
	const crop = normalizeCropRegion(cropRegion);
	return {
		cx: (cx - crop.x) / crop.width,
		cy: (cy - crop.y) / crop.height,
	};
}

export function projectCursorSample(
	sample: CursorTelemetryPoint,
	options: ProjectCursorSampleOptions = {},
): ProjectedCursorSample {
	const diagnostics: CursorProjectionDiagnostics = {
		reprojectedFromRaw: false,
		clamped: false,
		lowConfidence: sample.confidence === "low" || sample.projectionConfidence === "low",
	};
	let cx = sample.cx;
	let cy = sample.cy;

	if (isFiniteNumber(sample.rawX) || isFiniteNumber(sample.rawY)) {
		if (!hasValidBounds(sample.sourceBounds)) {
			diagnostics.reason = sample.sourceBounds ? "invalid-bounds" : "missing-bounds";
		} else if (!isFiniteNumber(sample.rawX) || !isFiniteNumber(sample.rawY)) {
			diagnostics.reason = "invalid-raw";
		} else {
			cx = (sample.rawX - sample.sourceBounds.x) / sample.sourceBounds.width;
			cy = (sample.rawY - sample.sourceBounds.y) / sample.sourceBounds.height;
			diagnostics.reprojectedFromRaw = true;
			if (cx < 0 || cx > 1 || cy < 0 || cy > 1) {
				diagnostics.reason = "outside-source";
				diagnostics.lowConfidence = true;
			}
		}
	}

	const cropped = applyCropProjection(cx, cy, options.cropRegion);
	const clampedCx = clamp01(cropped.cx);
	const clampedCy = clamp01(cropped.cy);
	diagnostics.clamped =
		Math.abs(clampedCx - cropped.cx) > 0.000001 || Math.abs(clampedCy - cropped.cy) > 0.000001;
	if (diagnostics.clamped) {
		diagnostics.lowConfidence = true;
	}

	const timeMs =
		typeof options.totalMs === "number"
			? clamp(Math.round(sample.timeMs), 0, Math.max(0, options.totalMs))
			: Math.max(0, Math.round(sample.timeMs));

	return {
		...sample,
		timeMs,
		cx: clampedCx,
		cy: clampedCy,
		confidence:
			sample.confidence ??
			sample.projectionConfidence ??
			(diagnostics.lowConfidence ? "medium" : "high"),
		projection: diagnostics,
	};
}

export function projectCursorTelemetry(
	samples: CursorTelemetryPoint[],
	options: ProjectCursorSampleOptions = {},
): ProjectedCursorSample[] {
	return samples.map((sample) => projectCursorSample(sample, options));
}
