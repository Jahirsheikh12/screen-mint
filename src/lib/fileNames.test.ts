import { describe, expect, it } from "vitest";
import {
	buildCollisionFileName,
	deriveVideoNameFromPath,
	ensureFileExtension,
	normalizeVideoDisplayName,
	sanitizeFileNameBase,
} from "./fileNames";

describe("file name helpers", () => {
	it("derives display names from paths", () => {
		expect(deriveVideoNameFromPath("/tmp/Demo Walkthrough.mp4")).toBe("Demo Walkthrough");
		expect(deriveVideoNameFromPath("C:\\Users\\me\\Clip.webm")).toBe("Clip");
		expect(deriveVideoNameFromPath(null)).toBe("Untitled");
	});

	it("normalizes empty display names", () => {
		expect(normalizeVideoDisplayName("  Demo   Walkthrough  ")).toBe("Demo Walkthrough");
		expect(normalizeVideoDisplayName("   ")).toBe("Untitled");
		expect(normalizeVideoDisplayName(undefined)).toBe("Untitled");
	});

	it("sanitizes invalid filename characters while preserving spaces", () => {
		expect(sanitizeFileNameBase("Demo: Walkthrough/Part? 1")).toBe("Demo_ Walkthrough_Part_ 1");
		expect(sanitizeFileNameBase("Demo Walkthrough")).toBe("Demo Walkthrough");
		expect(sanitizeFileNameBase("...")).toBe("Untitled");
	});

	it("handles reserved filenames", () => {
		expect(sanitizeFileNameBase("CON")).toBe("CON_");
		expect(sanitizeFileNameBase("lpt1")).toBe("lpt1_");
	});

	it("applies expected extensions once", () => {
		expect(ensureFileExtension("Demo Walkthrough", "mp4")).toBe("Demo Walkthrough.mp4");
		expect(ensureFileExtension("Demo Walkthrough.mp4", ".mp4")).toBe("Demo Walkthrough.mp4");
		expect(ensureFileExtension("Demo: Walkthrough", "gif")).toBe("Demo_ Walkthrough.gif");
	});

	it("builds deterministic collision suffixes", () => {
		expect(buildCollisionFileName("Demo Walkthrough.mp4", 0)).toBe("Demo Walkthrough.mp4");
		expect(buildCollisionFileName("Demo Walkthrough.mp4", 1)).toBe("Demo Walkthrough-2.mp4");
		expect(buildCollisionFileName("Demo Walkthrough.mp4", 2)).toBe("Demo Walkthrough-3.mp4");
	});
});
