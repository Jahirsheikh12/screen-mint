import { spring } from "motion";

export interface SpringState {
	value: number;
	velocity: number;
	initialized: boolean;
}

export interface SpringConfig {
	stiffness: number;
	damping: number;
	mass: number;
	restDelta?: number;
	restSpeed?: number;
}

const CURSOR_SMOOTHING_MIN = 0;
const CURSOR_SMOOTHING_MAX = 2;
const CURSOR_SMOOTHING_LEGACY_MAX = 0.5;

export function createSpringState(initialValue = 0): SpringState {
	return {
		value: initialValue,
		velocity: 0,
		initialized: false,
	};
}

export function resetSpringState(state: SpringState, initialValue?: number) {
	if (typeof initialValue === "number") {
		state.value = initialValue;
	}

	state.velocity = 0;
	state.initialized = false;
}

export function clampDeltaMs(deltaMs: number, fallbackMs = 1000 / 60) {
	if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
		return fallbackMs;
	}

	return Math.min(80, Math.max(1, deltaMs));
}

export function stepSpringValue(
	state: SpringState,
	target: number,
	deltaMs: number,
	config: SpringConfig,
) {
	const safeDeltaMs = clampDeltaMs(deltaMs);

	if (!state.initialized || !Number.isFinite(state.value)) {
		state.value = target;
		state.velocity = 0;
		state.initialized = true;
		return state.value;
	}

	const restDelta = config.restDelta ?? 0.0005;
	const restSpeed = config.restSpeed ?? 0.02;

	if (Math.abs(target - state.value) <= restDelta && Math.abs(state.velocity) <= restSpeed) {
		state.value = target;
		state.velocity = 0;
		return state.value;
	}

	const previousValue = state.value;
	const generator = spring({
		keyframes: [state.value, target],
		velocity: state.velocity,
		stiffness: config.stiffness,
		damping: config.damping,
		mass: config.mass,
		restDelta,
		restSpeed,
	});

	const result = generator.next(safeDeltaMs);
	state.value = result.done ? target : result.value;
	state.velocity = ((state.value - previousValue) / safeDeltaMs) * 1000;

	if (result.done) {
		state.velocity = 0;
	}

	return state.value;
}

export function getCursorSpringConfig(smoothingFactor: number): SpringConfig {
	const clamped = Math.min(CURSOR_SMOOTHING_MAX, Math.max(CURSOR_SMOOTHING_MIN, smoothingFactor));

	if (clamped <= 0) {
		return {
			stiffness: 1000,
			damping: 100,
			mass: 1,
			restDelta: 0.0001,
			restSpeed: 0.001,
		};
	}

	if (clamped <= CURSOR_SMOOTHING_LEGACY_MAX) {
		const legacyNormalized = Math.min(
			1,
			Math.max(
				0,
				(clamped - CURSOR_SMOOTHING_MIN) / (CURSOR_SMOOTHING_LEGACY_MAX - CURSOR_SMOOTHING_MIN),
			),
		);

		return {
			stiffness: 760 - legacyNormalized * 420,
			damping: 34 + legacyNormalized * 24,
			mass: 0.55 + legacyNormalized * 0.45,
			restDelta: 0.0002,
			restSpeed: 0.01,
		};
	}

	const extendedNormalized = Math.min(
		1,
		Math.max(
			0,
			(clamped - CURSOR_SMOOTHING_LEGACY_MAX) /
				(CURSOR_SMOOTHING_MAX - CURSOR_SMOOTHING_LEGACY_MAX),
		),
	);

	return {
		stiffness: 340 - extendedNormalized * 180,
		damping: 58 + extendedNormalized * 22,
		mass: 1 + extendedNormalized * 0.35,
		restDelta: 0.0002,
		restSpeed: 0.01,
	};
}

export function getZoomSpringConfig(): SpringConfig {
	return {
		stiffness: 320,
		damping: 40,
		mass: 0.92,
		restDelta: 0.0005,
		restSpeed: 0.015,
	};
}

/**
 * Converts user-facing CameraSpringSettings (tension/friction/mass) to the
 * internal SpringConfig format (stiffness/damping/mass) used by the spring stepper.
 * Falls back to tuned defaults optimised for Screen.studio-like camera feel.
 */
export function getCameraFocusSpringConfig(cameraSpring?: {
	tension: number;
	friction: number;
	mass: number;
}): SpringConfig {
	if (!cameraSpring) {
		// Default: responsive but smooth — slight natural overshoot, fast settle
		return {
			stiffness: 220,
			damping: 24,
			mass: 0.85,
			restDelta: 0.0003,
			restSpeed: 0.008,
		};
	}

	return {
		stiffness: cameraSpring.tension,
		damping: cameraSpring.friction,
		mass: cameraSpring.mass,
		restDelta: 0.0003,
		restSpeed: 0.008,
	};
}

/**
 * Spring config for zoom scale transitions.
 * Stiffer and more damped than focus springs to prevent wobbly zoom levels.
 */
export function getZoomScaleSpringConfig(): SpringConfig {
	return {
		stiffness: 280,
		damping: 32,
		mass: 0.8,
		restDelta: 0.0004,
		restSpeed: 0.01,
	};
}

/**
 * Asymmetric spring configs for zoom progress (0→1 zoom-in, 1→0 zoom-out).
 * Zoom-in: snappy response, subtle overshoot for cinematic feel.
 * Zoom-out: gentle, relaxed deceleration for smooth release.
 */
export function getZoomProgressSpringConfig(isZoomingIn: boolean): SpringConfig {
	if (isZoomingIn) {
		return {
			stiffness: 300,
			damping: 28,
			mass: 0.75,
			restDelta: 0.0004,
			restSpeed: 0.01,
		};
	}

	// Zoom-out: softer, more damped for gentle release
	return {
		stiffness: 180,
		damping: 30,
		mass: 0.9,
		restDelta: 0.0004,
		restSpeed: 0.01,
	};
}
