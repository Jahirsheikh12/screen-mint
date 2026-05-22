import { describe, expect, it } from "vitest";
import { shouldEnableHudMousePassthrough } from "./hudMousePassthrough";

describe("shouldEnableHudMousePassthrough", () => {
	it("enables passthrough only for idle compact HUD transparent pixels", () => {
		expect(
			shouldEnableHudMousePassthrough({
				dragActive: false,
				contentVisible: false,
				dropdownExpanded: false,
				passthroughRequested: true,
			}),
		).toBe(true);
	});

	it("keeps mouse input active while a dropdown is open", () => {
		expect(
			shouldEnableHudMousePassthrough({
				dragActive: false,
				contentVisible: false,
				dropdownExpanded: true,
				passthroughRequested: true,
			}),
		).toBe(false);
	});

	it("keeps mouse input active during HUD drag or full content overlay", () => {
		expect(
			shouldEnableHudMousePassthrough({
				dragActive: true,
				contentVisible: false,
				dropdownExpanded: false,
				passthroughRequested: true,
			}),
		).toBe(false);
		expect(
			shouldEnableHudMousePassthrough({
				dragActive: false,
				contentVisible: true,
				dropdownExpanded: false,
				passthroughRequested: true,
			}),
		).toBe(false);
	});

	it("keeps mouse input active when passthrough was not requested", () => {
		expect(
			shouldEnableHudMousePassthrough({
				dragActive: false,
				contentVisible: false,
				dropdownExpanded: false,
				passthroughRequested: false,
			}),
		).toBe(false);
	});
});
