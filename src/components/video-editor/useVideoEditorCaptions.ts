import { type Dispatch, type MutableRefObject, type SetStateAction, useCallback } from "react";
import { toast } from "sonner";
import { applyPresetToSettings } from "./captionPresets";
import type { EditorSessionAction } from "./editorSession";
import {
	CAPTION_STYLE_PRESETS,
	type CaptionGenerationOptions,
	type CaptionGenerationProgress,
	type CaptionModel,
	type CaptionModelStatus,
	type CaptionPositionOverride,
	type CaptionRegion,
	type CaptionSegment,
	type CaptionSettings,
	type CaptionStylePreset,
	type CaptionTrack,
	type CaptionUserPreset,
} from "./types";

type ScopedTranslator = (
	key: string,
	fallback?: string,
	vars?: Record<string, string | number>,
) => string;

interface UseVideoEditorCaptionsOptions {
	t: ScopedTranslator;
	videoPath: string | null;
	isTranscribing: boolean;
	captionTrack: CaptionTrack | null;
	captionGenerationOptions: CaptionGenerationOptions;
	nextCaptionIdRef: MutableRefObject<number>;
	dispatchSession: Dispatch<EditorSessionAction>;
	setCaptionTrack: Dispatch<SetStateAction<CaptionTrack | null>>;
	setCaptionSettings: Dispatch<SetStateAction<CaptionSettings>>;
	setCaptionGenerationOptions: Dispatch<SetStateAction<CaptionGenerationOptions>>;
	setCaptionGenerationProgress: Dispatch<SetStateAction<CaptionGenerationProgress | null>>;
	setCaptionModelStatus: Dispatch<SetStateAction<CaptionModelStatus | null>>;
	setSelectedCaptionId: Dispatch<SetStateAction<string | null>>;
	setIsEditingCaptionPosition: Dispatch<SetStateAction<boolean>>;
}

