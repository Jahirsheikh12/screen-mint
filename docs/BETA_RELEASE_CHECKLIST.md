# Beta Release Checklist

Use this checklist before publishing a public beta release.

## Repository Readiness

- Confirm `README.md` accurately describes platform support, setup, and beta limitations.
- Confirm `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md`, and `CHANGELOG.md` are current.
- Confirm bundled assets have documented provenance in `docs/ASSET_PROVENANCE.md`.
- Confirm no local editor, generated, or release artifacts are committed accidentally.
- Confirm dependency licenses are compatible with the project license.

## Local Verification

- Run `npm ci` on a clean checkout.
- Run `npm run lint`.
- Run `npm run test`.
- Run `npm run i18n:check`.
- Run `npm run build:asset-pack`.
- Run platform builds on the target platforms before publishing installers.

## Recording Smoke Tests

- Launch the app from a clean user data profile.
- Record a full display.
- Record a window.
- Record a selected area.
- Test microphone-only, system-audio-only, both, and no-audio paths where supported.
- Stop from HUD controls.
- Stop from tray/menu controls.
- Verify failed or cancelled recordings clean up partial artifacts.

## Editor Smoke Tests

- Open a new recording in the editor.
- Import an existing video.
- Save and reopen a `.screenmint` project.
- Add trim, speed, zoom, cursor, annotation, background, webcam, caption, and audio edits.
- Undo and redo representative edits.
- Delete a managed project and confirm only managed media is removed.

## Export Smoke Tests

- Export MP4 to the recordings folder.
- Export MP4 through a save dialog path.
- Export GIF.
- Cancel an export and verify partial output is removed.
- Verify output duration, dimensions, audio presence, and file playback.

## Platform Checks

- macOS: verify Screen Recording, Microphone, Accessibility, and Speech Recognition flows.
- macOS: verify unsigned build instructions or signing/notarization status.
- Windows: verify WGC capture and fallback behavior.
- Linux: verify display capture behavior and known cursor limitations.

## Release Checks

- Confirm `package.json` version matches the release tag.
- Confirm generated updater metadata is present and valid.
- Confirm website download links point to the intended release artifacts.
- Draft release notes with known beta limitations and upgrade notes.
