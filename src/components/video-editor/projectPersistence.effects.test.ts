import { describe, expect, it } from "vitest";
import { normalizeProjectEditor } from "./projectPersistence";

describe("frame effects project persistence", () => {
	it("initializes frame shadow and border defaults", () => {
		const result = normalizeProjectEditor({});

		expect(result.frameShadowSize).toBeGreaterThan(0);
		expect(result.frameShadowOpacity).toBeGreaterThan(0);
		expect(result.frameShadowBlur).toBeGreaterThan(0);
		expect(result.frameBorderEnabled).toBe(false);
		expect(result.frameBorderWidth).toBeGreaterThan(0);
		expect(result.frameBorderColor).toBe("#000000");
		expect(result.frameBorderOpacity).toBe(0.5);
	});

	it("migrates legacy shadow intensity into advanced shadow controls", () => {
		const result = normalizeProjectEditor({
			shadowIntensity: 0.5,
		});

		expect(result.shadowIntensity).toBeCloseTo(0.5, 2);
		expect(result.frameShadowSize).toBeCloseTo(6, 2);
		expect(result.frameShadowOpacity).toBeCloseTo(0.35, 2);
		expect(result.frameShadowBlur).toBeCloseTo(24, 2);
	});

	it("keeps advanced frame effects values when they are explicitly provided", () => {
		const result = normalizeProjectEditor({
			frameShadowSize: 14,
			frameShadowOpacity: 0.42,
			frameShadowBlur: 54,
			frameBorderEnabled: true,
			frameBorderWidth: 22,
			frameBorderColor: "#123456",
			frameBorderOpacity: 0.65,
		});

		expect(result.frameShadowSize).toBe(14);
		expect(result.frameShadowOpacity).toBe(0.42);
		expect(result.frameShadowBlur).toBe(54);
		expect(result.frameBorderEnabled).toBe(true);
		expect(result.frameBorderWidth).toBe(20);
		expect(result.frameBorderColor).toBe("#123456");
		expect(result.frameBorderOpacity).toBe(0.65);
		expect(result.shadowIntensity).toBeGreaterThan(0);
	});
});
