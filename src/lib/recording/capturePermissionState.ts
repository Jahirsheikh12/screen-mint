export type CapturePermissionStatus =
	| "not-determined"
	| "granted"
	| "denied"
	| "restricted"
	| "unknown"
	| string;

export interface CapturePermissionState {
	platform: NodeJS.Platform | string;
	isPackaged: boolean;
	appPath: string;
	bundlePath: string | null;
	expectedBundlePath: string | null;
	bundleId: string | null;
	inApplicationsFolder: boolean;
	installPathMatchesExpected: boolean;
	screenStatus: CapturePermissionStatus;
	microphoneStatus: CapturePermissionStatus;
	accessibilityTrusted: boolean;
}

export interface CaptureSourceProbeResult {
	success: boolean;
	screenCount: number;
	windowCount: number;
	nativeWindowCount: number;
	desktopError?: string;
	nativeWindowError?: string;
}

export interface HelperBinaryDiagnostics {
	name: string;
	resolvedPath: string;
	sourcePath: string;
	prebundledPath: string | null;
	userDataPath: string | null;
	prebundledExists: boolean;
	userDataExists: boolean;
}

export interface CaptureDiagnostics {
	permissionState: CapturePermissionState;
	userDataPath: string;
	helperPaths: HelperBinaryDiagnostics[];
	sourceProbe: CaptureSourceProbeResult;
}

export function resolveCaptureSourceAccessState(state: CapturePermissionState) {
	if (state.platform !== "darwin") {
		return {
			canProbeSources: true,
			reason: "ready" as const,
			relaunchRequired: false,
		};
	}

	if (state.screenStatus !== "granted") {
		return {
			canProbeSources: false,
			reason: "screen-permission-required" as const,
			relaunchRequired: true,
		};
	}

	return {
		canProbeSources: true,
		reason: "ready" as const,
		relaunchRequired: false,
	};
}

export function summarizeCaptureProbeFailure(diagnostics: CaptureDiagnostics | null | undefined) {
	if (!diagnostics) {
		return null;
	}

	if (diagnostics.sourceProbe.desktopError) {
		return diagnostics.sourceProbe.desktopError;
	}

	if (diagnostics.sourceProbe.nativeWindowError) {
		return diagnostics.sourceProbe.nativeWindowError;
	}

	return null;
}
