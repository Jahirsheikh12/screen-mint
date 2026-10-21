import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
	it("keeps a custom text size next to a text colour", () => {
		expect(cn("text-body text-fg", "text-fg-muted")).toBe("text-body text-fg-muted");
		expect(cn("text-caption", "text-label")).toBe("text-label");
		expect(cn("shadow-panel shadow-black/40", "shadow-dialog")).toBe(
			"shadow-black/40 shadow-dialog",
		);
	});
});
