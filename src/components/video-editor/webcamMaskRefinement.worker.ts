/// <reference lib="webworker" />

import { refineSegmentationConfidenceMask } from "./webcamSegmentation";

interface WebcamMaskRefinementRequest {
	id: number;
	confidenceBuffer: ArrayBuffer;
	width: number;
	height: number;
	previousAlphaBuffer?: ArrayBuffer | null;
}

interface WebcamMaskRefinementResponse {
	id: number;
	refinedAlphaBuffer: ArrayBuffer;
	quality: {
		foregroundCoverage: number;
		edgeCoverage: number;
		temporalWeight: number;
	};
}

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = (event: MessageEvent<WebcamMaskRefinementRequest>) => {
	const { id, confidenceBuffer, width, height, previousAlphaBuffer } = event.data;
	const confidence = new Float32Array(confidenceBuffer);
	const previousAlpha = previousAlphaBuffer ? new Uint8ClampedArray(previousAlphaBuffer) : null;

	const refined = refineSegmentationConfidenceMask({
		confidence,
		width,
		height,
		previousAlpha,
	});

	const response: WebcamMaskRefinementResponse = {
		id,
		refinedAlphaBuffer: refined.refinedAlpha.slice().buffer as ArrayBuffer,
		quality: refined.quality,
	};

	workerScope.postMessage(response, [response.refinedAlphaBuffer]);
};

export {};