export function useVideoEditorCaptions({
	t,
	videoPath,
	isTranscribing,
	captionTrack,
	captionGenerationOptions,
	nextCaptionIdRef,
	dispatchSession,
	setCaptionTrack,
	setCaptionSettings,
	setCaptionGenerationOptions,
	setCaptionGenerationProgress,
	setCaptionModelStatus,
	setSelectedCaptionId,
	setIsEditingCaptionPosition,
}: UseVideoEditorCaptionsOptions) {
	const createManualCaptionSegment = useCallback(
		(id: string, startMs: number, endMs: number, text: string) => {
			const tokens = text
				.split(/\s+/)
				.map((token) => token.trim())
				.filter(Boolean);
			const duration = Math.max(1, endMs - startMs);
			const step = Math.max(1, Math.round(duration / Math.max(1, tokens.length)));

			return {
				id,
				startMs,
				endMs,
				text,
				words: tokens.map((token, index) => {
					const wordStartMs = startMs + index * step;
					return {
						id: `${id}-word-${index + 1}`,
						text: token,
						startMs: wordStartMs,
						endMs: index === tokens.length - 1 ? endMs : Math.min(endMs, wordStartMs + step),
					};
				}),
				source: "manual" as const,
			};
		},
		[],
	);

	const updateCaptionSegments = useCallback(
		(updater: (segments: CaptionRegion[]) => CaptionRegion[]) => {
			setCaptionTrack((prev) => {
				const baseTrack: CaptionTrack = prev ?? {
					backend:
						captionGenerationOptions.preferredBackend === "apple-speech"
							? "apple-speech"
							: "whisper.cpp",
					model: captionGenerationOptions.model,
					language: captionGenerationOptions.language,
					prompt: captionGenerationOptions.prompt,
					sourceAudio: captionGenerationOptions.preferredSourceAudio,
					status: "ready",
					segments: [],
				};
				return {
					...baseTrack,
					segments: updater(baseTrack.segments),
					status: "ready",
					error: undefined,
				};
			});
		},
		[captionGenerationOptions, setCaptionTrack],
	);

	const handleCaptionAdded = useCallback(
		(span: { start: number; end: number }) => {
			const id = `caption-${nextCaptionIdRef.current++}`;
			updateCaptionSegments((prev) => [
				...prev,
				createManualCaptionSegment(
					id,
					span.start,
					span.end,
					t("editor.captions.defaultText", "Caption text"),
				),
			]);
			setSelectedCaptionId(id);
		},
		[createManualCaptionSegment, t, updateCaptionSegments, nextCaptionIdRef, setSelectedCaptionId],
	);

	const handleCaptionSpanChange = useCallback(
		(id: string, span: { start: number; end: number }) => {
			updateCaptionSegments((prev) =>
				prev.map((segment) =>
					segment.id === id
						? createManualCaptionSegment(id, span.start, span.end, segment.text)
						: segment,
				),
			);
		},
		[createManualCaptionSegment, updateCaptionSegments],
	);

	const handleCaptionTextChange = useCallback(
		(id: string, text: string) => {
			updateCaptionSegments((prev) =>
				prev.map((segment) =>
					segment.id === id
						? createManualCaptionSegment(id, segment.startMs, segment.endMs, text)
						: segment,
				),
			);
		},
		[createManualCaptionSegment, updateCaptionSegments],
	);

	const handleCaptionDelete = useCallback(
		(id: string) => {
			updateCaptionSegments((prev) => prev.filter((segment) => segment.id !== id));
			setSelectedCaptionId((prev) => (prev === id ? null : prev));
		},
		[updateCaptionSegments, setSelectedCaptionId],
	);

	const handleDeleteAllCaptions = useCallback(() => {
		setCaptionTrack((prev) =>
			prev ? { ...prev, segments: [], status: "idle", error: undefined } : null,
		);
		setSelectedCaptionId(null);
	}, [setCaptionTrack, setSelectedCaptionId]);

	const handleCaptionStylePresetChange = useCallback(
		(preset: CaptionStylePreset) => {
			setCaptionSettings((prev) => ({
				...prev,
				style: { ...CAPTION_STYLE_PRESETS[preset] },
			}));
		},
		[setCaptionSettings],
	);

	const handleCaptionSettingsChange = useCallback(
		(partial: Partial<CaptionSettings>) => {
			setCaptionSettings((prev) => ({ ...prev, ...partial }));
		},
		[setCaptionSettings],
	);

	const handleCaptionStyleChange = useCallback(
		(partial: Partial<CaptionSettings["style"]>) => {
			setCaptionSettings((prev) => ({
				...prev,
				style: { ...prev.style, ...partial },
			}));
		},
		[setCaptionSettings],
	);

	const handleApplyCaptionPreset = useCallback(
		(preset: CaptionUserPreset) => {
			setCaptionSettings((prev) => applyPresetToSettings(prev, preset));
		},
		[setCaptionSettings],
	);

	const handleToggleCaptionPositionEditing = useCallback(
		(next: boolean) => {
			setIsEditingCaptionPosition(next);
		},
		[setIsEditingCaptionPosition],
	);

	const handleCaptionPositionOverrideChange = useCallback(
		(override: CaptionPositionOverride | null) => {
			setCaptionSettings((prev) => ({ ...prev, positionOverride: override }));
		},
		[setCaptionSettings],
	);

	const handleCaptionImport = useCallback(
		(segments: CaptionSegment[], mode: "replace" | "append") => {
			if (segments.length === 0) return;
			setCaptionTrack((prev) => {
				const existing = prev?.segments ?? [];
				const nextSegments =
					mode === "replace"
						? segments
						: [...existing, ...segments].sort((a, b) => a.startMs - b.startMs);
				const base: CaptionTrack = prev ?? {
					backend: "whisper.cpp",
					model: captionGenerationOptions.model,
					language: captionGenerationOptions.language ?? "auto",
					prompt: captionGenerationOptions.prompt ?? "",
					sourceAudio: captionGenerationOptions.preferredSourceAudio ?? "microphone",
					status: "ready",
					segments: [],
				};
				return {
					...base,
					status: "ready",
					error: undefined,
					generatedAt: new Date().toISOString(),
					segments: nextSegments,
				};
			});
		},
		[captionGenerationOptions, setCaptionTrack],
	);

	const getFriendlyCaptionErrorMessage = useCallback(
		(error: unknown) => {
			const rawMessage = error instanceof Error ? error.message : String(error ?? "");
			const normalizedMessage = rawMessage.toLowerCase();

			if (
				normalizedMessage.includes("no usable audio track") ||
				normalizedMessage.includes("does not contain any stream") ||
				normalizedMessage.includes("no microphone or video audio")
			) {
				return t(
					"editor.captions.transcribeNoAudio",
					"This recording has no usable audio. Turn on microphone or system audio, then record again.",
				);
			}

			if (
				normalizedMessage.includes("failed to download whisper model") ||
				normalizedMessage.includes("failed to download whisper vad model") ||
				normalizedMessage.includes("download whisper")
			) {
				return t(
					"editor.captions.transcribeModelDownloadFailed",
					"ScreenMint couldn't download the local speech model. Check your internet connection and try again.",
				);
			}

			if (normalizedMessage.includes("apple speech requires a specific language")) {
				return t(
					"editor.captions.transcribeAppleSpeechNeedsLanguage",
					"Apple Speech needs a fixed language. Choose the spoken language, then try again.",
				);
			}

			if (
				normalizedMessage.includes("speech recognition permission") ||
				normalizedMessage.includes("permission is denied")
			) {
				return t(
					"editor.captions.transcribeSpeechPermissionNeeded",
					"Allow speech recognition for ScreenMint in macOS settings, then try again.",
				);
			}

			if (
				normalizedMessage.includes("on-device apple speech is unavailable") ||
				normalizedMessage.includes("apple speech is unavailable for the selected language")
			) {
				return t(
					"editor.captions.transcribeAppleSpeechUnavailable",
					"Apple Speech is unavailable for this language on this Mac. Switch to Whisper or choose another language.",
				);
			}

			if (
				normalizedMessage.includes("whisper cli build tools are unavailable") ||
				normalizedMessage.includes("cmake") ||
				normalizedMessage.includes("xcode command line tools") ||
				normalizedMessage.includes("visual studio c++ build tools")
			) {
				return t(
					"editor.captions.transcribeRuntimeSetupFailed",
					"ScreenMint couldn't prepare the local caption engine on this device. Install the required build tools and try again.",
				);
			}

			if (
				normalizedMessage.includes("bad_alloc") ||
				normalizedMessage.includes("bad allocation") ||
				normalizedMessage.includes("out of memory") ||
				normalizedMessage.includes("not enough memory")
			) {
				return t(
					"editor.captions.transcribeLowMemory",
					"Your device ran out of memory while transcribing. Try the Small model for this recording.",
				);
			}

			return t("editor.captions.transcribeFailed", "Failed to transcribe audio locally.");
		},
		[t],
	);

	const handleAutoTranscribe = useCallback(async () => {
		if (!videoPath || isTranscribing) return;
		dispatchSession({ type: "set-transcribing", value: true });
		setCaptionGenerationProgress({
			stage: "bootstrap",
			percentage: 0,
			message: t("editor.captions.preparing", "Preparing local transcription..."),
		});

		try {
			const result = await window.electronAPI.generateCaptions({
				videoPath,
				preferredBackend: captionGenerationOptions.preferredBackend,
				model: captionGenerationOptions.model,
				language: captionGenerationOptions.language,
				prompt: captionGenerationOptions.prompt,
				preferredSourceAudio: captionGenerationOptions.preferredSourceAudio,
			});

			if (!result.success && result.canceled) {
				setCaptionGenerationProgress(null);
				return;
			}

			if (!result.success || !result.track) {
				throw new Error(result.error || result.message || "Failed to generate captions.");
			}

			setCaptionTrack(result.track);
			setCaptionSettings((prev) => ({ ...prev, enabled: true }));
			setCaptionGenerationOptions((prev) => ({
				...prev,
				preferredBackend: result.track?.backend ?? prev.preferredBackend,
				model: result.track?.model ?? prev.model,
				language: result.track?.language ?? prev.language,
				prompt: result.track?.prompt ?? prev.prompt,
				preferredSourceAudio: result.track?.sourceAudio ?? prev.preferredSourceAudio,
			}));
			setSelectedCaptionId(result.track.segments[0]?.id ?? null);
			setCaptionGenerationProgress({
				stage: "complete",
				percentage: 100,
				message: t("editor.captions.transcriptReady", "Transcript ready"),
			});
			const status = await window.electronAPI.getCaptionModelStatus(videoPath);
			if (status.success && status.status) {
				setCaptionModelStatus(status.status);
			}
			toast.success(
				t("editor.captions.generatedSegments", "Generated {{count}} transcript segments", {
					count: result.track.segments.length,
				}),
			);
		} catch (error) {
			console.error("Transcription error:", error);
			setCaptionGenerationProgress(null);
			toast.error(getFriendlyCaptionErrorMessage(error));
		} finally {
			dispatchSession({ type: "set-transcribing", value: false });
		}
	}, [
		captionGenerationOptions,
		getFriendlyCaptionErrorMessage,
		isTranscribing,
		t,
		videoPath,
		dispatchSession,
		setCaptionGenerationOptions,
		setCaptionGenerationProgress,
		setCaptionModelStatus,
		setCaptionSettings,
		setCaptionTrack,
		setSelectedCaptionId,
	]);

	const handleCaptionGenerationOptionsChange = useCallback(
		(partial: Partial<CaptionGenerationOptions>) => {
			setCaptionGenerationOptions((prev) => ({ ...prev, ...partial }));
		},
		[setCaptionGenerationOptions],
	);

	const handleCaptionSplit = useCallback(
		(id: string) => {
			updateCaptionSegments((prev) => {
				const segment = prev.find((entry) => entry.id === id);
				if (!segment) {
					return prev;
				}

				if (segment.words.length < 2) {
					return prev;
				}

				const splitIndex = Math.floor(segment.words.length / 2);
				const leftWords = segment.words.slice(0, splitIndex);
				const rightWords = segment.words.slice(splitIndex);
				if (leftWords.length === 0 || rightWords.length === 0) {
					return prev;
				}

				const leftId = `caption-${nextCaptionIdRef.current++}`;
				const rightId = `caption-${nextCaptionIdRef.current++}`;
				const leftSegment: CaptionRegion = {
					id: leftId,
					startMs: segment.startMs,
					endMs: leftWords[leftWords.length - 1]?.endMs ?? segment.startMs,
					text: leftWords.map((word) => word.text).join(" "),
					words: leftWords.map((word, index) => ({ ...word, id: `${leftId}-word-${index + 1}` })),
					source: segment.source,
				};
				const rightSegment: CaptionRegion = {
					id: rightId,
					startMs: rightWords[0]?.startMs ?? segment.endMs,
					endMs: segment.endMs,
					text: rightWords.map((word) => word.text).join(" "),
					words: rightWords.map((word, index) => ({ ...word, id: `${rightId}-word-${index + 1}` })),
					source: segment.source,
				};

				return prev.flatMap((entry) => (entry.id === id ? [leftSegment, rightSegment] : [entry]));
			});
		},
		[updateCaptionSegments, nextCaptionIdRef],
	);

	const handleCaptionMergeNext = useCallback(
		(id: string) => {
			updateCaptionSegments((prev) => {
				const index = prev.findIndex((entry) => entry.id === id);
				if (index < 0 || index >= prev.length - 1) {
					return prev;
				}

				const current = prev[index];
				const next = prev[index + 1];
				const mergedId = `caption-${nextCaptionIdRef.current++}`;
				const mergedWords = [...current.words, ...next.words].map((word, wordIndex) => ({
					...word,
					id: `${mergedId}-word-${wordIndex + 1}`,
				}));
				const merged: CaptionRegion = {
					id: mergedId,
					startMs: current.startMs,
					endMs: next.endMs,
					text: `${current.text} ${next.text}`.trim(),
					words: mergedWords,
					source: current.source,
				};

				return [...prev.slice(0, index), merged, ...prev.slice(index + 2)];
			});
		},
		[updateCaptionSegments, nextCaptionIdRef],
	);

	const handleTranscriptExport = useCallback(
		async (format: "srt" | "vtt" | "txt") => {
			if (!captionTrack || captionTrack.segments.length === 0 || !videoPath) {
				toast.info(
					t("editor.captions.noTranscriptToExport", "No transcript is available to export."),
				);
				return;
			}

			const result = await window.electronAPI.exportCaptionsTranscript({
				videoPath,
				format,
				track: captionTrack,
			});

			if (!result.success && result.canceled) {
				return;
			}

			if (!result.success) {
				toast.error(
					result.message || t("editor.captions.exportFailed", "Failed to export transcript."),
				);
				return;
			}

			toast.success(
				t("editor.captions.exported", "Transcript exported as {{format}}", {
					format: format.toUpperCase(),
				}),
			);
		},
		[captionTrack, t, videoPath],
	);

	const handleCancelCaptionGeneration = useCallback(async () => {
		await window.electronAPI.cancelCaptionGeneration();
		dispatchSession({ type: "set-transcribing", value: false });
		setCaptionGenerationProgress(null);
		toast.info(t("editor.captions.cancelled", "Caption generation cancelled"));
	}, [t, dispatchSession, setCaptionGenerationProgress]);

	const handleDeleteCaptionModel = useCallback(
		async (model: CaptionModel) => {
			const result = await window.electronAPI.deleteCaptionModel(model);
			if (!result.success) {
				toast.error(result.message ?? "Failed to delete caption model");
				return;
			}
			if (videoPath) {
				const status = await window.electronAPI.getCaptionModelStatus(videoPath);
				if (status.success && status.status) {
					setCaptionModelStatus(status.status);
				}
			}
			toast.success(`Deleted the ${model} speech model`);
		},
		[videoPath, setCaptionModelStatus],
	);

	return {
		handleDeleteCaptionModel,
		handleCaptionAdded,
		handleCaptionSpanChange,
		handleCaptionTextChange,
		handleCaptionDelete,
		handleDeleteAllCaptions,
		handleCaptionStylePresetChange,
		handleCaptionSettingsChange,
		handleCaptionStyleChange,
		handleApplyCaptionPreset,
		handleToggleCaptionPositionEditing,
		handleCaptionPositionOverrideChange,
		handleCaptionImport,
		handleAutoTranscribe,
		handleCaptionGenerationOptionsChange,
		handleCaptionSplit,
		handleCaptionMergeNext,
		handleTranscriptExport,
		handleCancelCaptionGeneration,
	};
}
