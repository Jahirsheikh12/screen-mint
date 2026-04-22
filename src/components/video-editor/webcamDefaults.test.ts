import { describe, expect, it } from "vitest";
import { getRecommendedWebcamDefaults } from "./types";

describe("getRecommendedWebcamDefaults", () => {
	it("returns floating-card defaults for widescreen projects", () => {
		const defaults = getRecommendedWebcamDefaults("16:9");

		expect(defaults.region.anchor).toBe("top-right");
		expect(defaults.region.size.width).toBe(18);
		expect(defaults.region.shape).toBe("rectangle");
		expect(defaults.region.borderWidth).toBe(1);
		expect(defaults.region.borderRadius).toBe(20);
		expect(defaults.effects.presetId).toBe("floating-card");
		expect(defaults.effects.backgroundMode).toBe("solid");
		expect(defaults.effects.backgroundColor).toBe("#0f172a");
		expect(defaults.effects.portraitScale).toBe(1.08);
		expect(defaults.effects.edgeFeather).toBe(16);
		expect(defaults.effects.shadowStyle).toBe("lifted");
		expect(defaults.effects.shadowStrength).toBe(0.85);
		expect(defaults.cameraSizeDuringZoom).toBe(0.68);
		expect(defaults.mirrorWebcam).toBe(false);
		expect(defaults.previewShape).toBe("rounded-rect");
	});

	it("returns presenter-soft defaults for compact projects", () => {
		const defaults = getRecommendedWebcamDefaults("9:16");

		expect(defaults.region.anchor).toBe("top-right");
		expect(defaults.region.size.width).toBe(22);
		expect(defaults.region.shape).toBe("rectangle");
		expect(defaults.region.borderWidth).toBe(0);
		expect(defaults.region.borderRadius).toBe(24);
		expect(defaults.effects.presetId).toBe("presenter-soft");
		expect(defaults.effects.backgroundMode).toBe("blur");
		expect(defaults.effects.backgroundBlurStrength).toBe(18);
		expect(defaults.effects.portraitScale).toBe(1.06);
		expect(defaults.effects.edgeFeather).toBe(14);
		expect(defaults.effects.shadowStyle).toBe("lifted");
		expect(defaults.effects.shadowStrength).toBe(0.75);
		expect(defaults.cameraSizeDuringZoom).toBe(0.62);
		expect(defaults.mirrorWebcam).toBe(false);
		expect(defaults.previewShape).toBe("rounded-rect");
	});
});
