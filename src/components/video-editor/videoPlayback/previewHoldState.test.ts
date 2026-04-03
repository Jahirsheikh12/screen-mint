import { describe, expect, it } from "vitest";
import {
	addPreviewHold,
	clearPreviewHolds,
	getActivePreviewHold,
	removePreviewHold,
	resolvePreviewFrameOverlaySource,
} from "./previewHoldState";

describe("previewHoldState", () => {
	it("keeps the latest explicit hold active until it is released", () => {
		let holds = clearPreviewHolds();
		holds = addPreviewHold(holds, {
			token: "export-1",
			reason: "export",
			frameSrc: "data:image/png;base64,one",
		});
		holds = addPreviewHold(holds, {
			token: "dialog-1",
			reason: "dialog",
			frameSrc: "data:image/png;base64,two",
		});

		expect(getActivePreviewHold(holds)?.token).toBe("dialog-1");

		holds = removePreviewHold(holds, "dialog-1");
		expect(getActivePreviewHold(holds)?.token).toBe("export-1");
	});

	it("prefers the active explicit hold over live preview readiness", () => {
		expect(
			resolvePreviewFrameOverlaySource({
				activePreviewHoldSrc: "data:image/png;base64,hold",
				cachedPreviewFrameSrc: "data:image/png;base64,cached",
				pixiReady: true,
				videoReady: true,
				hasVideoPath: true,
			}),
		).toBe("data:image/png;base64,hold");
	});

	it("uses cached fallback only when no explicit hold exists and live preview is unavailable", () => {
		expect(
			resolvePreviewFrameOverlaySource({
				activePreviewHoldSrc: null,
				cachedPreviewFrameSrc: "data:image/png;base64,cached",
				pixiReady: false,
				videoReady: true,
				hasVideoPath: true,
			}),
		).toBe("data:image/png;base64,cached");

		expect(
			resolvePreviewFrameOverlaySource({
				activePreviewHoldSrc: null,
				cachedPreviewFrameSrc: "data:image/png;base64,cached",
				pixiReady: true,
				videoReady: true,
				hasVideoPath: true,
			}),
		).toBeNull();
	});

	it("clears explicit holds when the source video changes", () => {
		let holds = clearPreviewHolds();
		holds = addPreviewHold(holds, {
			token: "export-1",
			reason: "export",
			frameSrc: "data:image/png;base64,one",
		});

		holds = clearPreviewHolds();
		expect(getActivePreviewHold(holds)).toBeNull();
	});
});
