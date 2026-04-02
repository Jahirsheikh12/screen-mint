import type { CursorTelemetryPoint, ZoomRegion } from "../types";
import movingWindowCursorArtifact from "./__fixtures__/captured-sessions/moving-window-follow.cursor.json";
import movingWindowScenarioArtifact from "./__fixtures__/captured-sessions/moving-window-follow.scenario.json";
import realAreaTextEntryCursorArtifact from "./__fixtures__/captured-sessions/real-area-text-entry.cursor.json";
import realAreaTextEntryScenarioArtifact from "./__fixtures__/captured-sessions/real-area-text-entry.scenario.json";
import realDisplayNavigationCursorArtifact from "./__fixtures__/captured-sessions/real-display-navigation.cursor.json";
import realDisplayNavigationScenarioArtifact from "./__fixtures__/captured-sessions/real-display-navigation.scenario.json";

export interface RecordedSessionFixture {
	id: string;
	description: string;
	durationMs: number;
	geometry: {
		stageSize: { width: number; height: number };
		baseMask: { x: number; y: number; width: number; height: number };
	};
	sampleTimes: number[];
	zoomRegions: ZoomRegion[];
	cursorTelemetry: CursorTelemetryPoint[];
}

type CursorArtifactFile = {
	version: number;
	samples: CursorTelemetryPoint[];
};

type ScenarioArtifactFile = Omit<RecordedSessionFixture, "cursorTelemetry">;

function buildFixture(
	scenario: ScenarioArtifactFile,
	cursorArtifact: CursorArtifactFile,
): RecordedSessionFixture {
	return {
		...scenario,
		cursorTelemetry: cursorArtifact.samples,
	};
}

export const recordedSessionFixtures: RecordedSessionFixture[] = [
	{
		id: "aggressive-horizontal-follow",
		description: "High-speed horizontal cursor-follow sweep for parity coverage.",
		durationMs: 720,
		geometry: {
			stageSize: { width: 1920, height: 1080 },
			baseMask: { x: 160, y: 90, width: 1600, height: 900 },
		},
		sampleTimes: [0, 120, 240, 360, 480, 600, 720],
		zoomRegions: [
			{
				id: "zoom-fast-follow",
				startMs: 0,
				endMs: 720,
				depth: 4,
				focus: { cx: 0.5, cy: 0.5 },
				mode: "cursor-follow",
			},
		],
		cursorTelemetry: [
			{ timeMs: 0, cx: 0.16, cy: 0.48, rawX: 416, rawY: 522, confidence: "high" },
			{ timeMs: 80, cx: 0.24, cy: 0.48, rawX: 544, rawY: 522, confidence: "high" },
			{ timeMs: 160, cx: 0.38, cy: 0.49, rawX: 768, rawY: 531, confidence: "high" },
			{ timeMs: 240, cx: 0.55, cy: 0.5, rawX: 1040, rawY: 540, confidence: "high" },
			{ timeMs: 320, cx: 0.72, cy: 0.5, rawX: 1312, rawY: 540, confidence: "high" },
			{ timeMs: 400, cx: 0.86, cy: 0.51, rawX: 1536, rawY: 549, confidence: "high" },
			{ timeMs: 480, cx: 0.91, cy: 0.51, rawX: 1616, rawY: 549, confidence: "high" },
			{ timeMs: 560, cx: 0.8, cy: 0.5, rawX: 1440, rawY: 540, confidence: "high" },
			{ timeMs: 640, cx: 0.58, cy: 0.49, rawX: 1088, rawY: 531, confidence: "high" },
			{ timeMs: 720, cx: 0.36, cy: 0.48, rawX: 736, rawY: 522, confidence: "high" },
		],
	},
	buildFixture(
		realAreaTextEntryScenarioArtifact as ScenarioArtifactFile,
		realAreaTextEntryCursorArtifact as CursorArtifactFile,
	),
	buildFixture(
		realDisplayNavigationScenarioArtifact as ScenarioArtifactFile,
		realDisplayNavigationCursorArtifact as CursorArtifactFile,
	),
	buildFixture(
		movingWindowScenarioArtifact as ScenarioArtifactFile,
		movingWindowCursorArtifact as CursorArtifactFile,
	),
];
