import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	getDefaultGifExportSettings,
	getDefaultVideoExportSettings,
	resolveGifExportPlan,
	resolveVideoExportPlan,
} from "@/lib/exporter";
import { ExportSettingsDialog } from "./ExportSettingsDialog";
import {
	buildSourceVideoMetadata,
	selectGifQualitySettings,
	selectVideoQualitySettings,
} from "./exportUtils";

const source = buildSourceVideoMetadata({
	width: 3840,
	height: 2160,
	frameRate: 60,
	durationMs: 10_000,
});

function renderExportSettingsDialog({
	videoSettings = getDefaultVideoExportSettings(),
	gifSettings = getDefaultGifExportSettings(),
	format = "mp4" as const,
}) {
	return renderToStaticMarkup(
		<ExportSettingsDialog
			isOpen
			onClose={() => undefined}
			exportFormat={format}
			onExportFormatChange={() => undefined}
			exportDestination="file"
			onExportDestinationChange={() => undefined}
			videoExportSettings={videoSettings}
			onVideoExportSettingsChange={() => undefined}
			gifExportSettings={gifSettings}
			onGifExportSettingsChange={() => undefined}
			resolvedVideoPlan={resolveVideoExportPlan(source, videoSettings, 16 / 9)}
			resolvedGifPlan={resolveGifExportPlan(source, gifSettings, 16 / 9, 10_000)}
			onExport={() => undefined}
		/>,
	);
}

function countSelectedOption(html: string, label: string): number {
	const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const matches = html.match(
		new RegExp(
			`data-selection-label="${escapedLabel}" data-selected="true"|data-selected="true" data-selection-label="${escapedLabel}"`,
			"g",
		),
	);
	return matches?.length ?? 0;
}

function getOptionLabelsForGroup(html: string, group: string): string[] {
	const matches = html.matchAll(
		new RegExp(
			`data-selection-label="([^"]+)" data-selected="(?:true|false)" data-option-group="${group}"|data-option-group="${group}" data-selection-label="([^"]+)"`,
			"g",
		),
	);
	return Array.from(matches, (match) => match[1] ?? match[2]);
}

describe("ExportSettingsDialog", () => {
	it("shows Maximum video quality with its 4K and 60 FPS selections", () => {
		const html = renderExportSettingsDialog({
			videoSettings: selectVideoQualitySettings(getDefaultVideoExportSettings(), "maximum"),
		});

		expect(html).toContain("Maximum");
		expect(countSelectedOption(html, "4K")).toBe(1);
		expect(countSelectedOption(html, "60")).toBe(1);
	});

	it("shows Social video quality with 1440p and Auto selected", () => {
		const html = renderExportSettingsDialog({
			videoSettings: selectVideoQualitySettings(getDefaultVideoExportSettings(), "social"),
		});

		expect(countSelectedOption(html, "Social")).toBe(1);
		expect(countSelectedOption(html, "1440p")).toBe(1);
		expect(countSelectedOption(html, "60")).toBe(1);
	});

	it("only shows 30 and 60 fps for MP4 exports", () => {
		const html = renderExportSettingsDialog({});

		expect(getOptionLabelsForGroup(html, "video-frame-rate")).toEqual(["30", "60"]);
	});

	it("shows Social GIF quality with its 1080p and 20 FPS selections", () => {
		const html = renderExportSettingsDialog({
			format: "gif",
			gifSettings: selectGifQualitySettings("social"),
		});

		expect(countSelectedOption(html, "Social")).toBe(1);
		expect(countSelectedOption(html, "1080p")).toBe(1);
		expect(countSelectedOption(html, "20")).toBe(1);
	});

	it("surfaces custom mode when output controls no longer match a profile", () => {
		const html = renderExportSettingsDialog({
			videoSettings: {
				...getDefaultVideoExportSettings(),
				mode: "custom",
				resolutionMode: "2160p",
				frameRateMode: "60",
				bitrateMode: "bpp",
				bitsPerPixel: 0.4,
			},
		});

		expect(html).toContain("Custom profile is active");
		expect(countSelectedOption(html, "4K")).toBe(1);
		expect(countSelectedOption(html, "60")).toBe(1);
	});
});
