# Changelog

All notable changes to ScreenMint will be documented in this file.

This project follows human-written release notes. Versions should match `package.json` and GitHub
release tags.

## 1.0.4 - 2026-10-25

### Added

- Public beta readiness documentation.
- Architecture, asset provenance, support, security, and beta release checklists.
- Shared IPC channel constants now cover capture, recording, export, files, projects, captions,
  updater/settings, HUD, and platform utility channels.
- CI now runs an explicit TypeScript check, and Windows build CI exposes WGC/cursor helper build
  steps before packaging.
- Release workflow now blocks publishing while bundled asset provenance remains unresolved.

- Menus, tray, native dialogs and caption progress follow the app language; every remaining
  hardcoded UI string is translated in all 10 languages.
- The keyboard shortcuts help lists every built-in shortcut, formatted for the platform.

### Changed

- Repository cleanup planning now separates public-release hygiene from larger code refactors.
- IPC registration continues moving out of the legacy all-in-one handler file into domain modules.
- Streamed MP4 exports have their index at the front (faststart), so they play and upload
  progressively.
- The HUD and source picker use lucide icons like the rest of the app.

### Removed

- 3D Scene panel, the extra Audio Mix controls, the Layers panel and layered capture: they saved
  settings that neither preview nor export used. Old projects keep their look (a layer crop is
  folded into the main crop).
- Screenshot button (it could never be enabled), the disabled "Link" export destination and the
  "Export share link" after-recording option.
- Unused dependencies: three, gsap, next-themes, radix-ui, react-icons, Geist, tw-animate-css,
  react-accordion.

### Fixed

- Save & Close no longer closes the editor when the save is cancelled or fails, and the close
  buttons work on the first click.
- Cancelling the countdown no longer freezes the Record button.
- An interrupted or failed recording keeps the parts recorded before a pause instead of deleting
  them; the macOS capture helper stops when the app quits; stopping a stuck helper times out.
- A disk-write error while recording no longer crashes the app.
- macOS updates are verified against the release checksum before they are offered.
- Exports: no A/V drift after trims, captions and annotations match the preview, no 2px offset,
  cancel can't hang, failed exports clean up partial files and report the real error, progress
  accounts for trims, and long exports no longer hold the whole clip's audio in memory.
- Undo resets when another project opens and ignores selection clicks; shortcuts can't be bound
  over undo/redo/export.
- Renderer requests can only write, read and delete inside the app's own folders and open web
  links.

### Known Beta Focus Areas

- Split large IPC, editor, settings, and recording modules into smaller domains.
- Finish asset provenance review for bundled wallpapers, music, models, WASM, and cursor assets.
- Keep bundled assets in place unless the maintainer explicitly requests removal.
- Validate Windows WGC/cursor helpers on Windows and keep release validation green across macOS,
  Windows, and Linux.
