import { describe, expect, it } from "vitest";
import { resolveCaptureDimensions } from "./captureSizing";

describe("resolveCaptureDimensions", () => {
	it("preserves the source aspect ratio while fitting within the target profile", () => {
		expect(
			resolveCaptureDimensions({
				sourceWidth: 1512,
				sourceHeight: 982,
				maxWidth: 1280,
				maxHeight: 720,
			}),
		).toEqual({
			width: 1108,
			height: 720,
		});
	});

	it("does not upscale captures that are already smaller than the selected profile", () => {
		expect(
			resolveCaptureDimensions({
				sourceWidth: 960,
				sourceHeight: 540,
				maxWidth: 2560,
				maxHeight: 1440,
			}),
		).toEqual({
			width: 960,
			height: 540,
		});
	});

	it("keeps output dimensions even", () => {
		expect(
			resolveCaptureDimensions({
				sourceWidth: 1365,
				sourceHeight: 767,
				maxWidth: 1280,
				maxHeight: 720,
			}),
		).toEqual({
			width: 1280,
			height: 718,
		});
	});
});
