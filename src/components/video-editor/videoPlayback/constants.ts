import type { ZoomFocus } from "../types";

export const DEFAULT_FOCUS: ZoomFocus = { cx: 0.5, cy: 0.5 };

// Zoom-out transition: ~1100ms for a gentle, cinematic release
export const TRANSITION_WINDOW_MS = 1100;
// Zoom-in transition: ~700ms for a snappy, engaging entrance
export const ZOOM_IN_TRANSITION_WINDOW_MS = 700;
// Overlap period at the start of a zoom region where zoom-in completes
export const ZOOM_IN_OVERLAP_MS = 350;

export const MIN_DELTA = 0.0001;
export const VIEWPORT_SCALE = 0.8;
export const ZOOM_TRANSLATION_DEADZONE_PX = 1.25;
export const ZOOM_SCALE_DEADZONE = 0.002;
