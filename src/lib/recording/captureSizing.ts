export interface CaptureDimensions {
	width: number;
	height: number;
}

interface ResolveCaptureDimensionsParams {
	sourceWidth: number;
	sourceHeight: number;
	maxWidth: number;
	maxHeight: number;
}

function ensureEven(value: number) {
	const rounded = Math.max(2, Math.round(value));
	return rounded % 2 === 0 ? rounded : rounded - 1;
}

export function resolveCaptureDimensions(
	params: ResolveCaptureDimensionsParams,
): CaptureDimensions {
	const { sourceWidth, sourceHeight, maxWidth, maxHeight } = params;
	if (!sourceWidth || !sourceHeight || !maxWidth || !maxHeight) {
		return {
			width: ensureEven(sourceWidth || maxWidth || 2),
			height: ensureEven(sourceHeight || maxHeight || 2),
		};
	}

	const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
	return {
		width: ensureEven(sourceWidth * scale),
		height: ensureEven(sourceHeight * scale),
	};
}
