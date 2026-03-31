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
