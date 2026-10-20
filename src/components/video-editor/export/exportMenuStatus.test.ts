import { describe, expect, it } from "vitest";
import type { ExportProgress } from "@/lib/exporter";
import { resolveExportMenuStatus } from "./exportMenuStatus";

const progress = (patch: Partial<ExportProgress>): ExportProgress => ({
	currentFrame: 10,
	totalFrames: 100,
	percentage: 42.4,
	estimatedTimeRemaining: 5,
	...patch,
});

describe("resolveExportMenuStatus", () => {
	it("maps session status to the menu view", () => {
		expect(resolveExportMenuStatus({ status: "idle", progress: null, format: "mp4" }).view).toBe(
			"settings",
		);
		expect(resolveExportMenuStatus({ status: "saved", progress: null, format: "mp4" }).view).toBe(
			"complete",
		);
		expect(
			resolveExportMenuStatus({ status: "canceled", progress: null, format: "mp4" }).view,
		).toBe("error");
		expect(resolveExportMenuStatus({ status: "failed", progress: null, format: "gif" }).view).toBe(
			"error",
		);
	});

	it("shows preparing and save steps as indeterminate", () => {
		const preparing = resolveExportMenuStatus({
			status: "exporting",
			progress: null,
			format: "mp4",
		});
		expect(preparing).toMatchObject({ view: "progress", indeterminate: true });
		expect(preparing.line.key).toBe("export.preparing");
		const saving = resolveExportMenuStatus({
			status: "awaiting-save-path",
			progress: null,
			format: "mp4",
		});
		expect(saving.line.key).toBe("export.openingSaveDialog");
		expect(saving.indeterminate).toBe(true);
	});

	it("reports percent and render speed while rendering", () => {
		const status = resolveExportMenuStatus({
			status: "exporting",
			progress: progress({ phase: "rendering", throughputFps: 58.27 }),
			format: "mp4",
		});
		expect(status).toMatchObject({ percent: 42, renderFps: 58.3 });
		expect(status.line).toMatchObject({ key: "export.percentComplete", vars: { percent: 42 } });
	});

	it("labels audio and finalizing phases", () => {
		expect(
			resolveExportMenuStatus({
				status: "exporting",
				progress: progress({ phase: "audio", percentage: 70 }),
				format: "mp4",
			}).line.key,
		).toBe("export.renderingAudio");
		const gif = resolveExportMenuStatus({
			status: "exporting",
			progress: progress({ phase: "finalizing", percentage: 100, renderProgress: 35 }),
			format: "gif",
		});
		expect(gif.line).toMatchObject({ key: "export.compilingGif", vars: { percent: 35 } });
		const muxing = resolveExportMenuStatus({
			status: "exporting",
			progress: progress({ phase: "muxing", percentage: 99.6 }),
			format: "mp4",
		});
		expect(muxing).toMatchObject({ indeterminate: true });
		expect(muxing.line.key).toBe("export.finalizing");
	});
});
