import { useEffect } from "react";
import {
	type ExportProgress,
	type ExportV2StartRequest,
	GifExporter,
	isValidGifFrameRate,
	VideoExporter,
} from "@/lib/exporter";

export function ExportWorker() {
	useEffect(() => {
		return window.electronAPI.onExportV2WorkerStart((request) => {
			void runWorkerExport(request);
		});
	}, []);

	return null;
}

async function runWorkerExport(request: ExportV2StartRequest) {
	try {
		const composition = request.compositionPayload;
		if (!composition) {
			throw new Error("Export worker received no composition payload.");
		}
		if (!request.outputPath) {
			throw new Error("Export worker requires an output path.");
		}

		const onProgress = (progress: ExportProgress) => {
			void window.electronAPI.exportV2WorkerProgress({
				...progress,
				jobId: request.jobId ?? "export-worker",
				engine: "composited-hardware",
			});
		};
		const gifFrameRate = isValidGifFrameRate(request.frameRate) ? request.frameRate : 15;

		const result =
			request.format === "gif"
				? await new GifExporter({
						...composition,
						width: request.width,
						height: request.height,
						frameRate: gifFrameRate,
						loop: request.gif?.loop ?? true,
						preset: "quality",
						dedupeFrames: request.gif?.dedupeFrames ?? true,
						colorCount: request.gif?.colorCount ?? 256,
						ditherMode: request.gif?.ditherMode ?? "bayer",
						motionSensitivity: request.gif?.motionSensitivity ?? "balanced",
						outputPath: request.outputPath,
						jobId: request.jobId,
						onProgress,
					}).export()
				: await new VideoExporter({
						...composition,
						width: request.width,
						height: request.height,
						frameRate: request.frameRate,
						bitrate: request.bitrate ?? 12_000_000,
						codec: "avc1.640033",
						outputPath: request.outputPath,
						schedulerMode: "worker",
						onProgress,
					}).export();

		await window.electronAPI.exportV2WorkerComplete({
			...result,
			jobId: request.jobId,
			path: result.path ?? request.outputPath,
			details: result.details
				? {
						...result.details,
						engine: "composited-hardware",
					}
				: undefined,
		});
	} catch (error) {
		await window.electronAPI.exportV2WorkerComplete({
			success: false,
			jobId: request.jobId,
			fallbackToLegacy: true,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
