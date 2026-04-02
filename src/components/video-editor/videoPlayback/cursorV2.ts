import type {
	CursorMovementStyle,
	CursorPack,
	CursorSpringSettings,
	CursorType,
	CursorTypeMode,
} from "../types";
import {
	DEFAULT_CURSOR_IDLE_HIDE_DELAY_MS,
	DEFAULT_CURSOR_MOVEMENT_STYLE,
	DEFAULT_CURSOR_PACK,
	DEFAULT_CURSOR_SPRING as DEFAULT_CURSOR_SPRING_SETTINGS,
	DEFAULT_CURSOR_TILT,
	DEFAULT_CURSOR_TYPE_MODE,
	DEFAULT_HIGH_QUALITY_SVG_CURSORS,
	DEFAULT_HIDE_CURSOR_WHEN_IDLE,
	DEFAULT_SMOOTH_CURSOR_MOVEMENT,
} from "../types";
import type { CursorMotionSnapshot } from "./cursorSimulation";
import type { SpringConfig } from "./motionSmoothing";
import { getCursorSpringConfig } from "./motionSmoothing";

export const CURSOR_IDLE_FADE_OUT_MS = 150;
export const CURSOR_IDLE_FADE_IN_MS = 90;

export const CURSOR_MOVEMENT_PRESETS: Record<
	Exclude<CursorMovementStyle, "custom">,
	CursorSpringSettings
> = {
	slow: { tension: 180, friction: 86, mass: 1.38 },
	smooth: { tension: 220, friction: 78, mass: 1.28 },
	mellow: { tension: 320, friction: 60, mass: 1 },
	fast: { tension: 620, friction: 40, mass: 0.72 },
};

export interface CursorV2Fields {
	cursorTypeMode: CursorTypeMode;
	cursorTilt: number;
	hideWhenIdle: boolean;
	idleHideDelayMs: number;
	smoothMovementEnabled: boolean;
	cursorMovementStyle: CursorMovementStyle;
	cursorSpring: CursorSpringSettings;
	highQualitySvgCursors: boolean;
}

export interface ResolvedCursorV2Config extends CursorV2Fields {
	springConfig: SpringConfig | null;
	preferSystemCursorAssets: boolean;
	cursorPack: CursorPack;
}

