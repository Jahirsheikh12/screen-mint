import { describe, expect, it } from "vitest";
import { DEFAULT_FEATURE_FLAGS, getFeatureFlags, isFeatureEnabled } from "./featureFlags";

describe("feature flags", () => {
	it("keeps screenshots disabled by default", () => {
		expect(DEFAULT_FEATURE_FLAGS.screenshots).toBe(false);
		expect(getFeatureFlags().screenshots).toBe(false);
		expect(isFeatureEnabled("screenshots")).toBe(false);
	});

	it("allows explicit screenshot opt-in for internal builds", () => {
		expect(isFeatureEnabled("screenshots", { screenshots: true })).toBe(true);
	});
});
