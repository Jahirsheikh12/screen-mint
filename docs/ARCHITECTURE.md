# ScreenMint Architecture

ScreenMint is an Electron desktop app with a React renderer, native capture helpers, and a
renderer-driven editing/export pipeline.

## Runtime Processes

- Main process: `electron/main.ts`
  Owns app lifecycle, tray/menu integration, native helpers, storage paths, permissions, and window
  creation.
- IPC handlers: `electron/ipc/handlers.ts`
  Owns main/renderer commands for capture, recording, projects, export, captions, updater state,
  shortcuts, and file operations.
- Preload bridge: `electron/preload.ts`
  Exposes the typed `window.electronAPI` surface used by renderer windows.
- Renderer: `src/`
  React single-page entrypoint. The active window is selected from the `?windowType=` query
  parameter in `src/App.tsx`.

## Windows

- HUD overlay: `?windowType=hud-overlay`
  Floating recording controls and capture source entrypoint.
- Editor: `?windowType=editor`
  Main editing workspace with timeline, preview, annotations, captions, project persistence, and
  export.
- Source selector: `?windowType=source-selector`
  Capture source picker.
- Export worker: `?windowType=export-worker`
  Isolated renderer worker window for export jobs.
- Countdown, area overlay, and speaker notes windows support recording workflows.

## Recording Pipeline

- macOS uses native ScreenCaptureKit helpers in `electron/native`.
- Windows uses Windows Graphics Capture helpers in `electron/native/wgc-capture`, with fallback
  paths where required.
- Linux uses Electron/Chromium display capture.
- Renderer recording orchestration currently lives in `src/hooks/useScreenRecorder.ts`.
- Recorded artifacts are finalized through main-process IPC and opened in the editor as managed
  project media.

## Editing Pipeline

The editor is centered around `src/components/video-editor/VideoEditor.tsx`, with support modules
for project persistence, timeline editing, captions, webcam layout, cursor rendering, keyboard
shortcut overlays, and export options.

High-change editor domains should be kept isolated:

- Project serialization: `src/components/video-editor/projectPersistence.ts`
- Preferences: `src/components/video-editor/editorPreferences.ts`
- Timeline: `src/components/video-editor/timeline`
- Preview/playback: `src/components/video-editor/videoPlayback`
- Export UI flow: `src/components/video-editor/exportUtils.ts` and export dialogs

## Export Pipeline

Export code lives in `src/lib/exporter`.

- Video export uses streaming decode, frame rendering, audio encoding, and MP4 muxing.
- GIF export uses a separate GIF pipeline.
- `exportV2` and native-composed export code are active development paths and should remain covered
  by focused tests before becoming default behavior.
- Frame rendering should stay deterministic and testable because it is shared by preview/export
  quality features.

## Public Beta Refactor Targets

The largest maintenance risks are known and should be split gradually. Preserve IPC channel names and
the `.screenmint` project format during the first cleanup phase.

- `electron/ipc/handlers.ts` into domain-specific IPC registration modules.
- `src/components/video-editor/VideoEditor.tsx` into lifecycle/export/media/caption/history hooks.
- `src/components/video-editor/SettingsPanel.tsx` into smaller domain panels.
- `src/hooks/useScreenRecorder.ts` into permission, native, fallback, finalization, and cleanup
  modules.

Refactors should keep the current test suite green after every slice.

## IPC Contracts

Shared IPC channel names and early request/response contracts live in
`src/electron-ipc/contracts.ts`. New IPC work should add channel names there first, then use the
shared constants from preload and main-process handlers. This keeps the public bridge stable while
the large handler file is split by domain.
