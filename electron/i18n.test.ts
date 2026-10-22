import { describe, expect, it } from "vitest";
import { setMainLocale, tMain } from "./i18n";

describe("main-process i18n", () => {
	it("translates, interpolates and falls back to English", () => {
		setMainLocale("de");
		expect(tMain("tray.stopRecording")).toBe("Aufnahme beenden");
		expect(tMain("tray.recording", { source: "Display 1" })).toBe("Aufnahme: Display 1");

		expect(setMainLocale("xx")).toBe(false);
		expect(tMain("does.not.exist")).toBe("does.not.exist");

		setMainLocale("en");
		expect(tMain("about.status.upToDate", { version: "1.2.3" })).toBe(
			"You’re up to date on version 1.2.3.",
		);
	});
});