export interface ResolvedCursorVisualMode {
	renderCircleCursor: boolean;
	assetCursorType: CursorType;
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

export function mapLegacyCursorSwayToTilt(cursorSway: number) {
	return clamp(cursorSway / 2, 0, 1);
}

export function springConfigToCursorSpring(config: SpringConfig): CursorSpringSettings {
	return {
		tension: config.stiffness,
		friction: config.damping,
		mass: config.mass,
	};
}

export function normalizeCursorSpring(
	candidate: Partial<CursorSpringSettings> | null | undefined,
	fallback: CursorSpringSettings = DEFAULT_CURSOR_SPRING_SETTINGS,
): CursorSpringSettings {
	return {
		tension: isFiniteNumber(candidate?.tension) ? clamp(candidate.tension, 120, 700) : fallback.tension,
		friction: isFiniteNumber(candidate?.friction)
			? clamp(candidate.friction, 20, 100)
			: fallback.friction,
		mass: isFiniteNumber(candidate?.mass) ? clamp(candidate.mass, 0.5, 1.6) : fallback.mass,
	};
}

export function resolveCursorV2Fields(args: {
	cursorTypeMode?: unknown;
	cursorTilt?: unknown;
	hideWhenIdle?: unknown;
	idleHideDelayMs?: unknown;
	smoothMovementEnabled?: unknown;
	cursorMovementStyle?: unknown;
	cursorSpring?: Partial<CursorSpringSettings> | null;
	highQualitySvgCursors?: unknown;
	legacyCursorSmoothing?: unknown;
	legacyCursorSway?: unknown;
}): CursorV2Fields {
	const legacySmoothing = isFiniteNumber(args.legacyCursorSmoothing) ? args.legacyCursorSmoothing : 0;
	const legacySway = isFiniteNumber(args.legacyCursorSway) ? args.legacyCursorSway : DEFAULT_CURSOR_TILT * 2;
	const legacySpring = springConfigToCursorSpring(getCursorSpringConfig(clamp(legacySmoothing, 0, 2)));
	const fallbackSpring = normalizeCursorSpring(args.cursorSpring, legacySpring);

	return {
		cursorTypeMode:
			args.cursorTypeMode === "circle" || args.cursorTypeMode === "auto"
				? args.cursorTypeMode
				: DEFAULT_CURSOR_TYPE_MODE,
		cursorTilt: isFiniteNumber(args.cursorTilt)
			? clamp(args.cursorTilt, 0, 1)
			: mapLegacyCursorSwayToTilt(legacySway),
		hideWhenIdle:
			typeof args.hideWhenIdle === "boolean" ? args.hideWhenIdle : DEFAULT_HIDE_CURSOR_WHEN_IDLE,
		idleHideDelayMs: isFiniteNumber(args.idleHideDelayMs)
			? clamp(Math.round(args.idleHideDelayMs), 500, 5000)
			: DEFAULT_CURSOR_IDLE_HIDE_DELAY_MS,
		smoothMovementEnabled:
			typeof args.smoothMovementEnabled === "boolean"
				? args.smoothMovementEnabled
				: legacySmoothing > 0
					? true
					: DEFAULT_SMOOTH_CURSOR_MOVEMENT,
		cursorMovementStyle:
			args.cursorMovementStyle === "slow" ||
			args.cursorMovementStyle === "smooth" ||
			args.cursorMovementStyle === "mellow" ||
			args.cursorMovementStyle === "fast" ||
			args.cursorMovementStyle === "custom"
				? args.cursorMovementStyle
				: DEFAULT_CURSOR_MOVEMENT_STYLE,
		cursorSpring: fallbackSpring,
		highQualitySvgCursors:
			typeof args.highQualitySvgCursors === "boolean"
				? args.highQualitySvgCursors
				: DEFAULT_HIGH_QUALITY_SVG_CURSORS,
	};
}

export function cursorSpringToSpringConfig(cursorSpring: CursorSpringSettings): SpringConfig {
	return {
		stiffness: cursorSpring.tension,
		damping: cursorSpring.friction,
		mass: cursorSpring.mass,
		restDelta: 0.0002,
		restSpeed: 0.01,
	};
}

export function resolveCursorMovementSpringConfig(
	smoothMovementEnabled: boolean,
	cursorMovementStyle: CursorMovementStyle,
	cursorSpring: CursorSpringSettings,
): SpringConfig | null {
	if (!smoothMovementEnabled) {
		return null;
	}

	if (cursorMovementStyle === "custom") {
		return cursorSpringToSpringConfig(cursorSpring);
	}

	return cursorSpringToSpringConfig(CURSOR_MOVEMENT_PRESETS[cursorMovementStyle]);
}

export function resolveCursorV2Config(args: CursorV2Fields & { cursorPack?: CursorPack }): ResolvedCursorV2Config {
	return {
		...args,
		cursorPack: args.cursorPack ?? DEFAULT_CURSOR_PACK,
		springConfig: resolveCursorMovementSpringConfig(
			args.smoothMovementEnabled,
			args.cursorMovementStyle,
			args.cursorSpring,
		),
		preferSystemCursorAssets: !args.highQualitySvgCursors,
	};
}

export function resolveCursorVisualMode(args: {
	cursorTypeMode: CursorTypeMode;
	detectedCursorType?: CursorType | null;
	availableCursorTypes?: readonly CursorType[];
}): ResolvedCursorVisualMode {
	if (args.cursorTypeMode === "circle") {
		return {
			renderCircleCursor: true,
			assetCursorType: "arrow",
		};
	}

	const detectedCursorType = args.detectedCursorType ?? "arrow";
	const canRenderDetectedCursor =
		!args.availableCursorTypes || args.availableCursorTypes.includes(detectedCursorType);

	return {
		renderCircleCursor: false,
		assetCursorType: canRenderDetectedCursor ? detectedCursorType : "arrow",
	};
}

export function getCursorVisibilityOpacity(
	motionSnapshot: CursorMotionSnapshot | null | undefined,
	options: Pick<CursorV2Fields, "hideWhenIdle" | "idleHideDelayMs">,
) {
	if (!options.hideWhenIdle || !motionSnapshot) {
		return 1;
	}

	if (motionSnapshot.isActive) {
		const fadeInProgress =
			(motionSnapshot.timeMs - motionSnapshot.lastBecameActiveTimeMs) / CURSOR_IDLE_FADE_IN_MS;
		return clamp(fadeInProgress, 0, 1);
	}

	const inactiveMs = motionSnapshot.timeMs - motionSnapshot.lastBecameInactiveTimeMs;
	if (inactiveMs <= options.idleHideDelayMs) {
		return 1;
	}

	const fadeOutProgress = (inactiveMs - options.idleHideDelayMs) / CURSOR_IDLE_FADE_OUT_MS;
	return 1 - clamp(fadeOutProgress, 0, 1);
}

export function getCursorTiltRotation(
	motionSnapshot: CursorMotionSnapshot | null | undefined,
	cursorTilt: number,
) {
	if (!motionSnapshot || cursorTilt <= 0) {
		return 0;
	}

	const speed = Math.hypot(motionSnapshot.velocityX, motionSnapshot.velocityY);
	if (!Number.isFinite(speed) || speed < 0.015) {
		return 0;
	}

	const directionalBias = clamp(
		Math.cos(motionSnapshot.heading) + Math.sin(motionSnapshot.heading) * 0.65,
		-1,
		1,
	);
	const speedFactor = clamp(speed / 0.9, 0, 1);
	return directionalBias * speedFactor * (Math.PI / 10) * cursorTilt;
}
