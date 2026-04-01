import { describe, expect, it } from "vitest";
import type { PreviewQuality } from "../types";
import {
	commitPreviewQualitySwitch,
	createPreviewQualitySwitchState,
	getEffectivePreviewResolution,
	requestPreviewQualitySwitch,
	rollbackPreviewQualitySwitch,
} from "./previewQuality";

describe("previewQuality", () => {
	it.each([
		{ devicePixelRatio: 1, quality: "low" as PreviewQuality, resolution: 0.5 },
		{ devicePixelRatio: 1, quality: "medium" as PreviewQuality, resolution: 0.75 },
		{ devicePixelRatio: 1, quality: "high" as PreviewQuality, resolution: 1 },
		{ devicePixelRatio: 2, quality: "low" as PreviewQuality, resolution: 1 },
		{ devicePixelRatio: 2, quality: "medium" as PreviewQuality, resolution: 1.5 },
		{ devicePixelRatio: 2, quality: "high" as PreviewQuality, resolution: 2 },
		{ devicePixelRatio: 3, quality: "low" as PreviewQuality, resolution: 1.5 },
		{ devicePixelRatio: 3, quality: "medium" as PreviewQuality, resolution: 2.25 },
		{ devicePixelRatio: 3, quality: "high" as PreviewQuality, resolution: 3 },
	])("computes effective resolution for DPR $devicePixelRatio at $quality quality", ({
		devicePixelRatio,
		quality,
		resolution,
	}) => {
		expect(getEffectivePreviewResolution(devicePixelRatio, quality)).toBe(resolution);
	});

	it("queues the last requested switch while another quality change is in flight", () => {
		const initial = createPreviewQualitySwitchState("high");
		const firstRequest = requestPreviewQualitySwitch(initial, "low");
		expect(firstRequest.startQuality).toBe("low");
		expect(firstRequest.state.inFlightQuality).toBe("low");

		const queuedRequest = requestPreviewQualitySwitch(firstRequest.state, "medium");
		expect(queuedRequest.startQuality).toBeNull();
		expect(queuedRequest.state.queuedQuality).toBe("medium");

		const success = commitPreviewQualitySwitch(queuedRequest.state);
		expect(success.state.activeQuality).toBe("low");
		expect(success.startQuality).toBe("medium");
		expect(success.state.inFlightQuality).toBe("medium");
	});

	it("falls back to the last stable quality if a switch fails", () => {
		const initial = createPreviewQualitySwitchState("high");
		const request = requestPreviewQualitySwitch(initial, "low");
		const failure = rollbackPreviewQualitySwitch(request.state);

		expect(failure.fallbackQuality).toBe("high");
		expect(failure.startQuality).toBe("high");
		expect(failure.state.activeQuality).toBe("high");
		expect(failure.state.inFlightQuality).toBe("high");
		expect(failure.state.queuedQuality).toBeNull();
	});
});
