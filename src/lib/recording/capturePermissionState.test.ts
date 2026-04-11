import { describe, expect, it } from "vitest";
import {
	type CaptureDiagnostics,
	type CapturePermissionState,
	resolveCaptureSourceAccessState,
	summarizeCaptureProbeFailure,
} from "./capturePermissionState";

const baseState: CapturePermissionState = {
	platform: "darwin",
	isPackaged: true,
	appPath: "/Applications/ScreenMint.app/Contents/MacOS/ScreenMint",
	bundlePath: "/Applications/ScreenMint.app",
	expectedBundlePath: "/Applications/ScreenMint.app",
	bundleId: "com.jahirsheikh.screenmint",
	inApplicationsFolder: true,
	installPathMatchesExpected: true,
	screenStatus: "granted",
	microphoneStatus: "not-determined",
	accessibilityTrusted: false,
};

describe("resolveCaptureSourceAccessState", () => {
	it("allows probing capture sources when screen access is already granted", () => {
		expect(resolveCaptureSourceAccessState(baseState)).toEqual({
			canProbeSources: true,
			reason: "ready",
			relaunchRequired: false,
		});
	});

	it("blocks probing capture sources when macOS screen permission is missing", () => {
		expect(
			resolveCaptureSourceAccessState({
				...baseState,
				screenStatus: "denied",
			}),
		).toEqual({
			canProbeSources: false,
			reason: "screen-permission-required",
			relaunchRequired: true,
		});
	});

	it("keeps non-mac platforms probeable even when screen status is unknown", () => {
		expect(
			resolveCaptureSourceAccessState({
				...baseState,
				platform: "win32",
				screenStatus: "unknown",
			}),
		).toEqual({
			canProbeSources: true,
			reason: "ready",
			relaunchRequired: false,
		});
	});
});

describe("summarizeCaptureProbeFailure", () => {
	it("prefers desktop capture errors when present", () => {
		const diagnostics: CaptureDiagnostics = {
			permissionState: baseState,
			userDataPath: "/Users/test/Library/Application Support/ScreenMint",
			helperPaths: [],
			sourceProbe: {
				success: false,
				screenCount: 0,
				windowCount: 0,
				nativeWindowCount: 0,
				desktopError: "desktopCapturer failed",
				nativeWindowError: "native helper failed",
			},
		};

		expect(summarizeCaptureProbeFailure(diagnostics)).toBe("desktopCapturer failed");
	});
});
