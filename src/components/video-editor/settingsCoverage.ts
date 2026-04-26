export interface SettingsCoverageGroup {
	id: string;
	label: string;
	settings: readonly string[];
}

export const EDITOR_SETTINGS_COVERAGE: readonly SettingsCoverageGroup[] = [
	{
		id: "preview-effects",
		label: "Preview and effects",
		settings: [
			"previewQuality",
			"workspaceLayout",
			"hideBackground",
			"backgroundBlur",
			"zoomMotionBlur",
			"connectZooms",
			"frameShadowSize",
			"frameShadowOpacity",
			"frameShadowBlur",
			"frameBorderEnabled",
			"frameBorderWidth",
			"frameBorderColor",
			"frameBorderOpacity",
			"borderRadius",
			"padding",
			"deviceMockup",
		],
	},
	{
		id: "cursor",
		label: "Cursor",
		settings: [
			"showCursor",
			"loopCursor",
			"cursorSize",
			"cursorSmoothing",
			"cursorMotionBlur",
			"cursorClickBounce",
			"cursorSway",
			"cursorStyle",
			"cursorPack",
			"cursorTypeMode",
			"cursorTilt",
			"hideWhenIdle",
			"idleHideDelayMs",
			"smoothMovementEnabled",
			"cursorMovementStyle",
			"cursorSpring",
			"cameraSpring",
			"highQualitySvgCursors",
			"cursorColor",
			"cursorOpacity",
			"clickHighlightColor",
			"clickHighlightSize",
			"clickHighlightOpacity",
			"cursorTrailLength",
			"cursorTrailOpacity",
		],
	},
	{
		id: "keyboard",
		label: "Keyboard callouts",
		settings: [
			"showKeyboardShortcuts",
			"keyboardShortcutPosition",
			"keyboardShortcutTheme",
			"keyboardShortcutScale",
			"keyboardShortcutOpacity",
			"keyboardShortcutDisplayMs",
			"keyboardShortcutMaxVisible",
		],
	},
	{
		id: "background-canvas",
		label: "Background and canvas",
		settings: ["wallpaper", "customWallpapers", "aspectRatio", "cropRegion"],
	},
	{
		id: "timeline",
		label: "Timeline regions",
		settings: [
			"zoomRegions",
			"trimRegions",
			"cutPoints",
			"speedRegions",
			"audioRegions",
			"annotationRegions",
			"captionTrack",
			"captionSettings",
			"captionGenerationOptions",
		],
	},
	{
		id: "webcam",
		label: "Webcam",
		settings: [
			"webcamPath",
			"webcamRegion",
			"webcamEffects",
			"webcamPreviewMode",
			"showWebcam",
			"mirrorWebcam",
			"cameraSizeDuringZoom",
			"cameraLayouts",
		],
	},
	{
		id: "export",
		label: "Export",
		settings: ["exportFormat", "exportDestination", "videoExportSettings", "gifExportSettings"],
	},
];

export const HUD_SETTINGS_COVERAGE: readonly SettingsCoverageGroup[] = [
	{
		id: "capture",
		label: "Capture",
		settings: [
			"recordingQuality",
			"recordingFps",
			"hardwareAcceleration",
			"countdownDelay",
			"highlightArea",
			"hiddenFromCapture",
		],
	},
	{
		id: "post-recording",
		label: "Post recording",
		settings: ["afterRecordingAction", "openQuickShare", "autoCreateZooms"],
	},
	{
		id: "presentation",
		label: "Presentation helpers",
		settings: ["hideDesktopIcons", "hideDockIcon", "speakerNotesEnabled", "speakerNotesText"],
	},
];
