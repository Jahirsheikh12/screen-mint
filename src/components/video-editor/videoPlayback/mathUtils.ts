import type { ZoomTransitionEasing } from "../types";

export function clamp01(value: number) {
	return Math.max(0, Math.min(1, value));
}

function sampleCubicBezier(a1: number, a2: number, t: number) {
	const oneMinusT = 1 - t;
	return 3 * a1 * oneMinusT * oneMinusT * t + 3 * a2 * oneMinusT * t * t + t * t * t;
}

function sampleCubicBezierDerivative(a1: number, a2: number, t: number) {
	const oneMinusT = 1 - t;
	return 3 * a1 * oneMinusT * oneMinusT + 6 * (a2 - a1) * oneMinusT * t + 3 * (1 - a2) * t * t;
}

export function cubicBezier(x1: number, y1: number, x2: number, y2: number, t: number) {
	const targetX = clamp01(t);
	let solvedT = targetX;

	for (let i = 0; i < 8; i += 1) {
		const currentX = sampleCubicBezier(x1, x2, solvedT) - targetX;
		const currentDerivative = sampleCubicBezierDerivative(x1, x2, solvedT);

		if (Math.abs(currentX) < 1e-6 || Math.abs(currentDerivative) < 1e-6) {
			break;
		}

		solvedT -= currentX / currentDerivative;
	}

	let lower = 0;
	let upper = 1;
	solvedT = clamp01(solvedT);

	for (let i = 0; i < 10; i += 1) {
		const currentX = sampleCubicBezier(x1, x2, solvedT);
		if (Math.abs(currentX - targetX) < 1e-6) {
			break;
		}

		if (currentX < targetX) {
			lower = solvedT;
		} else {
			upper = solvedT;
		}

		solvedT = (lower + upper) / 2;
	}

	return sampleCubicBezier(y1, y2, solvedT);
}

export function easeOutExpo(t: number) {
	const clamped = clamp01(t);
	if (clamped === 1) {
		return 1;
	}

	return 1 - Math.pow(2, -7 * clamped);
}

export function easeOutScreenStudio(t: number) {
	return cubicBezier(0.16, 1, 0.3, 1, t);
}

export function smoothStep(t: number) {
	const clamped = clamp01(t);
	return clamped * clamped * (3 - 2 * clamped);
}

/**
 * Gentle ease-in-out cubic — slow start, smooth middle, gentle landing.
 * Used for zoom-in transitions.
 */
export function easeInOutCubic(t: number) {
	const x = clamp01(t);
	return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Ease-out cubic — starts at speed, then decelerates to a gentle stop.
 * Used for zoom-out transitions so strength eases smoothly to zero.
 */
export function easeOutCubic(t: number) {
	const x = clamp01(t);
	return 1 - Math.pow(1 - x, 3);
}

/** Maps 0..1 transition progress through the named zoom curve. */
export function applyZoomEasing(easing: ZoomTransitionEasing, t: number) {
	switch (easing) {
		case "glide":
			return cubicBezier(0.25, 0.1, 0.25, 1, t);
		case "smooth":
			return easeInOutCubic(t);
		case "snappy":
			return easeOutExpo(t);
		case "linear":
			return clamp01(t);
		default:
			return easeOutScreenStudio(t);
	}
}
