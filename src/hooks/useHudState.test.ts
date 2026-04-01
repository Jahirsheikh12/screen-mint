import { describe, expect, it } from "vitest";
import { DEFAULT_HUD_SETTINGS, resolveHudSettings } from "./useHudState";

describe("resolveHudSettings", () => {
	it("defaults autoCreateZooms to true when the stored setting is missing", () => {
		expect(resolveHudSettings({ afterRecordingAction: "create-project" }).autoCreateZooms).toBe(
			true,
		);
	});

	it("preserves an explicit opt-out for autoCreateZooms", () => {
		expect(resolveHudSettings({ autoCreateZooms: false }).autoCreateZooms).toBe(false);
	});

	it("preserves an explicit opt-in for autoCreateZooms", () => {
		expect(resolveHudSettings({ autoCreateZooms: true }).autoCreateZooms).toBe(true);
		expect(DEFAULT_HUD_SETTINGS.autoCreateZooms).toBe(true);
	});
});
