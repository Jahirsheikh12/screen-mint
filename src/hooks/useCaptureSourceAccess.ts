import { useCallback, useEffect, useState } from "react";
import type {
	CaptureDiagnostics,
	CapturePermissionState,
} from "@/lib/recording/capturePermissionState";
import {
	resolveCaptureSourceAccessState,
	summarizeCaptureProbeFailure,
} from "@/lib/recording/capturePermissionState";

type CaptureSourceAccessOptions = {
	refreshIntervalMs?: number;
};

export function useCaptureSourceAccess(
	sourceOptions: Electron.SourcesOptions,
	options: CaptureSourceAccessOptions = {},
) {
	const [sources, setSources] = useState<ProcessedDesktopSource[]>([]);
	const [permissionState, setPermissionState] = useState<CapturePermissionState | null>(null);
	const [diagnostics, setDiagnostics] = useState<CaptureDiagnostics | null>(null);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		setLoading(true);
		setLoadError(null);

		try {
			const permissionResult = await window.electronAPI.getCapturePermissionState();
			if (!permissionResult.success) {
				throw new Error("Failed to read capture permissions.");
			}

			setPermissionState(permissionResult.state);
			const accessState = resolveCaptureSourceAccessState(permissionResult.state);
			if (!accessState.canProbeSources) {
				setSources([]);
				const diagnosticsResult = await window.electronAPI.getCaptureDiagnostics();
				setDiagnostics(diagnosticsResult.success ? diagnosticsResult.diagnostics ?? null : null);
				return;
			}

			const nextSources = await window.electronAPI.getSources(sourceOptions);
			setSources(nextSources);

			if (permissionResult.state.platform === "darwin" && nextSources.length === 0) {
				const diagnosticsResult = await window.electronAPI.getCaptureDiagnostics();
				const nextDiagnostics = diagnosticsResult.success ? diagnosticsResult.diagnostics ?? null : null;
				setDiagnostics(nextDiagnostics);
				setLoadError(summarizeCaptureProbeFailure(nextDiagnostics));
				return;
			}

			setDiagnostics(null);
		} catch (error) {
			setSources([]);
			setLoadError(error instanceof Error ? error.message : String(error));

			try {
				const diagnosticsResult = await window.electronAPI.getCaptureDiagnostics();
				setDiagnostics(diagnosticsResult.success ? diagnosticsResult.diagnostics ?? null : null);
			} catch {
				setDiagnostics(null);
			}
		} finally {
			setLoading(false);
		}
	}, [sourceOptions]);

	useEffect(() => {
		void refresh();

		if (!options.refreshIntervalMs) {
			return;
		}

		const intervalId = window.setInterval(() => {
			void refresh();
		}, options.refreshIntervalMs);

		return () => {
			window.clearInterval(intervalId);
		};
	}, [options.refreshIntervalMs, refresh]);

	return {
		sources,
		permissionState,
		diagnostics,
		loading,
		loadError,
		refresh,
		accessState: permissionState ? resolveCaptureSourceAccessState(permissionState) : null,
	};
}
